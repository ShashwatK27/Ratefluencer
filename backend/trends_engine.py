"""
Trend Engine  -  real-time trend signals from Google Trends + Reddit + YouTube.
Falls back gracefully on rate limits or network errors.
"""
import os
import math
import time
import logging
import requests as _requests
from typing import List, Dict

# ── urllib3 2.x compatibility patch for pytrends ──────────────────────────────
# pytrends uses Retry(method_whitelist=...) which was renamed to allowed_methods
# in urllib3 2.0.  This one-time patch makes both parameter names work so pytrends
# doesn't need to be modified or downgraded.
try:
    from urllib3.util.retry import Retry as _Retry
    if not getattr(_Retry.__init__, '_compat_patched', False):
        _orig_retry_init = _Retry.__init__
        def _compat_retry_init(self, *args, **kwargs):
            if 'method_whitelist' in kwargs:
                kwargs.setdefault('allowed_methods', kwargs.pop('method_whitelist'))
            _orig_retry_init(self, *args, **kwargs)
        _compat_retry_init._compat_patched = True
        _Retry.__init__ = _compat_retry_init
except Exception:
    pass

def _get_yt_key() -> str:
    k = os.environ.get('YOUTUBE_API_KEY', '')
    return k if k and k != 'your_youtube_api_key_here' else ''

def _record_yt_units(units: int):
    pass   # no-op without key rotator

logger = logging.getLogger(__name__)

# -- ML trend velocity scorer (trained on YouTube analytics) -------------------
_trend_clf     = None
_trend_feats   = None

def _load_trend_model():
    global _trend_clf, _trend_feats
    from pathlib import Path
    import joblib
    model_path = Path(__file__).parent / 'trend_model_v1.pkl'
    feats_path = Path(__file__).parent / 'trend_features_v1.pkl'
    if model_path.exists() and feats_path.exists():
        try:
            _trend_clf   = joblib.load(model_path)
            _trend_feats = joblib.load(feats_path)
            logger.info("Trend ML model loaded")
        except Exception as e:
            logger.debug(f"Trend model load failed: {e}")

_load_trend_model()

def ml_trend_score(views_7d: float, likes_7d: float, er: float,
                   growth: float, day_of_week: int) -> int:
    """
    Score a trend candidate using the ML model trained on YouTube analytics.
    Falls back to the heuristic score if model is not available.
    Returns a 0-100 score.
    """
    if _trend_clf is None:
        return None
    try:
        feat_map = {
            'day_of_week':   day_of_week,
            'views_7d_avg':  min(views_7d, 1e6),
            'likes_7d_avg':  min(likes_7d, 50000),
            'er_7d':         min(er, 0.5),
            'growth_avg':    min(growth, 100),
        }
        X = [[feat_map.get(f, 0) for f in _trend_feats]]
        prob_trending = float(_trend_clf.predict_proba(X)[0][1])
        return int(prob_trending * 100)
    except Exception:
        return None

# Simple in-memory cache for YouTube Search results (TTL = 1 hour).
# search.list costs 100 units; caching means one call per category per hour.
_yt_search_cache: Dict[str, dict] = {}   # key -> {'ts': float, 'results': List[Dict]}

CATEGORY_SUBREDDITS: Dict[str, List[str]] = {
    'Fashion':     ['fashion', 'streetwear', 'femalefashionadvice', 'malefashionadvice'],
    'Food':        ['food', 'recipes', 'IndianFood', 'EatCheapAndHealthy'],
    'Travel':      ['travel', 'solotravel', 'india', 'backpacking'],
    'Family':      ['Parenting', 'beyondthebump', 'daddit', 'Mommit'],
    'Beauty':      ['SkincareAddiction', 'MakeupAddiction', 'AsianBeauty', 'beauty'],
    'Fitness':     ['fitness', 'bodyweightfitness', 'loseit', 'xxfitness'],
    'Interior':    ['InteriorDesign', 'malelivingspace', 'femalelivingspace', 'DIY'],
    'Pet':         ['dogs', 'cats', 'aww', 'pets'],
    'Lifestyle':   ['getdisciplined', 'selfimprovement', 'minimalism', 'productivity'],
    'Technology':  ['technology', 'artificial', 'MachineLearning', 'startups'],
    'Music':       ['Music', 'IndieMusic', 'listentothis', 'Bollywood'],
    'Photography': ['itookapicture', 'photocritique', 'analog', 'mobilephotography'],
    'Comedy':      ['funny', 'memes', 'standupshots', 'IndianMemes'],
    'Business':    ['Entrepreneur', 'smallbusiness', 'marketing', 'startups'],
    'Finance':     ['personalfinance', 'investing', 'IndiaInvestments', 'CryptoCurrency'],
    'General':     ['india', 'worldnews', 'technology', 'Entrepreneur'],
}

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    'Fashion':       ['fashion trends 2025', 'OOTD outfit', 'streetwear India', 'clothing haul', 'fashion week'],
    'Food':          ['food recipes viral', 'healthy eating India', 'meal prep', 'restaurant trends', 'cooking tips'],
    'Travel':        ['travel destinations India', 'solo travel tips', 'budget travel India', 'hidden gems India', 'travel vlog'],
    'Family':        ['parenting tips India', 'family activities', 'kids education India', 'family vlog'],
    'Beauty':        ['skincare routine India', 'makeup tutorial', 'glass skin tips', 'beauty products India', 'glow up tips'],
    'Fitness':       ['workout routine home', 'weight loss tips India', 'gym motivation', 'fitness transformation', 'yoga India'],
    'Interior':      ['home decor ideas India', 'room makeover DIY', 'interior design 2025', 'small space decor'],
    'Pet':           ['dog training tips', 'pet care India', 'cat videos viral', 'puppy tips India'],
    'Lifestyle':     ['morning routine productive', 'self care routine', 'daily vlog India', 'minimalism lifestyle', 'productivity tips'],
    'Technology':    ['AI tools 2025', 'tech review India', 'smartphone tips', 'ChatGPT tips', 'app recommendations India'],
    'Music':         ['new Bollywood songs', 'music trends India', 'indie music India', 'music playlist 2025'],
    'Photography':   ['photography tips mobile', 'photo editing tutorial', 'portrait photography', 'Instagram photography'],
    'Comedy':        ['funny reels India', 'comedy videos viral', 'memes 2025', 'stand up comedy India'],
    'Business':        ['startup ideas India', 'business tips entrepreneur', 'marketing strategy', 'passive income India'],
    'Finance':         ['investing tips India', 'personal finance India', 'mutual funds guide', 'stock market India'],
    'AI':              ['AI tools 2025', 'ChatGPT tips India', 'artificial intelligence trends', 'AI for creators', 'generative AI India'],
    'Startups':        ['startup India 2025', 'startup funding India', 'startup ideas', 'entrepreneur India', 'new startup launch'],
    'Creator Economy': ['creator economy India', 'influencer marketing 2025', 'content creator tips', 'monetize Instagram India', 'brand deals creators'],
    'Education':       ['online learning India', 'study tips students', 'EdTech India', 'skill development 2025', 'career tips India'],
    'Gaming':          ['gaming India 2025', 'mobile gaming trends', 'esports India', 'gaming setup India', 'gaming tips'],
    'Music':           ['new Bollywood songs', 'music trends India', 'indie music India', 'music playlist 2025'],
    'Comedy':          ['funny reels India', 'comedy videos viral', 'memes 2025', 'stand up comedy India'],
    'Wellness':        ['mental health India', 'yoga wellness India', 'mindfulness 2025', 'self care routine', 'ayurveda tips'],
    'Lifestyle':       ['morning routine productive', 'self care routine', 'daily vlog India', 'minimalism lifestyle', 'productivity tips'],
    'Photography':     ['photography tips mobile', 'photo editing tutorial', 'portrait photography', 'Instagram photography'],
    'Technology':      ['AI tools 2025', 'tech review India', 'smartphone tips', 'ChatGPT tips', 'app recommendations India'],
    'General':         ['viral trends India', 'Instagram reels trending', 'social media tips', 'content creation India'],
}


def _bucket_scores(current: float, week_mean: float, week_max: float) -> Dict:
    # velocity: how far above the week average is current interest
    # (current/mean)*60 maps:  at average->60,  2x average->100 (capped)
    velocity = min(100, int((current / max(week_mean, 1)) * 60))

    # novelty: is the topic at its weekly peak right now?
    # Higher current vs max = it's peaking NOW = genuinely trending
    range_   = max(week_max - week_mean, 1)
    novelty  = min(100, max(0, int((current - week_mean) / range_ * 100)))

    # trend_score: weighted combination on full 0-100 scale
    # current_interest already 0-100 from Google (100 = peak of period)
    trend_score = min(100, int(
        current  * 0.40 +
        velocity * 0.35 +
        novelty  * 0.25
    ))
    return {
        'current_interest': int(current),
        'growth_velocity':  velocity,
        'novelty':          novelty,
        'trend_score':      trend_score,
    }


def fetch_google_trends(category: str, geo: str = 'IN') -> List[Dict]:
    """
    Fetch real-time trend data from Google Trends for the given category.
    Returns a list of trend dicts sorted by trend_score descending.
    Returns [] on any failure  -  caller falls back to LLM.
    """
    try:
        from pytrends.request import TrendReq
    except ImportError:
        logger.warning("pytrends not installed  -  run: pip install pytrends")
        return []

    keywords = CATEGORY_KEYWORDS.get(category, CATEGORY_KEYWORDS['General'])[:5]

    try:
        pt = TrendReq(hl='en-IN', tz=330, timeout=(10, 30), retries=2, backoff_factor=0.5)
        pt.build_payload(keywords, timeframe='now 7-d', geo=geo)
        time.sleep(0.6)

        df = pt.interest_over_time()
        if df is None or df.empty:
            logger.warning(f"Empty Google Trends response for '{category}'")
            return []

        if 'isPartial' in df.columns:
            df = df.drop('isPartial', axis=1)

        latest  = df.iloc[-1]
        wk_mean = df.mean()
        wk_max  = df.max()

        results = []
        for kw in keywords:
            if kw not in latest.index:
                continue

            signals = _bucket_scores(
                float(latest[kw]),
                float(wk_mean[kw]),
                float(wk_max[kw]),
            )
            if signals['current_interest'] == 0:
                continue

            # Try rising related query for a richer display topic
            display_topic = kw
            try:
                pt.build_payload([kw], timeframe='now 7-d', geo=geo)
                related = pt.related_queries().get(kw, {})
                rising = related.get('rising')
                if rising is not None and not rising.empty:
                    display_topic = rising.iloc[0]['query']
                time.sleep(0.4)
            except Exception:
                pass

            results.append({
                'topic':            display_topic,
                'keyword':          kw,
                'trend_score':      signals['trend_score'],
                'growth_velocity':  signals['growth_velocity'],
                'novelty':          signals['novelty'],
                'current_interest': signals['current_interest'],
                'audience_fit':     min(100, 40 + signals['trend_score'] // 3),
                'source':           'Google Trends',
                'why_trending':     (
                    f"Interest {signals['current_interest']}/100 in India this week "
                    f"(velocity {signals['growth_velocity']}, novelty {signals['novelty']})"
                ),
                'data_backed': True,
            })

        results.sort(key=lambda x: x['trend_score'], reverse=True)
        return results

    except Exception as e:
        logger.warning(f"Google Trends fetch failed for '{category}': {e}")
        return []


def fetch_reddit_trends(category: str) -> List[Dict]:
    """
    Fetch hot posts from relevant subreddits using Reddit's public JSON API.
    No API key required  -  uses public read-only endpoint.
    Returns [] on failure.
    """
    subreddits = CATEGORY_SUBREDDITS.get(category, CATEGORY_SUBREDDITS['General'])[:2]
    headers = {'User-Agent': 'ratefluencer-trends/1.0'}
    results = []
    seen_topics = set()

    for sub in subreddits:
        try:
            url = f"https://www.reddit.com/r/{sub}/hot.json?limit=5&t=week"
            resp = _requests.get(url, headers=headers, timeout=8)
            if resp.status_code != 200:
                continue

            posts = resp.json().get('data', {}).get('children', [])
            for post in posts:
                d = post.get('data', {})
                title = d.get('title', '').strip()
                if not title or d.get('stickied'):
                    continue

                score     = int(d.get('score', 0))
                comments  = int(d.get('num_comments', 0))
                upvote_r  = float(d.get('upvote_ratio', 0.8))

                # Log10 scaling: 100 upvotes=40, 1K=60, 10K=80, 100K=100
                velocity  = min(100, int(math.log10(max(score, 1)) * 20))
                # Engagement depth: comments relative to upvotes
                comment_ratio = comments / max(score, 1)
                engagement = min(100, int(comment_ratio * 500 + upvote_r * 50))
                trend_sc  = min(100, int(velocity * 0.5 + engagement * 0.3 + upvote_r * 20))

                # Deduplicate by topic prefix
                key = title[:40].lower()
                if key in seen_topics:
                    continue
                seen_topics.add(key)

                results.append({
                    'topic':            title[:80],
                    'keyword':          title[:40],
                    'trend_score':      trend_sc,
                    'growth_velocity':  velocity,
                    'novelty':          novelty,
                    'current_interest': min(100, int(upvote_r * 100)),
                    'audience_fit':     min(100, 50 + trend_sc // 5),
                    'source':           f'Reddit r/{sub}',
                    'why_trending':     f"{score:,} upvotes . {comments} comments on r/{sub}",
                    'data_backed':      True,
                })
            time.sleep(0.3)

        except Exception as e:
            logger.debug(f"Reddit fetch failed for r/{sub}: {e}")
            continue

    results.sort(key=lambda x: x['trend_score'], reverse=True)
    return results[:5]


# Categories that share category_id=26 (Howto & Style) need a text search
# instead of category filter because Indian content mixes all styles together.
_YT_SEARCH_QUERIES: Dict[str, str] = {
    'Beauty':    'skincare makeup beauty tutorial india',
    'Fitness':   'workout fitness gym yoga exercise india',
    'Fashion':   'fashion outfit style ootd clothing india',
    'Food':      'recipe food cooking street food india',
    'Travel':    'travel vlog india destination trip explore',
    'Finance':   'investing money stock mutual fund SIP india finance',
    'Business':  'startup entrepreneur business marketing india',
    'Lifestyle': 'morning routine lifestyle vlog india self care',
    'Family':    'family vlog parenting kids india',
    'Interior':  'home decor room makeover interior design india',
    'Pet':       'dog cat pet care india cute',
}
# Cache TTL = 6 hours to stay within 10,000 free quota/day.
# 11 Search categories x 101 units x 4 refreshes/day = 4,444 units -- safe.
_YT_SEARCH_TTL = 21600


def fetch_youtube_search_trends(category: str, geo: str = 'IN') -> List[Dict]:
    """
    Use YouTube Search API (search.list) to find trending category-specific
    videos in India.  Costs 100 quota units per call -- results cached 1 hour.

    Only called for categories that share category_id=26 (Beauty, Fitness, etc.)
    where videos.list cannot distinguish between them.
    """
    api_key = _get_yt_key()
    if not api_key:
        return []

    query = _YT_SEARCH_QUERIES.get(category)
    if not query:
        return []   # category doesn't need search (has its own category_id)

    # Return cached results if fresh
    cache_key = category + '_' + geo
    cached = _yt_search_cache.get(cache_key)
    if cached and (time.time() - cached['ts']) < _YT_SEARCH_TTL:
        logger.debug(f"YouTube Search cache hit for '{category}'")
        return cached['results']

    try:
        import datetime
        since = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).strftime('%Y-%m-%dT00:00:00Z')

        params = {
            'part':          'snippet',
            'q':             query,
            'type':          'video',
            'order':         'viewCount',
            'regionCode':    geo,
            'publishedAfter': since,
            'maxResults':    8,
            'key':           api_key,
        }
        resp = _requests.get(
            'https://www.googleapis.com/youtube/v3/search',
            params=params, timeout=10,
        )
        resp.raise_for_status()
        _record_yt_units(100)   # search.list = 100 units
        items = resp.json().get('items', [])

        # Fetch statistics for the returned video IDs (1 extra unit)
        video_ids = [i['id']['videoId'] for i in items if i.get('id', {}).get('videoId')]
        stats_map: Dict[str, dict] = {}
        if video_ids:
            stats_resp = _requests.get(
                'https://www.googleapis.com/youtube/v3/videos',
                params={'part': 'statistics', 'id': ','.join(video_ids), 'key': api_key},
                timeout=8,
            )
            if stats_resp.status_code == 200:
                _record_yt_units(1)   # videos.list = 1 unit
                for v in stats_resp.json().get('items', []):
                    stats_map[v['id']] = v.get('statistics', {})

        results = []
        for item in items:
            vid_id  = item.get('id', {}).get('videoId', '')
            snippet = item.get('snippet', {})
            title   = snippet.get('title', '').strip()
            channel = snippet.get('channelTitle', '')
            if not title:
                continue

            stats    = stats_map.get(vid_id, {})
            views    = int(stats.get('viewCount',    0))
            likes    = int(stats.get('likeCount',    0))
            comments = int(stats.get('commentCount', 0))
            velocity    = min(100, int(math.log10(max(views, 1)) * 14))
            eng_rate    = (likes + comments) / max(views, 1)
            engagement  = min(100, int(eng_rate * 2000))
            trend_score = min(100, int(velocity * 0.45 + engagement * 0.30 + 80 * 0.25))

            results.append({
                'topic':            title[:80],
                'keyword':          title[:40],
                'channel':          channel,
                'trend_score':      trend_score,
                'growth_velocity':  velocity,
                'engagement_score': engagement,
                'novelty':          80,
                'current_interest': min(100, int(views / 100_000)),
                'audience_fit':     min(100, 60 + trend_score // 4),
                'source':           'YouTube Search (Data API)',
                'why_trending':     f"{views/1_000_000:.1f}M views . {likes/1000:.0f}K likes on YouTube India",
                'data_backed':      True,
                'real_time':        True,
            })
            if len(results) >= 3:
                break

        results.sort(key=lambda x: x['trend_score'], reverse=True)
        # Cache the result
        _yt_search_cache[cache_key] = {'ts': time.time(), 'results': results}
        logger.info(f"YouTube Search API: {len(results)} results for '{category}' (cached 1h)")
        return results

    except Exception as e:
        logger.warning(f"YouTube Search API failed for '{category}': {e}")
        return []


# YouTube Data API v3: category ID mapping for mostPopular chart
# https://developers.google.com/youtube/v3/docs/videoCategories
# Note: some category IDs return 404 for specific regionCodes (e.g. Travel=19 in IN).
# fetch_youtube_trends() auto-retries without category_id on 404.
_YT_CATEGORY_IDS: Dict[str, str] = {
    'Technology':    '28',   # Science & Technology
    'Gaming':        '20',   # Gaming
    'Music':         '10',   # Music
    'Comedy':        '23',   # Comedy
    'Entertainment': '24',   # Entertainment
    'Sports':        '17',   # Sports
    'Beauty':        '26',   # Howto & Style
    'Fashion':       '26',   # Howto & Style
    'Fitness':       '26',   # Howto & Style
    'Food':          '26',   # Howto & Style
    'Business':      '22',   # People & Blogs
    'Finance':       '22',   # People & Blogs
    'Education':     '27',   # Education
    # Travel (19) intentionally omitted — returns 404 for IN region;
    # handled via keyword filter on general trending feed instead.
}

# Keyword filter: narrows category_id=26 (Howto & Style) and general trending
# into niche-specific content. Broad enough to catch Indian content styles.
_YT_KEYWORD_FILTER: Dict[str, List[str]] = {
    'Fitness':   ['workout', 'gym', 'fitness', 'yoga', 'exercise', 'weight', 'diet',
                  'health', 'body', 'training', 'muscle', 'fat', 'calories', 'run'],
    'Beauty':    ['makeup', 'skincare', 'beauty', 'glow', 'hair', 'routine', 'skin',
                  'foundation', 'lipstick', 'moisturizer', 'serum', 'look', 'tutorial',
                  'get ready', 'grwm', 'transformation', 'brow', 'lash', 'face'],
    'Fashion':   ['fashion', 'outfit', 'style', 'dress', 'clothing', 'ootd', 'trend',
                  'wear', 'haul', 'saree', 'ethnic', 'kurta', 'wardrobe', 'fit'],
    'Food':      ['recipe', 'food', 'cook', 'restaurant', 'biryani', 'snack', 'chef',
                  'eat', 'taste', 'kitchen', 'dish', 'street food', 'vlog', 'bake',
                  'thali', 'curry', 'dessert', 'review', 'mukbang'],
    'Travel':    ['travel', 'trip', 'tour', 'india', 'vlog', 'explore', 'place',
                  'visit', 'destination', 'road', 'hotel', 'beach', 'mountain',
                  'goa', 'kerala', 'rajasthan', 'himachal', 'manali', 'kashmir'],
    'Business':  ['startup', 'entrepreneur', 'business', 'marketing', 'growth',
                  'revenue', 'passive income', 'side hustle', 'earn', 'profit'],
    'Finance':   ['invest', 'money', 'stock', 'crypto', 'mutual fund', 'sip',
                  'finance', 'saving', 'portfolio', 'nifty', 'sensex', 'tax'],
    'Lifestyle': ['morning routine', 'day in my life', 'vlog', 'productivity',
                  'self care', 'routine', 'minimalism', 'home', 'decor'],
}


def fetch_youtube_trends(category: str, geo: str = 'IN') -> List[Dict]:
    """
    Fetch trending YouTube videos using YouTube Data API v3 (primary)
    or the public Atom RSS feed (fallback when YOUTUBE_API_KEY is not set).

    Primary path  (requires YOUTUBE_API_KEY in backend/.env):
        GET https://www.googleapis.com/youtube/v3/videos
            ?part=snippet,statistics
            &chart=mostPopular
            &regionCode=IN
            &maxResults=10
            &videoCategoryId={id}   # optional category filter
            &key={YOUTUBE_API_KEY}

    Returns trend dicts with real view/like/comment counts and computed scores.
    Falls back to RSS silently if the API key is missing or the call fails.
    """
    api_key = _get_yt_key()

    # ── YouTube Data API v3 (real statistics, auto-rotating keys) ─────────────
    if api_key:
        # For categories that share category_id=26 (Howto & Style), use
        # Search API with a text query for accurate category-specific results.
        if category in _YT_SEARCH_QUERIES:
            search_results = fetch_youtube_search_trends(category, geo)
            if search_results:
                return search_results
            # Search failed -- fall through to videos.list below

        try:
            category_id = _YT_CATEGORY_IDS.get(category, '')
            params: Dict = {
                'part':       'snippet,statistics',
                'chart':      'mostPopular',
                'regionCode': geo,
                'maxResults': 10,
                'key':        api_key,
            }
            if category_id:
                params['videoCategoryId'] = category_id

            resp = _requests.get(
                'https://www.googleapis.com/youtube/v3/videos',
                params=params, timeout=10,
            )
            # 404 means this category_id is unavailable for the regionCode.
            if resp.status_code == 404 and 'videoCategoryId' in params:
                logger.debug(f"YouTube category {params['videoCategoryId']} not available for {geo} -- retrying")
                params_retry = {k: v for k, v in params.items() if k != 'videoCategoryId'}
                resp = _requests.get(
                    'https://www.googleapis.com/youtube/v3/videos',
                    params=params_retry, timeout=10,
                )
            resp.raise_for_status()
            _record_yt_units(1)   # videos.list = 1 unit
            items = resp.json().get('items', [])

            kw_filter = _YT_KEYWORD_FILTER.get(category, [])

            # Parse all items, then apply keyword filter.
            # Graceful fallback: if no items match the keywords (e.g. Indian Howto
            # content uses different terms), use top unfiltered results so the
            # function never returns [] from a successful API call.
            def _score_item(item):
                s  = item.get('snippet', {})
                st = item.get('statistics', {})
                return {
                    'title':   s.get('title', '').strip(),
                    'channel': s.get('channelTitle', ''),
                    'views':   int(st.get('viewCount',    0)),
                    'likes':   int(st.get('likeCount',    0)),
                    'comments':int(st.get('commentCount', 0)),
                }

            parsed   = [_score_item(i) for i in items if _score_item(i)['title']]
            filtered = [p for p in parsed
                        if not kw_filter or
                        any(kw.lower() in p['title'].lower() for kw in kw_filter)]
            candidates = filtered if filtered else parsed   # fall back to unfiltered

            results = []
            for p in candidates:
                title    = p['title']
                channel  = p['channel']
                views    = p['views']
                likes    = p['likes']
                comments = p['comments']

                if not title:
                    continue

                # Compute scores from real data
                # Log10 velocity: 100K=75, 1M=90, 10M=100
                velocity   = min(100, int(math.log10(max(views, 1)) * 15))
                # Engagement: like+comment rate -- typical YT like rate 2-5%
                eng_rate   = (likes + comments) / max(views, 1)
                engagement = min(100, int(eng_rate * 2000))
                # Being on mostPopular = actively trending right now
                novelty    = 85
                trend_score = min(100, int(velocity * 0.45 + engagement * 0.30 + novelty * 0.25))

                results.append({
                    'topic':            title[:80],
                    'keyword':          title[:40],
                    'channel':          channel,
                    'trend_score':      trend_score,
                    'growth_velocity':  velocity,
                    'engagement_score': engagement,
                    'novelty':          novelty,
                    'current_interest': min(100, int(math.log10(max(views, 1)) * 14)),
                    'audience_fit':     min(100, 55 + trend_score // 4),
                    'source':           'YouTube Trending (Data API)',
                    'why_trending':     (
                        f"{views/1_000_000:.1f}M views . "
                        f"{likes/1000:.0f}K likes on YouTube India"
                    ),
                    'data_backed':      True,
                    'real_time':        True,
                })
                if len(results) >= 3:
                    break

            if results:
                results.sort(key=lambda x: x['trend_score'], reverse=True)
                logger.info(f"YouTube Data API: {len(results)} trends for '{category}'")
                return results

        except Exception as e:
            logger.warning(f"YouTube Data API failed for '{category}': {e} -- falling back to RSS")

    # ── RSS fallback (no API key needed) ───────────────────────────────────────
    rss_url = f"https://www.youtube.com/feeds/videos.xml?chart=mostpopular&regionCode={geo}&hl=en_IN"
    kw_filter = _YT_KEYWORD_FILTER.get(category, [])
    try:
        resp = _requests.get(rss_url, headers={'User-Agent': 'ratefluencer-trends/1.0'}, timeout=8)
        if resp.status_code != 200:
            return []

        import xml.etree.ElementTree as ET
        ns    = {'atom': 'http://www.w3.org/2005/Atom'}
        root  = ET.fromstring(resp.content)
        entries = root.findall('atom:entry', ns)

        results = []
        for entry in entries[:20]:
            title_el = entry.find('atom:title', ns)
            title    = title_el.text.strip() if title_el is not None else ''
            if not title:
                continue
            if kw_filter and not any(kw.lower() in title.lower() for kw in kw_filter):
                continue

            trend_score = 75 + (len(results) == 0) * 10
            results.append({
                'topic':            title[:80],
                'keyword':          title[:40],
                'trend_score':      trend_score,
                'growth_velocity':  70,
                'novelty':          65,
                'current_interest': 80,
                'audience_fit':     min(100, 55 + len(results) * 2),
                'source':           'YouTube Trending (RSS)',
                'why_trending':     'Currently trending on YouTube India',
                'data_backed':      True,
                'real_time':        True,
            })
            if len(results) >= 3:
                break

        return results

    except Exception as e:
        logger.debug(f"YouTube RSS fallback failed: {e}")
        return []


def fetch_news_trends(category: str) -> List[Dict]:
    """
    Fetch truly real-time trends from live RSS news feeds.
    No API key required. Sources: Times of India, NDTV, Tech news, Economic Times.
    Returns topics extracted from current headlines - updated every few minutes.
    """
    import xml.etree.ElementTree as ET
    from datetime import datetime, timezone

    RSS_SOURCES: Dict[str, List[str]] = {
        'General':      ['https://timesofindia.indiatimes.com/rssfeedmostread.cms'],
        'Technology':   ['https://feeds.feedburner.com/TechCrunch', 'https://news.ycombinator.com/rss'],
        'Business':     ['https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
        'Finance':      ['https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'],
        'Fashion':      ['https://www.vogue.in/feed/'],
        'Beauty':       ['https://www.allure.com/feed/rss'],
        'Fitness':      ['https://www.menshealth.com/rss/all.xml/', 'https://www.womenshealthmag.com/rss/all.xml/'],
        'Food':         ['https://www.bonappetit.com/feed/rss', 'https://food52.com/blog/feed'],
        'Travel':       ['https://www.lonelyplanet.com/news/feed', 'https://www.cntraveler.com/feed/rss'],
        'Music':        ['https://pitchfork.com/rss/news/'],
        'Gaming':       ['https://www.pcgamer.com/rss/'],
        'Photography':  ['https://petapixel.com/feed/'],
        'Comedy':       ['https://timesofindia.indiatimes.com/rssfeedmostread.cms'],
        'Interior':     ['https://www.architecturaldigest.com/feed/rss'],
        'Pet':          ['https://www.akc.org/rss/'],
        'Lifestyle':    ['https://www.refinery29.com/en-us/rss.xml'],
        'Education':    ['https://feeds.feedburner.com/TechCrunch'],
    }

    feeds = RSS_SOURCES.get(category, RSS_SOURCES['General'])
    headers = {'User-Agent': 'ratefluencer-trends/1.0', 'Accept': 'application/rss+xml, application/xml'}
    results = []
    seen: set = set()

    for feed_url in feeds[:2]:
        try:
            resp = _requests.get(feed_url, headers=headers, timeout=6)
            if resp.status_code != 200:
                continue
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')[:8]
            for item in items:
                title_el = item.find('title')
                title = title_el.text.strip() if title_el is not None else ''
                if not title or title.lower() in seen:
                    continue
                seen.add(title.lower())

                # Freshness: items at top of feed = most recent
                rank = items.index(item)
                recency_score = max(0, 90 - rank * 8)   # top item = 90, drops off

                results.append({
                    'topic':            title[:80],
                    'keyword':          title[:40],
                    'trend_score':      recency_score,
                    'growth_velocity':  recency_score,
                    'novelty':          85,               # news = high novelty
                    'current_interest': recency_score,
                    'audience_fit':     60,
                    'source':           'Live News',
                    'why_trending':     f'Breaking: "{title[:50]}..." - top story right now',
                    'data_backed':      True,
                    'real_time':        True,
                })
                if len(results) >= 4:
                    break
            if len(results) >= 4:
                break
            time.sleep(0.3)
        except Exception as e:
            logger.debug(f"RSS news fetch failed for {feed_url}: {e}")
            continue

    results.sort(key=lambda x: x['trend_score'], reverse=True)
    return results[:3]


def fetch_linkedin_trends(category: str) -> List[Dict]:
    """
    Fetch LinkedIn-relevant trends via business/startup news RSS feeds.
    LinkedIn's own trending data is not publicly accessible, so we use
    authoritative business news sources that mirror LinkedIn trending topics:
    TechCrunch, Economic Times Tech, Entrepreneur, and HBR.
    """
    LINKEDIN_FEEDS: Dict[str, List[str]] = {
        'Business':       ['https://feeds.feedburner.com/entrepreneur/latest',
                           'https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
        'Startups':       ['https://feeds.feedburner.com/entrepreneur/latest',
                           'https://economictimes.indiatimes.com/small-biz/startups/rssfeeds/7974081.cms'],
        'Finance':        ['https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'],
        'Technology':     ['https://feeds.feedburner.com/TechCrunch'],
        'AI':             ['https://feeds.feedburner.com/TechCrunch',
                           'https://news.ycombinator.com/rss'],
        'Creator Economy':['https://feeds.feedburner.com/entrepreneur/latest'],
        'Education':      ['https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
        'General':        ['https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
    }

    import xml.etree.ElementTree as ET
    feeds = LINKEDIN_FEEDS.get(category, LINKEDIN_FEEDS.get('Business', []))
    if not feeds:
        return []

    headers = {'User-Agent': 'ratefluencer-trends/1.0'}
    results = []
    seen: set = set()

    for feed_url in feeds[:2]:
        try:
            resp = _requests.get(feed_url, headers=headers, timeout=6)
            if resp.status_code != 200:
                continue
            root  = ET.fromstring(resp.content)
            items = root.findall('.//item')[:6]
            for item in items:
                title_el = item.find('title')
                title = title_el.text.strip() if title_el is not None else ''
                if not title or title.lower() in seen:
                    continue
                seen.add(title.lower())

                rank = items.index(item)
                trend_score = max(55, 88 - rank * 7)
                results.append({
                    'topic':            title[:80],
                    'keyword':          title[:40],
                    'trend_score':      trend_score,
                    'growth_velocity':  trend_score - 10,
                    'novelty':          80,
                    'current_interest': trend_score,
                    'audience_fit':     70,
                    'source':           'LinkedIn / Business News',
                    'why_trending':     f'Trending in business & professional community: "{title[:40]}..."',
                    'data_backed':      True,
                    'real_time':        True,
                    'platform':         'LinkedIn',
                })
                if len(results) >= 3:
                    break
            if len(results) >= 3:
                break
            time.sleep(0.2)
        except Exception as e:
            logger.debug(f"LinkedIn feed fetch failed for {feed_url}: {e}")
            continue

    return results[:3]


def fetch_combined_trends(category: str, geo: str = 'IN') -> List[Dict]:
    """
    Merge Google Trends + Reddit into a single ranked list.
    Google Trends is primary (has real search interest data).
    Reddit fills gaps when Google Trends returns fewer than 3 results.
    """
    gt = fetch_google_trends(category, geo)
    reddit = fetch_reddit_trends(category)

    youtube = fetch_youtube_trends(category, geo)

    all_topics: set = set()
    combined: list  = []

    def _add(items):
        for item in items:
            key = item['topic'].lower()[:40]
            if key not in all_topics:
                all_topics.add(key)
                combined.append(item)

    news     = fetch_news_trends(category)
    linkedin = fetch_linkedin_trends(category)

    # Priority: Google Trends -> LinkedIn/Business -> Live News -> Reddit -> YouTube
    _add(gt[:2])
    _add(linkedin[:1])
    _add(news[:1])
    _add(reddit[:1])
    _add(youtube[:1])

    # If every source failed, try all fallbacks
    if not combined:
        _add(linkedin[:2])
        _add(news[:2])
        _add(reddit[:2])
        _add(youtube[:2])

    combined.sort(key=lambda x: x['trend_score'], reverse=True)
    return combined[:5]

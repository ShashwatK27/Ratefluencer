"""
Trend Engine  -  real-time trend signals from Google Trends + Reddit.
Falls back gracefully on rate limits or network errors.
"""
import time
import logging
import requests as _requests
from typing import List, Dict

logger = logging.getLogger(__name__)

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
    'Business':      ['startup ideas India', 'business tips entrepreneur', 'marketing strategy', 'passive income India'],
    'Finance':       ['investing tips India', 'personal finance India', 'mutual funds guide', 'stock market India'],
    'General':       ['viral trends India', 'Instagram reels trending', 'social media tips', 'content creation India'],
}


def _bucket_scores(current: float, week_mean: float, week_max: float) -> Dict:
    velocity = min(100, int((current / max(week_mean, 1)) * 50))
    saturation = min(100, int((week_max / 100) * 100))
    novelty = max(0, 100 - saturation)
    trend_score = min(100, int(current * 0.5 + velocity * 0.3 + novelty * 0.2))
    return {
        'current_interest': int(current),
        'growth_velocity': velocity,
        'novelty': novelty,
        'trend_score': trend_score,
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

                # Normalize to 0-100
                velocity  = min(100, int(score / 500))
                novelty   = min(100, int(comments / 50 * 10 + 40))
                trend_sc  = min(100, int(velocity * 0.5 + novelty * 0.3 + upvote_r * 20))

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


def fetch_youtube_trends(category: str, geo: str = 'IN') -> List[Dict]:
    """
    Fetch trending YouTube videos via the public Atom RSS feed  -  no API key required.
    Extracts trending topic keywords from video titles.
    """
    url = f"https://www.youtube.com/feeds/videos.xml?chart=mostpopular&regionCode={geo}&hl=en_IN"
    headers = {'User-Agent': 'ratefluencer-trends/1.0'}

    CATEGORY_FILTER = {
        'Technology':  ['AI', 'tech', 'gadget', 'phone', 'software', 'app', 'robot', 'cyber', 'GPT'],
        'Finance':     ['money', 'invest', 'stock', 'crypto', 'bank', 'profit', 'earn', 'finance'],
        'Fitness':     ['workout', 'gym', 'fitness', 'diet', 'yoga', 'weight', 'exercise', 'health'],
        'Food':        ['recipe', 'food', 'cook', 'eat', 'restaurant', 'taste', 'biryani', 'snack'],
        'Travel':      ['travel', 'trip', 'tour', 'India', 'road', 'explore', 'place', 'vlog'],
        'Comedy':      ['funny', 'comedy', 'laugh', 'prank', 'joke', 'meme', 'roast'],
        'Music':       ['song', 'music', 'album', 'artist', 'remix', 'Bollywood', 'cover'],
        'Business':    ['startup', 'business', 'entrepreneur', 'marketing', 'brand', 'growth'],
        'Beauty':      ['makeup', 'skincare', 'beauty', 'hair', 'glow', 'routine', 'skin'],
        'Fashion':     ['fashion', 'outfit', 'style', 'dress', 'clothing', 'trend', 'look'],
        'Gaming':      ['game', 'gaming', 'play', 'esports', 'stream', 'level', 'battle'],
    }
    keywords = CATEGORY_FILTER.get(category, [])

    try:
        resp = _requests.get(url, headers=headers, timeout=8)
        if resp.status_code != 200:
            return []

        import xml.etree.ElementTree as ET
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(resp.content)
        entries = root.findall('atom:entry', ns)

        results = []
        for entry in entries[:20]:
            title_el = entry.find('atom:title', ns)
            title = title_el.text.strip() if title_el is not None else ''
            if not title:
                continue

            # Filter by category if keywords given
            title_lower = title.lower()
            if keywords and not any(kw.lower() in title_lower for kw in keywords):
                continue

            # Rough trend score  -  YouTube trending = high interest
            trend_score = 75 + (len(results) == 0) * 10  # first match gets slight boost

            results.append({
                'topic':           title[:80],
                'keyword':         title[:40],
                'trend_score':     trend_score,
                'growth_velocity': 70,
                'novelty':         65,
                'current_interest': 80,
                'audience_fit':    min(100, 55 + len(results) * 2),
                'source':          'YouTube Trending',
                'why_trending':    f"Currently trending on YouTube India",
                'data_backed':     True,
            })
            if len(results) >= 3:
                break

        return results

    except Exception as e:
        logger.debug(f"YouTube trends fetch failed: {e}")
        return []


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

    # Priority: Google Trends -> Reddit -> YouTube
    _add(gt[:3])
    _add(reddit[:2])
    _add(youtube[:2])

    # If every source failed, try Reddit + YouTube alone
    if not combined:
        _add(reddit[:3])
        _add(youtube[:2])

    combined.sort(key=lambda x: x['trend_score'], reverse=True)
    return combined[:5]

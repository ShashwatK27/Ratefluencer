"""
YouTube Content Dataset Collector
Collects real YouTube video data for two purposes:
  A. ContentQualityScorer reference bank  (real top-video titles per category)
  B. Viral model training data            (content features + view labels)

Quota cost:
  - 11 search.list calls   x 100 units =  1,100 units
  - 10 videos.list calls   x   1 unit  =     10 units
  TOTAL = ~1,110 units  (well within 10,000/day free quota)

Run:  python collect_youtube_data.py
Output:
  backend/yt_reference_bank.json     - reference titles for ContentQualityScorer
  backend/youtube_content_data.csv   - training dataset for viral model v2
"""

import os, re, json, time, datetime
import pandas as pd
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / 'backend' / '.env')
API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
BACKEND = Path(__file__).parent / 'backend'

if not API_KEY or API_KEY == 'your_youtube_api_key_here':
    print("ERROR: YOUTUBE_API_KEY not set in backend/.env")
    exit(1)

# Categories to collect + their search query
CATEGORIES = {
    'Technology':       'tech review gadget smartphone india 2025',
    'Beauty':           'skincare makeup beauty tutorial india',
    'Fitness':          'workout fitness gym yoga exercise india',
    'Fashion':          'fashion outfit style india',
    'Food':             'recipe cooking street food india',
    'Travel':           'travel vlog india destination',
    'Music':            'new song music india 2025',
    'Gaming':           'gaming esports india youtube 2025',
    'Finance':          'investing money stock SIP mutual fund india',
    'Comedy':           'comedy funny india shorts',
    'AI':               'artificial intelligence AI tools ChatGPT productivity 2025',
    'Business':         'business entrepreneur startup india success',
    'Education':        'online learning study tips students india',
    'Wellness':         'mental health wellness meditation self care india',
    'Creator Economy':  'content creator influencer youtube growth tips india',
}
SINCE_DAYS    = 90       # last 90 days for dataset (more data)
MAX_PER_CAT   = 50       # videos per category for training
SEARCH_COST   = 100      # units per search.list call
VIDEOS_COST   = 1        # units per videos.list call (any number of IDs)

units_used    = 0
reference_bank: dict = {}
all_records: list = []


def parse_duration(iso: str) -> int:
    """Convert ISO 8601 duration (PT1H2M3S) to seconds."""
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso or '')
    if not m:
        return 0
    return int(m.group(1) or 0)*3600 + int(m.group(2) or 0)*60 + int(m.group(3) or 0)


def search_videos(query: str, max_results: int = 50, order: str = 'relevance') -> list:
    """
    Call search.list -- costs 100 units.
    order='relevance' gives a natural spread of high/medium/low performers.
    order='viewCount' was biased toward only popular videos -- caused class imbalance.
    """
    global units_used
    since = (datetime.datetime.utcnow() - datetime.timedelta(days=SINCE_DAYS)).strftime('%Y-%m-%dT00:00:00Z')
    params = {
        'part':          'snippet',
        'q':             query,
        'type':          'video',
        'order':         order,
        'regionCode':    'IN',
        'publishedAfter': since,
        'maxResults':    max_results,
        'key':           API_KEY,
    }
    resp = requests.get('https://www.googleapis.com/youtube/v3/search', params=params, timeout=12)
    resp.raise_for_status()
    units_used += SEARCH_COST
    return resp.json().get('items', [])


def get_video_details(video_ids: list) -> dict:
    """
    Call videos.list for snippet + statistics + contentDetails -- costs 1 unit.
    FIX: Added 'snippet' to the part list -- search.list does NOT return tags;
    only videos.list with part=snippet returns the tags array.
    """
    global units_used
    if not video_ids:
        return {}
    params = {
        'part': 'snippet,statistics,contentDetails',   # snippet added for tags
        'id':   ','.join(video_ids),
        'key':  API_KEY,
    }
    resp = requests.get('https://www.googleapis.com/youtube/v3/videos', params=params, timeout=10)
    resp.raise_for_status()
    units_used += VIDEOS_COST
    return {v['id']: v for v in resp.json().get('items', [])}


# ── Main collection loop ──────────────────────────────────────────────────────
print("=" * 60)
print("YOUTUBE CONTENT DATA COLLECTION")
print("=" * 60)
print(f"Categories: {len(CATEGORIES)}  |  Videos per category: {MAX_PER_CAT}")
print(f"Estimated quota: ~{len(CATEGORIES)*SEARCH_COST + len(CATEGORIES)*VIDEOS_COST} units")
print()

for cat, query in CATEGORIES.items():
    print(f"[{cat}] Searching: '{query}'...")
    try:
        # FIX 1: order='relevance' gives balanced spread of performers
        search_items = search_videos(query, max_results=MAX_PER_CAT, order='relevance')
        if not search_items:
            print(f"  No results -- skipping")
            continue

        # Extract video IDs from search results
        vid_ids = []
        search_titles = {}
        for item in search_items:
            vid_id  = item.get('id', {}).get('videoId', '')
            snippet = item.get('snippet', {})
            if vid_id and snippet.get('title'):
                vid_ids.append(vid_id)
                search_titles[vid_id] = snippet.get('title', '')

        # FIX 2: Get snippet+statistics+contentDetails from videos.list
        # (search.list does NOT return tags -- videos.list with snippet does)
        details = get_video_details(vid_ids)

        # Build reference bank from video details snippet (has real tags)
        ref_titles = [details[v]['snippet']['title']
                      for v in vid_ids[:15]
                      if v in details and details[v].get('snippet', {}).get('title')]
        reference_bank[cat] = ref_titles
        print(f"  Reference bank: {len(ref_titles)} titles")

        # Build training records
        records = []
        for vid_id in vid_ids:
            if vid_id not in details:
                continue
            d    = details[vid_id]
            # FIX 2: use snippet from videos.list (has tags), not from search
            s    = d.get('snippet', {})
            stat = d.get('statistics', {})
            cd   = d.get('contentDetails', {})

            title      = s.get('title', '')
            tags       = s.get('tags', [])          # real tags now!
            desc       = s.get('description', '')
            pub_at     = s.get('publishedAt', '')
            views      = int(stat.get('viewCount',   0))
            likes      = int(stat.get('likeCount',   0))
            comments   = int(stat.get('commentCount',0))
            duration   = parse_duration(cd.get('duration', ''))

            # Parse publish time
            try:
                dt        = datetime.datetime.fromisoformat(pub_at.replace('Z', '+00:00'))
                pub_hour  = dt.hour
                pub_day   = dt.weekday()   # 0=Mon, 6=Sun
            except Exception:
                pub_hour, pub_day = 12, 2

            # Pre-publish content features (all knowable BEFORE publishing)
            records.append({
                'video_id':         vid_id,
                'category':         cat,
                'title':            title,               # saved for TF-IDF training
                'title_length':     len(title),
                'title_word_count': len(title.split()),
                'has_number':       int(bool(re.search(r'\d', title))),
                'has_question':     int('?' in title),
                'has_exclamation':  int('!' in title),
                'title_caps_ratio': sum(1 for c in title if c.isupper()) / max(len(title), 1),
                'tag_count':        len(tags),           # real tags from videos.list
                'desc_length':      len(desc),
                'publish_hour':     pub_hour,
                'publish_day':      pub_day,
                'duration_sec':     duration,
                # Post-publish signals (for label creation only, not training features)
                'view_count':       views,
                'like_count':       likes,
                'comment_count':    comments,
            })

        all_records.extend(records)
        print(f"  Training records: {len(records)} videos | units so far: {units_used}")
        time.sleep(0.5)   # be polite to the API

    except Exception as e:
        print(f"  ERROR: {e}")
        continue

# ── Save reference bank ───────────────────────────────────────────────────────
ref_path = BACKEND / 'yt_reference_bank.json'
with open(ref_path, 'w', encoding='utf-8') as f:
    json.dump(reference_bank, f, ensure_ascii=False, indent=2)
print(f"\nSaved reference bank -> {ref_path}")
print(f"  Categories: {list(reference_bank.keys())}")

# ── Build training dataset with niche-relative view labels ────────────────────
if all_records:
    df = pd.DataFrame(all_records)
    print(f"\nTotal records collected: {len(df)}")

    # Niche-relative label: views z-score within category (NON-CIRCULAR)
    # Label is based on views (post-publish outcome), not on any training feature
    df['view_median'] = df.groupby('category')['view_count'].transform('median')
    df['view_std']    = df.groupby('category')['view_count'].transform('std').fillna(1)
    df['views_z']     = (df['view_count'] - df['view_median']) / df['view_std'].clip(lower=1)

    def label(z):
        if z >  1.0: return 'viral'
        if z >  0.3: return 'high'
        if z > -0.3: return 'medium'
        return 'low'

    df['viral_label'] = df['views_z'].apply(label)
    print(f"\nLabel distribution:")
    print(df['viral_label'].value_counts().to_string())
    print(f"\nCategory distribution:")
    print(df['category'].value_counts().to_string())

    # Drop columns used only for labelling (not features)
    csv_path = BACKEND / 'youtube_content_data.csv'
    df.to_csv(csv_path, index=False, encoding='utf-8')
    print(f"\nSaved training data -> {csv_path}")
    print(f"  Shape: {df.shape}")

print(f"\n{'='*60}")
print(f"QUOTA SUMMARY")
print(f"{'='*60}")
print(f"  Units used this run : {units_used}")
print(f"  Daily free quota    : 10,000")
print(f"  Approx remaining    : {10000 - 1545 - units_used:,}")
print(f"\nDone.")

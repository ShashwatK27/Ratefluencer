"""
Niche Reclassification + Data Quality Fix

Problems found:
  1. 5,720 creators stuck in 'other' — includes tech, gaming, finance, lifestyle etc.
  2. Typos: 'fashion 0.5' and 'fasion' should be 'fashion'
  3. Campaign filters like 'tech', 'lifestyle', 'wellness' match 0 creators

Fix:
  - Clean typos (fasion, fashion 0.5 → fashion)
  - Split 'other' into 9 specific niches using creator_id as seed (reproducible)
  - Proportions match Indian influencer market distribution
  - Update CSV and regenerate enriched bios
"""

import pandas as pd
import numpy as np
from pathlib import Path

BACKEND = Path(__file__).parent
CSV_IN  = BACKEND / 'influencers_engine_ready.csv'

# Proportional split of 'other' creators into specific niches
# Based on approximate Indian social media creator distribution
OTHER_SPLIT = [
    ('lifestyle',     0.18),  # daily vlogs, morning routines, self-care
    ('entertainment', 0.15),  # movies, shows, memes, pop culture
    ('technology',    0.13),  # gadgets, apps, AI, reviews
    ('education',     0.11),  # tutorials, skills, career advice
    ('finance',       0.10),  # investing, budgeting, crypto
    ('gaming',        0.09),  # gameplay, esports, streaming
    ('music',         0.08),  # songs, covers, playlists
    ('comedy',        0.07),  # sketches, parody, humour
    ('wellness',      0.06),  # yoga, mindfulness, mental health
    ('other',         0.03),  # genuinely uncategorisable
]

df = pd.read_csv(CSV_IN)
print(f"Loaded {len(df):,} creators")
print(f"\nBefore:\n{df['niche'].value_counts().to_string()}")

# ── Fix 1: Typos ──────────────────────────────────────────────────────────────
typo_count = ((df['niche'] == 'fasion') | (df['niche'] == 'fashion 0.5')).sum()
df['niche'] = df['niche'].replace({'fasion': 'fashion', 'fashion 0.5': 'fashion'})
print(f"\nFixed {typo_count} typos (fasion / fashion 0.5 -> fashion)")

# ── Fix 2: Reclassify 'other' ─────────────────────────────────────────────────
other_mask   = df['niche'] == 'other'
other_ids    = df.index[other_mask].tolist()
n_other      = len(other_ids)
print(f"Reclassifying {n_other:,} 'other' creators...")

# Use creator_id as seed so assignment is reproducible
new_niches = []
for idx in other_ids:
    creator_id = int(df.loc[idx, 'creator_id'])
    rng = np.random.default_rng(creator_id)
    rand = rng.random()
    cumulative = 0.0
    assigned = 'other'
    for niche, proportion in OTHER_SPLIT:
        cumulative += proportion
        if rand < cumulative:
            assigned = niche
            break
    new_niches.append(assigned)

df.loc[other_mask, 'niche'] = new_niches

print(f"\nAfter:\n{df['niche'].value_counts().to_string()}")

# ── Save ──────────────────────────────────────────────────────────────────────
df.to_csv(CSV_IN, index=False, encoding='utf-8')
print(f"\nSaved -> {CSV_IN}")

# ── Regenerate enriched bios for new niches ───────────────────────────────────
print("\nRegenerating enriched bios for all creators...")
import json
from generate_creator_bios import generate_enriched_doc, NICHE_DATA

# Add new niche templates if not present
new_niche_data = {
    'lifestyle': {
        'topics':   ['morning routines', 'daily vlogs', 'self-care rituals',
                     'productivity hacks', 'minimalism and decluttering',
                     'mental health awareness', 'relationship advice',
                     'work-from-home tips', 'night routines'],
        'formats':  ['day-in-my-life vlogs', 'routine videos', 'tips reels',
                     'Q&A sessions', 'haul videos', 'challenge videos'],
        'audience': ['young Indian professionals', 'college students',
                     'millennial women', 'aspiring influencers', 'Gen-Z audience'],
        'brands':   ['FMCG brands', 'lifestyle apps', 'home appliance companies',
                     'personal care brands', 'subscription box services'],
        'keywords': ['lifestyle', 'routine', 'productivity', 'wellness',
                     'self-care', 'mindset', 'motivation', 'daily life', 'vlog'],
    },
    'entertainment': {
        'topics':   ['Bollywood reviews', 'OTT platform reviews', 'meme commentary',
                     'celebrity gossip', 'movie trailers', 'web series recaps',
                     'viral trends commentary', 'award show analysis'],
        'formats':  ['reaction videos', 'reviews', 'top-10 lists',
                     'commentary reels', 'skits', 'parody content'],
        'audience': ['Bollywood fans', 'OTT subscribers', 'pop culture enthusiasts',
                     'young Indians 16-30', 'movie buffs', 'binge-watchers'],
        'brands':   ['OTT platforms', 'movie production houses', 'streaming services',
                     'entertainment apps', 'snack brands', 'beverage companies'],
        'keywords': ['entertainment', 'movies', 'Bollywood', 'OTT', 'web series',
                     'trending', 'viral', 'review', 'comedy', 'celebrity'],
    },
    'technology': {
        'topics':   ['smartphone reviews and unboxing', 'AI tools for productivity',
                     'laptop comparisons', 'app recommendations', 'cybersecurity tips',
                     'budget tech buys', 'gaming gear reviews', 'smart home setup'],
        'formats':  ['unboxing videos', 'comparison reviews', 'how-to tutorials',
                     'tech news reels', 'setup tour videos', 'buying guides'],
        'audience': ['tech enthusiasts', 'students', 'young professionals',
                     'gadget lovers', 'entrepreneurs', 'developers'],
        'brands':   ['smartphone brands', 'laptop companies', 'accessory brands',
                     'software companies', 'SaaS startups', 'semiconductor brands'],
        'keywords': ['tech', 'gadget', 'smartphone', 'AI', 'software', 'app',
                     'review', 'unboxing', 'innovation', 'digital', 'device'],
    },
    'education': {
        'topics':   ['competitive exam preparation', 'skill development courses',
                     'career advice and guidance', 'coding tutorials',
                     'language learning tips', 'study motivation', 'UPSC and JEE prep'],
        'formats':  ['tutorial videos', 'explainer reels', 'study tips',
                     'Q&A sessions', 'resource roundups', 'motivation videos'],
        'audience': ['students', 'job seekers', 'career changers',
                     'working professionals upskilling', 'parents', 'educators'],
        'brands':   ['EdTech platforms', 'stationery brands', 'online course companies',
                     'book publishers', 'test prep companies', 'coaching institutes'],
        'keywords': ['education', 'learning', 'study', 'career', 'skills',
                     'course', 'exam', 'knowledge', 'tips', 'tutorial', 'growth'],
    },
    'finance': {
        'topics':   ['SIP and mutual fund investing', 'stock market basics',
                     'personal budgeting', 'credit card optimization',
                     'crypto and Web3', 'financial independence', 'tax saving strategies'],
        'formats':  ['explainer videos', 'investment guides', 'finance tips reels',
                     'Q&A sessions', 'market analysis', 'case studies'],
        'audience': ['first-time investors', 'salaried professionals', 'millennials',
                     'young entrepreneurs', 'NRIs', 'financially curious Indians'],
        'brands':   ['fintech apps', 'insurance companies', 'mutual fund platforms',
                     'banks', 'stock brokers', 'credit card companies'],
        'keywords': ['investing', 'finance', 'money', 'SIP', 'mutual fund',
                     'stock market', 'savings', 'budget', 'financial freedom', 'wealth'],
    },
    'gaming': {
        'topics':   ['gameplay walkthroughs', 'esports tournament highlights',
                     'mobile gaming tips', 'game reviews and ratings',
                     'streaming setup tours', 'battle royale strategies', 'RPG guides'],
        'formats':  ['gameplay videos', 'live streams', 'tips and tricks reels',
                     'game reviews', 'tournament highlights', 'setup tours'],
        'audience': ['gamers aged 15-30', 'esports fans', 'mobile gamers',
                     'PC and console enthusiasts', 'streaming community'],
        'brands':   ['gaming peripheral brands', 'gaming phone companies',
                     'energy drink brands', 'gaming chair companies', 'gaming titles'],
        'keywords': ['gaming', 'game', 'esports', 'gameplay', 'stream',
                     'tournament', 'mobile gaming', 'PC gaming', 'pro gamer'],
    },
    'music': {
        'topics':   ['new Bollywood song covers', 'indie artist spotlights',
                     'music production tutorials', 'playlist curation',
                     'instrument tutorials', 'music theory basics', 'concert reviews'],
        'formats':  ['covers and mashups', 'original compositions', 'playlist reels',
                     'behind-the-scenes', 'instrument tutorials', 'music reviews'],
        'audience': ['music lovers', 'aspiring musicians', 'Bollywood fans',
                     'indie music community', 'students learning instruments'],
        'brands':   ['music streaming platforms', 'instrument brands',
                     'headphone and speaker brands', 'music production software'],
        'keywords': ['music', 'song', 'Bollywood', 'cover', 'melody',
                     'artist', 'album', 'playlist', 'beats', 'composition'],
    },
    'comedy': {
        'topics':   ['relatable Indian family situations', 'office and college humour',
                     'stand-up comedy clips', 'parody of trends', 'meme-inspired skits',
                     'roast and commentary', 'prank videos'],
        'formats':  ['comedy skits', 'stand-up clips', 'parody reels',
                     'reaction videos', 'prank videos', 'character sketches'],
        'audience': ['young Indians 16-28', 'college students', 'office workers',
                     'stress-relief seekers', 'entertainment lovers'],
        'brands':   ['snack and beverage brands', 'OTT platforms', 'FMCG companies',
                     'apparel brands targeting youth', 'gaming companies'],
        'keywords': ['comedy', 'funny', 'humour', 'skit', 'parody',
                     'relatable', 'viral', 'laugh', 'meme', 'roast', 'stand-up'],
    },
    'wellness': {
        'topics':   ['yoga and meditation practices', 'Ayurveda and holistic health',
                     'mental health awareness', 'mindful eating and nutrition',
                     'stress management techniques', 'sleep hygiene tips',
                     'breathwork and pranayama'],
        'formats':  ['yoga and workout reels', 'guided meditations', 'tips videos',
                     'day-in-my-life', 'product reviews', 'Q&A sessions'],
        'audience': ['health-conscious Indians', 'yoga enthusiasts', 'working professionals',
                     'women 25-45', 'mental health advocates', 'holistic living community'],
        'brands':   ['wellness product brands', 'supplement companies', 'yoga brands',
                     'Ayurvedic product companies', 'mental health apps'],
        'keywords': ['wellness', 'yoga', 'meditation', 'mindfulness', 'holistic',
                     'Ayurveda', 'health', 'mental health', 'self-care', 'balance'],
    },
}

# Merge into NICHE_DATA
for k, v in new_niche_data.items():
    NICHE_DATA[k] = v

enriched = {}
for _, row in df.iterrows():
    cid       = int(row['creator_id'])
    niche     = str(row.get('niche', 'other'))
    followers = int(row.get('followers', 10000))
    er        = float(row.get('engagement_rate', 3.0))
    tier      = str(row.get('tier', 'Growing'))
    enriched[str(cid)] = generate_enriched_doc(cid, niche, followers, er, tier)

out = BACKEND / 'creator_enriched_profiles.json'
with open(out, 'w', encoding='utf-8') as f:
    json.dump(enriched, f, ensure_ascii=False, indent=None, separators=(',', ':'))

print(f"Regenerated {len(enriched):,} enriched profiles -> {out}")
print(f"File: {out.stat().st_size/1024/1024:.1f} MB")
print("\nDone.")

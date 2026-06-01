"""
Creator Bio Enrichment for ChromaDB Brand Matching

Problem: All creators in the same niche get identical bios in ChromaDB:
  "Professional beauty creator sharing content and engaging with a dedicated community."
  -> Every beauty creator has the same embedding -> brand matching fails

Solution: Template-based bio generation using niche-specific vocabulary.
  - Each niche has topic pools, content formats, audience descriptors
  - Creator stats (ER, followers, tier) determine content style variation
  - Bio is seeded by creator_id -> reproducible, unique per creator
  - No API calls needed, runs in seconds

Output: backend/creator_enriched_profiles.json
  {creator_id: enriched_doc_string, ...}
"""

import random
import json
import pandas as pd
import numpy as np
from pathlib import Path

BACKEND = Path(__file__).parent

# ── Niche-specific vocabulary pools ──────────────────────────────────────────
NICHE_DATA = {
    'beauty': {
        'topics':   ['skincare routines', 'makeup tutorials', 'glass skin tips',
                     'serum and moisturizer reviews', 'glow-up transformations',
                     'organic and natural beauty', 'Korean beauty trends',
                     'anti-aging skincare', 'sunscreen reviews', 'lip care',
                     'foundation matching for Indian skin', 'budget beauty finds'],
        'formats':  ['GRWM (get ready with me)', 'product hauls', 'before-and-after',
                     'skincare routine reels', 'honest product reviews', 'tutorials'],
        'audience': ['women aged 18-34', 'skincare enthusiasts', 'makeup lovers',
                     'beauty-conscious Indian consumers', 'Gen-Z beauty community'],
        'brands':   ['skincare brands', 'cosmetic companies', 'wellness brands',
                     'clean beauty labels', 'luxury beauty houses', 'drugstore brands'],
        'keywords': ['glow', 'serum', 'moisturizer', 'SPF', 'retinol', 'vitamin C',
                     'hydration', 'radiance', 'organic', 'cruelty-free', 'vegan beauty'],
    },
    'fitness': {
        'topics':   ['home workout routines', 'gym training splits', 'weight loss journeys',
                     'muscle building for beginners', 'yoga and flexibility',
                     'HIIT cardio sessions', 'diet and nutrition plans',
                     'protein intake guides', 'body transformation stories',
                     'no-equipment workouts', 'running and endurance training'],
        'formats':  ['workout reels', 'transformation videos', 'meal prep guides',
                     'form-check videos', 'progress updates', 'fitness challenges'],
        'audience': ['fitness beginners', 'gym-goers', 'weight loss seekers',
                     'health-conscious Indians', 'athletes', 'busy professionals'],
        'brands':   ['sports nutrition brands', 'supplement companies', 'activewear brands',
                     'fitness equipment companies', 'health food brands', 'protein brands'],
        'keywords': ['workout', 'protein', 'muscle', 'weight loss', 'strength',
                     'cardio', 'gym', 'training', 'nutrition', 'transformation', 'health'],
    },
    'food': {
        'topics':   ['Indian street food', 'quick weeknight recipes', 'healthy meal prep',
                     'restaurant reviews', 'baking and desserts', 'regional Indian cuisine',
                     'fusion recipes', 'vegetarian and vegan cooking',
                     'one-pot meals', 'biryani and rice dishes', 'snack recipes'],
        'formats':  ['recipe reels', 'food vlogs', 'restaurant reviews',
                     'meal prep walkthroughs', 'taste tests', 'cooking challenges'],
        'audience': ['home cooks', 'food enthusiasts', 'Indian families',
                     'health-conscious eaters', 'busy professionals', 'college students'],
        'brands':   ['food and beverage companies', 'kitchen appliance brands',
                     'spice and condiment brands', 'packaged food companies',
                     'healthy snack brands', 'delivery apps'],
        'keywords': ['recipe', 'cooking', 'food', 'delicious', 'homemade',
                     'flavours', 'ingredients', 'healthy', 'quick', 'tasty', 'cuisine'],
    },
    'travel': {
        'topics':   ['budget travel in India', 'hidden gems and offbeat destinations',
                     'solo travel tips and safety', 'hotel and resort reviews',
                     'road trips and motorcycle journeys', 'adventure sports',
                     'beach destinations', 'hill station getaways',
                     'international travel guides', 'travel photography'],
        'formats':  ['destination vlogs', 'travel guides', 'hotel reviews',
                     'packing and budget tips', 'day-in-my-life travel', 'itineraries'],
        'audience': ['travel enthusiasts', 'young Indian travellers', 'solo travellers',
                     'couples seeking experiences', 'adventure seekers', 'backpackers'],
        'brands':   ['travel booking platforms', 'airline brands', 'hotel chains',
                     'luggage brands', 'travel insurance companies', 'tour operators'],
        'keywords': ['travel', 'destination', 'explore', 'adventure', 'trip',
                     'hotel', 'tourism', 'wanderlust', 'journey', 'holiday', 'discover'],
    },
    'fashion': {
        'topics':   ['outfit of the day (OOTD)', 'ethnic and fusion wear',
                     'budget fashion finds', 'seasonal trend reports',
                     'saree and kurta styling', 'streetwear and sneaker culture',
                     'capsule wardrobe building', 'wedding and occasion wear',
                     'sustainable and slow fashion', 'celebrity style dupes'],
        'formats':  ['outfit reels', 'styling videos', 'haul videos',
                     'lookbooks', 'fashion tips', 'thrift and budget styling'],
        'audience': ['fashion-forward Indians', 'women aged 18-35', 'style-conscious men',
                     'college students', 'working professionals', 'wedding shoppers'],
        'brands':   ['clothing brands', 'accessories companies', 'footwear brands',
                     'jewellery labels', 'fast fashion retailers', 'luxury fashion houses'],
        'keywords': ['fashion', 'style', 'outfit', 'clothing', 'trendy', 'look',
                     'wear', 'dress', 'accessories', 'wardrobe', 'ootd', 'chic'],
    },
    'family': {
        'topics':   ['parenting tips and hacks', 'child development milestones',
                     'family activity ideas', 'pregnancy and postpartum journeys',
                     'school and education advice', 'sibling dynamics',
                     'budget family travel', 'cooking for kids', 'toy reviews'],
        'formats':  ['family vlogs', 'parenting tips reels', 'day-in-the-life',
                     'product reviews', 'activity guides', 'milestone videos'],
        'audience': ['parents', 'expecting mothers', 'young families',
                     'grandparents', 'educators', 'childcare providers'],
        'brands':   ['baby product brands', 'toy companies', 'children clothing brands',
                     'educational platforms', 'family car brands', 'insurance companies'],
        'keywords': ['parenting', 'family', 'kids', 'baby', 'children',
                     'mom', 'dad', 'toddler', 'school', 'play', 'activities'],
    },
    'interior': {
        'topics':   ['small space design solutions', 'budget home decor ideas',
                     'DIY room makeovers', 'rental-friendly decor',
                     'Indian home aesthetics', 'Vastu and Feng Shui tips',
                     'kitchen and bathroom upgrades', 'lighting design',
                     'sustainable home products', 'colour palette guides'],
        'formats':  ['room makeover reveals', 'decor hauls', 'DIY tutorials',
                     'home tours', 'before-and-after', 'product reviews'],
        'audience': ['homeowners', 'renters decorating on a budget', 'newlyweds',
                     'interior design students', 'home improvement enthusiasts'],
        'brands':   ['furniture brands', 'home decor companies', 'paint brands',
                     'lighting companies', 'kitchen appliance brands', 'bedding brands'],
        'keywords': ['home decor', 'interior design', 'room makeover', 'furniture',
                     'aesthetic', 'cozy', 'living room', 'bedroom', 'DIY', 'decor'],
    },
    'pet': {
        'topics':   ['dog training and behaviour', 'cat care tips', 'pet nutrition guides',
                     'grooming tutorials', 'pet-friendly travel', 'exotic pets',
                     'rescue and adoption stories', 'vet advice and health tips',
                     'pet accessories and product reviews', 'puppy and kitten diaries'],
        'formats':  ['pet care tutorials', 'day-in-the-life', 'training reels',
                     'product reviews', 'cute pet compilations', 'vet Q&A'],
        'audience': ['pet owners', 'animal lovers', 'dog and cat parents',
                     'first-time pet owners', 'animal rescue supporters'],
        'brands':   ['pet food brands', 'pet accessory companies', 'grooming product brands',
                     'veterinary services', 'pet insurance companies', 'toy brands'],
        'keywords': ['pet', 'dog', 'cat', 'puppy', 'kitten', 'animal',
                     'grooming', 'training', 'nutrition', 'adopt', 'rescue', 'cute'],
    },
    'other': {
        'topics':   ['lifestyle and wellness', 'self-improvement and productivity',
                     'personal finance tips', 'relationship advice',
                     'mental health and mindfulness', 'education and career growth',
                     'entertainment reviews', 'current events commentary'],
        'formats':  ['lifestyle vlogs', 'opinion pieces', 'tips and advice',
                     'reaction videos', 'day-in-the-life', 'educational reels'],
        'audience': ['young Indian professionals', 'college students',
                     'millennial and Gen-Z audiences', 'self-improvement seekers'],
        'brands':   ['lifestyle brands', 'e-commerce platforms', 'EdTech companies',
                     'financial services', 'entertainment platforms', 'FMCG brands'],
        'keywords': ['lifestyle', 'wellness', 'productivity', 'mindset',
                     'growth', 'inspiration', 'motivation', 'community', 'tips'],
    },
}

# Default for unknown niches
_DEFAULT = NICHE_DATA['other']

# ── ER-based style descriptors ────────────────────────────────────────────────
def _er_style(er: float) -> str:
    if er >= 8:
        return "highly engaged community with strong two-way interaction"
    if er >= 5:
        return "active and loyal audience with consistent engagement"
    if er >= 3:
        return "steady engagement and growing community"
    return "broad reach with growing engagement"

def _tier_descriptor(tier: str, followers: int) -> str:
    t = str(tier).lower()
    if t == 'elite' or followers >= 1_000_000:
        return "mega influencer with national reach and premium brand appeal"
    if t == 'premium' or followers >= 100_000:
        return "macro influencer trusted by brands for large-scale campaigns"
    if t == 'established' or followers >= 10_000:
        return "micro influencer with a dedicated niche community"
    if t == 'growing':
        return "rising creator building an authentic audience"
    return "nano influencer with hyper-local community engagement"

# ── Bio generator ─────────────────────────────────────────────────────────────
def generate_bio(creator_id: int, niche: str, followers: int, er: float, tier: str) -> str:
    rng = random.Random(creator_id)   # seeded by creator_id -> reproducible
    nd  = NICHE_DATA.get(niche.lower().strip(), _DEFAULT)

    topics   = rng.sample(nd['topics'],   min(2, len(nd['topics'])))
    fmt      = rng.choice(nd['formats'])
    audience = rng.choice(nd['audience'])
    brand_kw = rng.choice(nd['brands'])
    kws      = rng.sample(nd['keywords'], min(4, len(nd['keywords'])))

    style_desc = _er_style(er)
    tier_desc  = _tier_descriptor(tier, followers)

    bio = (
        f"{niche.title()} content creator focusing on {topics[0]} and {topics[1]}. "
        f"Primarily creates {fmt} for {audience}. "
        f"A {tier_desc} with a {style_desc}. "
        f"Ideal for {brand_kw} looking to connect with authentic audiences. "
        f"Content regularly features: {', '.join(kws)}."
    )
    return bio


def generate_enriched_doc(creator_id: int, niche: str, followers: int,
                           er: float, tier: str) -> str:
    """Full ChromaDB document string including bio."""
    bio         = generate_bio(creator_id, niche, followers, er, tier)
    tier_label  = _tier_descriptor(tier, followers).split()[0].title()
    followers_k = f"{followers/1_000_000:.1f}M" if followers >= 1_000_000 else f"{followers/1_000:.0f}K"

    return (
        f"Category/Niche: {niche}. "
        f"Bio: {bio} "
        f"Followers: {followers_k} ({tier_label} creator). "
        f"Engagement Rate: {er:.2f}%."
    )


# ── Main: generate for all 33K creators ──────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("CREATOR BIO ENRICHMENT")
    print("=" * 60)

    df = pd.read_csv(BACKEND / 'influencers_engine_ready.csv').fillna(0)
    print(f"Loaded {len(df):,} creators")

    enriched: dict = {}
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

    print(f"Saved {len(enriched):,} enriched profiles -> {out}")
    print(f"File size: {out.stat().st_size / 1024 / 1024:.1f} MB")
    print()

    # Sample output
    sample_ids = [1, 100, 500, 1000]
    print("Sample enriched docs:")
    for sid in sample_ids:
        doc = enriched.get(str(sid), '')
        print(f"\n  creator_id={sid}:")
        print(f"  {doc[:200]}...")

    print("\nDone.")

"""
Synthetic Influencer Dataset Generator — 50,000 Balanced Creators

Generates diverse, realistic influencer profiles with balanced distribution
across tiers, niches, engagement patterns, and authenticity signals.

Can be run standalone or imported by app.py for auto-generation.
"""

import logging
import pandas as pd
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# Set random seed for reproducibility
np.random.seed(42)

NUM_CREATORS = 50_000
# Output filename matches what app.py expects as its primary CSV
OUTPUT_FILE = Path(__file__).parent / 'synthetic_influencer_50k.csv'

# Tier names and ranges aligned with the rest of the app
# (brand_matcher embeddings, Dashboard tier badges, Campaign filter labels)
TIERS = {
    'Nano':  {'range': (1_000,    10_000),     'ratio': 0.35},
    'Micro': {'range': (10_000,   100_000),    'ratio': 0.30},
    'Macro': {'range': (100_000,  1_000_000),  'ratio': 0.22},
    'Mega':  {'range': (1_000_000, 50_000_000),'ratio': 0.13},
}

NICHES = [
    'Education', 'Lifestyle', 'Gaming', 'Music', 'Travel',
    'Fitness', 'Tech', 'Fashion', 'Food', 'Beauty',
    'Wellness', 'Entertainment', 'Sports', 'Business', 'Art',
    'Photography', 'Cooking', 'Comedy', 'DIY', 'Pets'
]


def generate_creators(num_creators: int = NUM_CREATORS) -> pd.DataFrame:
    """Generate balanced synthetic influencer dataset and return as DataFrame."""
    creators = []
    creator_id = 1

    for tier_name, tier_config in TIERS.items():
        num_in_tier = int(num_creators * tier_config['ratio'])
        follower_range = tier_config['range']

        logger.info(f"Generating {num_in_tier} {tier_name} creators...")

        for _ in range(num_in_tier):
            followers = np.random.randint(follower_range[0], follower_range[1])
            niche = np.random.choice(NICHES)

            # Engagement patterns vary by tier
            er_params = {
                'Nano':  (8.5, 4.0, 0.065, 0.020),
                'Micro': (5.5, 3.0, 0.055, 0.015),
                'Macro': (3.5, 2.0, 0.045, 0.012),
                'Mega':  (1.5, 1.2, 0.030, 0.009),
            }
            er_mean, er_std, cr_mean, cr_std = er_params[tier_name]

            engagement_rate = np.clip(np.random.normal(er_mean, er_std), 0.1, 25.0)
            comment_ratio   = np.clip(np.random.normal(cr_mean, cr_std), 0.001, 0.15)

            likes   = int(followers * engagement_rate / 100 * np.random.uniform(0.8, 1.2))
            comments = int(likes * comment_ratio)
            shares  = int(likes * np.clip(np.random.normal(0.04, 0.015), 0.001, 0.15))
            saves   = int(likes * np.clip(np.random.normal(0.05, 0.020), 0.001, 0.20))

            reach       = int(followers * np.random.uniform(0.15, 0.35))
            impressions = int(reach * np.random.uniform(2.0, 4.0))

            posting_consistency = np.clip(np.random.normal(65, 20), 10, 100)
            posts_per_week      = np.random.randint(1, 15)
            growth_rate         = np.clip(np.random.normal(5.0, 4.0), -10, 20)

            base_auth      = 60 + (engagement_rate / 25 * 20)
            authenticity_score = np.clip(base_auth + np.random.normal(0, 15), 5, 100)

            base_growth    = 30 + (engagement_rate / 25 * 30) + (growth_rate / 20 * 20)
            growth_score   = np.clip(base_growth, 5, 100)

            audience_quality = np.clip(authenticity_score * 0.8 + np.random.normal(0, 10), 10, 100)

            # ~12% fake accounts
            is_fake = 1 if np.random.random() < 0.12 else 0
            if is_fake:
                authenticity_score = np.clip(authenticity_score * 0.4, 5, 50)
                growth_score       = np.clip(growth_score       * 0.5, 5, 40)
                audience_quality   = np.clip(audience_quality   * 0.3, 5, 30)

            creators.append({
                'creator_id':         creator_id,
                'tier':               tier_name,
                'niche':              niche,
                'followers':          followers,
                'likes':              likes,
                'comments':           comments,
                'shares':             shares,
                'saves':              saves,
                'reach':              reach,
                'impressions':        impressions,
                'engagement_rate':    round(engagement_rate, 2),
                'comment_ratio':      round(comment_ratio, 4),
                'share_ratio':        round(shares / max(likes, 1), 4),
                'save_ratio':         round(saves  / max(likes, 1), 4),
                'audience_quality':   round(audience_quality, 2),
                'posting_consistency':round(posting_consistency, 2),
                'posts_per_week':     posts_per_week,
                'growth_rate':        round(growth_rate, 2),
                'authenticity_score': round(authenticity_score, 2),
                'growth_score':       round(growth_score, 2),
                'fake_account':       is_fake,
            })
            creator_id += 1

    return pd.DataFrame(creators)


def generate_dataset(num_creators: int = NUM_CREATORS, output_path: str = None) -> pd.DataFrame:
    """Generate, shuffle, save, and return the full dataset.

    Importable by app.py for auto-generation on first startup.
    """
    output = Path(output_path) if output_path else OUTPUT_FILE
    df = generate_creators(num_creators)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    df.to_csv(output, index=False)
    logger.info(f"Saved {len(df)} creators to {output} ({output.stat().st_size / 1024 / 1024:.1f} MB)")
    return df


def analyze_distribution(df: pd.DataFrame):
    """Print dataset distribution summary."""
    print("\n" + "=" * 60)
    print("DATASET DISTRIBUTION ANALYSIS")
    print("=" * 60)
    print(f"\nTotal Creators: {len(df)}")

    print("\nBy Tier:")
    for tier, count in df['tier'].value_counts().sort_index().items():
        print(f"  {tier:8s}: {count:6d} ({count/len(df)*100:5.1f}%)")

    print("\nBy Niche (Top 10):")
    for niche, count in df['niche'].value_counts().head(10).items():
        print(f"  {niche:15s}: {count:6d} ({count/len(df)*100:5.1f}%)")

    authentic = (df['fake_account'] == 0).sum()
    fake      = (df['fake_account'] == 1).sum()
    print(f"\nAuthenticity:  {authentic} authentic ({authentic/len(df)*100:.1f}%)  |  {fake} fake ({fake/len(df)*100:.1f}%)")

    print(f"\nEngagement Rate  — mean: {df['engagement_rate'].mean():.2f}%  median: {df['engagement_rate'].median():.2f}%")
    print(f"Followers        — mean: {df['followers'].mean():,.0f}  median: {df['followers'].median():,.0f}")
    print(f"Authenticity Score — mean: {df['authenticity_score'].mean():.1f}  median: {df['authenticity_score'].median():.1f}")
    print(f"Growth Score       — mean: {df['growth_score'].mean():.1f}  median: {df['growth_score'].median():.1f}")
    print("=" * 60 + "\n")


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    print(f"Generating {NUM_CREATORS:,} balanced synthetic creators...\n")
    df = generate_dataset()
    analyze_distribution(df)
    print(f"Dataset saved to: {OUTPUT_FILE}")

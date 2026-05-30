"""
Synthetic Influencer Dataset Generator - 50,000 Balanced Creators
Generates diverse, realistic influencer profiles with balanced distribution
across tiers, niches, engagement patterns, and authenticity signals.
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Set random seed for reproducibility
np.random.seed(42)

# Configuration
NUM_CREATORS = 50000
OUTPUT_FILE = Path(__file__).parent / 'synthetic_influencer_v2_50k.csv'

# Distribution parameters
TIERS = {
    'Nano': {'range': (100, 10_000), 'ratio': 0.35},
    'Micro': {'range': (10_000, 100_000), 'ratio': 0.30},
    'Mid': {'range': (100_000, 1_000_000), 'ratio': 0.20},
    'Macro': {'range': (1_000_000, 10_000_000), 'ratio': 0.10},
    'Mega': {'range': (10_000_000, 100_000_000), 'ratio': 0.05},
}

NICHES = [
    'Education', 'Lifestyle', 'Gaming', 'Music', 'Travel',
    'Fitness', 'Tech', 'Fashion', 'Food', 'Beauty',
    'Wellness', 'Entertainment', 'Sports', 'Business', 'Art',
    'Photography', 'Cooking', 'Comedy', 'DIY', 'Pets'
]

def generate_creators(num_creators: int) -> pd.DataFrame:
    """Generate balanced synthetic influencer dataset."""
    
    creators = []
    creator_id = 1
    
    # Generate creators by tier to ensure balanced distribution
    for tier_name, tier_config in TIERS.items():
        num_in_tier = int(num_creators * tier_config['ratio'])
        follower_range = tier_config['range']
        
        print(f"Generating {num_in_tier} {tier_name} creators...")
        
        for _ in range(num_in_tier):
            # Base characteristics
            followers = np.random.randint(follower_range[0], follower_range[1])
            niche = np.random.choice(NICHES)
            
            # Engagement patterns vary by tier and niche
            if tier_name == 'Nano':
                engagement_rate = np.random.normal(8.5, 4.0)
                comment_ratio = np.random.normal(0.065, 0.02)
            elif tier_name == 'Micro':
                engagement_rate = np.random.normal(5.5, 3.0)
                comment_ratio = np.random.normal(0.055, 0.015)
            elif tier_name == 'Mid':
                engagement_rate = np.random.normal(3.5, 2.0)
                comment_ratio = np.random.normal(0.045, 0.012)
            elif tier_name == 'Macro':
                engagement_rate = np.random.normal(2.0, 1.5)
                comment_ratio = np.random.normal(0.035, 0.010)
            else:  # Mega
                engagement_rate = np.random.normal(1.2, 1.0)
                comment_ratio = np.random.normal(0.025, 0.008)
            
            engagement_rate = np.clip(engagement_rate, 0.1, 25.0)
            comment_ratio = np.clip(comment_ratio, 0.001, 0.15)
            
            # Engagement metrics
            likes = int(followers * engagement_rate / 100 * np.random.uniform(0.8, 1.2))
            comments = int(likes * comment_ratio)
            share_ratio = np.random.normal(0.04, 0.015)
            share_ratio = np.clip(share_ratio, 0.001, 0.15)
            shares = int(likes * share_ratio)
            save_ratio = np.random.normal(0.05, 0.02)
            save_ratio = np.clip(save_ratio, 0.001, 0.20)
            saves = int(likes * save_ratio)
            
            # Reach and impressions
            reach = int(followers * np.random.uniform(0.15, 0.35))
            impressions = int(reach * np.random.uniform(2.0, 4.0))
            
            # Posting consistency and frequency
            posting_consistency = np.random.normal(65, 20)
            posting_consistency = np.clip(posting_consistency, 10, 100)
            posts_per_week = np.random.randint(1, 15)
            
            # Growth metrics
            growth_rate = np.random.normal(5.0, 4.0)
            growth_rate = np.clip(growth_rate, -10, 20)
            
            # Authenticity score - higher for better engagement patterns
            base_authenticity = 60 + (engagement_rate / 25 * 20)
            authenticity_variance = np.random.normal(0, 15)
            authenticity_score = np.clip(base_authenticity + authenticity_variance, 5, 100)
            
            # Growth score - correlates with engagement and growth
            base_growth_score = 30 + (engagement_rate / 25 * 30) + (growth_rate / 20 * 20)
            growth_score = np.clip(base_growth_score, 5, 100)
            
            # Audience quality - varies by authenticity
            audience_quality = np.clip(authenticity_score * 0.8 + np.random.normal(0, 10), 10, 100)
            
            # Fake account detection (10-15% fake accounts)
            is_fake = 1 if np.random.random() < 0.12 else 0
            
            # If fake, lower authenticity and growth scores
            if is_fake:
                authenticity_score = np.clip(authenticity_score * 0.4, 5, 50)
                growth_score = np.clip(growth_score * 0.5, 5, 40)
                audience_quality = np.clip(audience_quality * 0.3, 5, 30)
            
            creators.append({
                'creator_id': creator_id,
                'tier': tier_name,
                'niche': niche,
                'followers': followers,
                'likes': likes,
                'comments': comments,
                'shares': shares,
                'saves': saves,
                'reach': reach,
                'impressions': impressions,
                'engagement_rate': round(engagement_rate, 2),
                'comment_ratio': round(comment_ratio, 4),
                'share_ratio': round(share_ratio, 4),
                'save_ratio': round(save_ratio, 4),
                'audience_quality': round(audience_quality, 2),
                'posting_consistency': round(posting_consistency, 2),
                'posts_per_week': posts_per_week,
                'growth_rate': round(growth_rate, 2),
                'authenticity_score': round(authenticity_score, 2),
                'growth_score': round(growth_score, 2),
                'fake_account': is_fake
            })
            
            creator_id += 1
    
    return pd.DataFrame(creators)

def analyze_distribution(df: pd.DataFrame):
    """Print distribution analysis."""
    print("\n" + "="*60)
    print("DATASET DISTRIBUTION ANALYSIS")
    print("="*60)
    
    print(f"\nTotal Creators: {len(df)}")
    
    print("\n📊 By Tier:")
    tier_dist = df['tier'].value_counts().sort_index()
    for tier, count in tier_dist.items():
        pct = (count / len(df)) * 100
        print(f"  {tier:8s}: {count:6d} ({pct:5.1f}%)")
    
    print("\n🎯 By Niche (Top 10):")
    niche_dist = df['niche'].value_counts().head(10)
    for niche, count in niche_dist.items():
        pct = (count / len(df)) * 100
        print(f"  {niche:15s}: {count:6d} ({pct:5.1f}%)")
    
    print("\n✅ Authenticity:")
    authentic = len(df[df['fake_account'] == 0])
    fake = len(df[df['fake_account'] == 1])
    print(f"  Authentic: {authentic:6d} ({(authentic/len(df))*100:5.1f}%)")
    print(f"  Fake:      {fake:6d} ({(fake/len(df))*100:5.1f}%)")
    
    print("\n📈 Engagement Rate Statistics:")
    print(f"  Mean:   {df['engagement_rate'].mean():.2f}%")
    print(f"  Median: {df['engagement_rate'].median():.2f}%")
    print(f"  Min:    {df['engagement_rate'].min():.2f}%")
    print(f"  Max:    {df['engagement_rate'].max():.2f}%")
    
    print("\n👥 Followers Statistics:")
    print(f"  Mean:   {df['followers'].mean():,.0f}")
    print(f"  Median: {df['followers'].median():,.0f}")
    print(f"  Min:    {df['followers'].min():,.0f}")
    print(f"  Max:    {df['followers'].max():,.0f}")
    
    print("\n⭐ Authenticity Score Statistics:")
    print(f"  Mean:   {df['authenticity_score'].mean():.2f}")
    print(f"  Median: {df['authenticity_score'].median():.2f}")
    
    print("\n📊 Growth Score Statistics:")
    print(f"  Mean:   {df['growth_score'].mean():.2f}")
    print(f"  Median: {df['growth_score'].median():.2f}")
    
    print("\n" + "="*60 + "\n")

if __name__ == '__main__':
    print("🚀 Generating 50,000 balanced synthetic creators...\n")
    
    # Generate dataset
    df = generate_creators(NUM_CREATORS)
    
    # Shuffle rows
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Analyze distribution
    analyze_distribution(df)
    
    # Save to CSV
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Dataset saved to: {OUTPUT_FILE}")
    print(f"   File size: {OUTPUT_FILE.stat().st_size / (1024*1024):.2f} MB")
    
    print("\n✨ Dataset generation complete!")

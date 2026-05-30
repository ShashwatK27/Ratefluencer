"""
Performance Analysis by Creator Tier

Analyzes how well the growth models perform across different creator sizes:
- Nano: < 10K followers
- Micro: 10K-100K followers  
- Mid: 100K-1M followers
- Macro: > 1M followers
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings

warnings.filterwarnings('ignore')

print("="*70)
print("PERFORMANCE ANALYSIS BY CREATOR TIER")
print("="*70)

# Load data
df = pd.read_csv('channel_growth_features.csv')
df['day'] = pd.to_datetime(df['day'])
df = df.sort_values('day').reset_index(drop=True)

# Prepare features
df['target_growth_tomorrow'] = df['net_growth'].shift(-1)

def safe_divide(a, b):
    return a / (b.replace(0, np.nan).fillna(1))

df['like_rate_7d'] = safe_divide(df['likes_7d_avg'], df['views_7d_avg'])
df['comment_rate_7d'] = safe_divide(df['comments_7d_avg'], df['views_7d_avg'])
df['share_rate_7d'] = safe_divide(df['shares_7d_avg'], df['views_7d_avg'])
df['growth_rate_vs_views'] = safe_divide(df['net_growth'], df['views_7d_avg'])

# Lags and rolling for v2
df['net_growth_lag1'] = df['net_growth'].shift(1)
df['net_growth_lag2'] = df['net_growth'].shift(2)
df['net_growth_lag7'] = df['net_growth'].shift(7)
df['growth_rolling_mean_3d'] = df['net_growth'].rolling(window=3, min_periods=1).mean()
df['growth_rolling_std_3d'] = df['net_growth'].rolling(window=3, min_periods=1).std()
df['growth_momentum'] = df['net_growth'] - df['growth_rolling_mean_3d']

df = df.dropna().copy()

# Estimate creator tier based on view velocity
# Higher 7d_avg views = bigger creator
df['creator_tier'] = pd.cut(
    df['views_7d_avg'],
    bins=[0, 5000, 50000, 500000, np.inf],
    labels=['Nano (<5K)', 'Micro (5K-50K)', 'Mid (50K-500K)', 'Macro (>500K)']
)

# Split test set
split_idx = int(len(df) * 0.8)
df_test = df.iloc[split_idx:].copy()

# Load models
try:
    v2_model = joblib.load('growth_model_v2.pkl')
    v2_features = joblib.load('growth_features_v2.pkl')
    
    try:
        v1_model = joblib.load('growth_model_v1.pkl')
        features_v1 = [
            'views_7d_avg', 'likes_7d_avg', 'comments_7d_avg', 
            'shares_7d_avg', 'engagement_rate_7d', 'net_growth',
            'like_rate_7d', 'comment_rate_7d', 'share_rate_7d',
            'growth_rate_vs_views'
        ]
        v1_loaded = True
    except:
        v1_loaded = False
    
    # Predict
    X_test_v2 = df_test[v2_features]
    v2_pred = v2_model.predict(X_test_v2)
    
    if v1_loaded:
        X_test_v1 = df_test[features_v1]
        v1_pred = v1_model.predict(X_test_v1)
    
    baseline_pred = df_test['net_growth'].values
    y_test = df_test['target_growth_tomorrow'].values
    
    # Analyze by tier
    print("\nModel Performance by Creator Tier:")
    print("-" * 70)
    
    results_by_tier = []
    
    for tier in ['Nano (<5K)', 'Micro (5K-50K)', 'Mid (50K-500K)', 'Macro (>500K)']:
        mask = df_test['creator_tier'] == tier
        
        if mask.sum() == 0:
            continue
        
        y_tier = y_test[mask]
        baseline_tier = baseline_pred[mask]
        v2_tier = v2_pred[mask]
        
        # Metrics
        baseline_mae = mean_absolute_error(y_tier, baseline_tier)
        baseline_r2 = r2_score(y_tier, baseline_tier)
        
        v2_mae = mean_absolute_error(y_tier, v2_tier)
        v2_r2 = r2_score(y_tier, v2_tier)
        
        improvement = ((baseline_mae - v2_mae) / baseline_mae * 100) if baseline_mae > 0 else 0
        
        print(f"\n{tier} ({mask.sum()} observations):")
        print(f"  Baseline: MAE={baseline_mae:.2f}, R²={baseline_r2:.3f}")
        print(f"  v2 Model: MAE={v2_mae:.2f}, R²={v2_r2:.3f}")
        print(f"  Improvement: {improvement:+.1f}%")
        
        if v1_loaded:
            v1_tier = v1_pred[mask]
            v1_mae = mean_absolute_error(y_tier, v1_tier)
            print(f"  v1 Model: MAE={v1_mae:.2f}")
        
        results_by_tier.append({
            'Tier': tier,
            'Count': mask.sum(),
            'Baseline_MAE': baseline_mae,
            'V2_MAE': v2_mae,
            'Improvement_%': improvement,
            'V2_R2': v2_r2
        })
    
    # Summary stats
    print("\n" + "="*70)
    print("SUMMARY BY TIER")
    print("="*70)
    
    results_df = pd.DataFrame(results_by_tier)
    print("\n" + results_df.to_string(index=False))
    
    avg_improvement = results_df['Improvement_%'].mean()
    print(f"\nAverage Improvement across tiers: {avg_improvement:.1f}%")
    
    # Recommendations
    print("\n" + "="*70)
    print("INSIGHTS & RECOMMENDATIONS")
    print("="*70)
    
    best_tier = results_df.loc[results_df['Improvement_%'].idxmax(), 'Tier']
    worst_tier = results_df.loc[results_df['Improvement_%'].idxmin(), 'Tier']
    
    print(f"\n✓ v2 Model performs BEST on: {best_tier}")
    print(f"  → These creators have stable, predictable growth patterns")
    
    print(f"\n⚠ v2 Model performs WORST on: {worst_tier}")
    print(f"  → Recommendation: Use ensemble or confidence weighting")
    
    # Growth distribution
    print("\n" + "-"*70)
    print("Growth Distribution by Tier:")
    print("-"*70)
    
    for tier in ['Nano (<5K)', 'Micro (5K-50K)', 'Mid (50K-500K)', 'Macro (>500K)']:
        mask = df_test['creator_tier'] == tier
        if mask.sum() > 0:
            growth_tier = y_test[mask]
            print(f"\n{tier}:")
            print(f"  Mean Growth: {growth_tier.mean():.1f} subs/day")
            print(f"  Median Growth: {np.median(growth_tier):.1f} subs/day")
            print(f"  Std Dev: {growth_tier.std():.1f}")
            print(f"  Range: {growth_tier.min():.1f} to {growth_tier.max():.1f}")
    
    print("\n" + "="*70)
    print("✅ Analysis Complete")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

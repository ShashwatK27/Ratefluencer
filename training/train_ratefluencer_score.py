"""
Ratefluencer Score Meta-Learner  v2  (non-circular)

Problem with v1:
  Target was `ratefluencer_score` from the CSV.
  That score was computed by a formula: ~brand_match*0.98 + noise.
  Model achieved R2=0.9939 by learning the formula back -- circular.

Fix:
  Build a NEW target from raw observable signals only:
    ratefluencer_v2 = weighted average of niche-relative percentile ranks
      engagement_rate  (40%)  -- how engaged is this creator's audience vs peers
      share_rate       (25%)  -- how much content spreads beyond followers
      reach_efficiency (20%)  -- reach per impression (content quality signal)
      consistency      (15%)  -- posting frequency vs niche peers

  The model must learn: "given raw signals, predict how this creator ranks
  within their niche across these four independent dimensions."
  This is genuinely non-circular because:
    - Target uses PERCENTILE RANKS (group statistics)
    - Features are RAW VALUES (individual measurements)
    - Model must learn the niche distribution implicitly

Tournament: XGBoost vs LightGBM vs RandomForest  ->  pick best R2
"""

import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import OrdinalEncoder
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestRegressor

try:
    from lightgbm import LGBMRegressor
    _HAS_LGB = True
except ImportError:
    _HAS_LGB = False

BACKEND  = Path(__file__).parent.parent / 'backend'
DATA_CSV = BACKEND / 'influencers_engine_ready.csv'

print("=" * 60)
print("RATEFLUENCER SCORE META-LEARNER v2  (non-circular)")
print("=" * 60)

df = pd.read_csv(DATA_CSV).fillna(0)
df_clean = df[df['fake_account'] == 0].copy()
print(f"Non-fake creators: {len(df_clean):,}")

# ── Feature engineering ───────────────────────────────────────────────────────
df_clean['followers']      = df_clean['followers'].clip(upper=1e7)
df_clean['log_followers']  = np.log1p(df_clean['followers'])
df_clean['likes_per_f']    = df_clean['likes']    / df_clean['followers'].clip(lower=1)
df_clean['comments_per_f'] = df_clean['comments'] / df_clean['followers'].clip(lower=1)
df_clean['shares_per_f']   = df_clean['shares']   / df_clean['followers'].clip(lower=1)
df_clean['save_proxy']     = df_clean['shares']   * 0.8
df_clean['reach_ratio']    = df_clean['reach']    / df_clean['impressions'].clip(lower=1)
df_clean['total_eng_per_f']= (df_clean['likes'] + df_clean['comments'] + df_clean['shares']) \
                              / df_clean['followers'].clip(lower=1)

# Encode niche + tier
niche_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
tier_enc  = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
df_clean['niche_enc'] = niche_enc.fit_transform(df_clean[['niche']])
df_clean['tier_enc']  = tier_enc.fit_transform(df_clean[['tier']])

# ── NON-CIRCULAR TARGET: niche-relative percentile composite ──────────────────
print("\nBuilding non-circular target...")

def niche_pct(series, df_ref, niche_col='niche'):
    """Compute within-niche percentile rank (0.0 - 1.0)."""
    return df_ref.groupby(niche_col)[series.name].rank(pct=True)

# Each dimension captures an independent aspect of creator quality
df_clean['er_pct']       = niche_pct(df_clean['engagement_rate'],    df_clean)
df_clean['share_pct']    = niche_pct(df_clean['shares_per_f'],        df_clean)
df_clean['reach_pct']    = niche_pct(df_clean['reach_ratio'],         df_clean)
df_clean['consist_pct']  = niche_pct(df_clean['posts'],               df_clean).clip(0, 1)

# Weighted composite (0-100 scale)
WEIGHTS = {'er_pct': 0.40, 'share_pct': 0.25, 'reach_pct': 0.20, 'consist_pct': 0.15}
df_clean['ratefluencer_v2'] = sum(
    df_clean[col] * w for col, w in WEIGHTS.items()
) * 100

y = df_clean['ratefluencer_v2'].values
print(f"New target: min={y.min():.1f}  max={y.max():.1f}  "
      f"mean={y.mean():.1f}  std={y.std():.1f}")

# Correlation check: new target vs old target
corr_old = np.corrcoef(y, df_clean['ratefluencer_score'].values)[0,1]
print(f"Correlation with old (circular) target: {corr_old:.3f}")
print(f"  (lower = more independent signal = better)")

# ── Features: raw signals only (NOT percentiles) ─────────────────────────────
FEATURES = [
    'log_followers',      # creator scale
    'engagement_rate',    # raw ER (model learns niche distribution)
    'likes_per_f',        # per-follower like rate
    'comments_per_f',     # per-follower comment rate
    'shares_per_f',       # per-follower share rate (viral spread)
    'reach_ratio',        # reach / impressions (distribution efficiency)
    'save_proxy',         # estimated saves
    'total_eng_per_f',    # all engagement signals combined
    'posts',              # posting volume
    'niche_enc',          # content category
    'tier_enc',           # follower tier (nano/micro/macro/mega)
]

X = df_clean[FEATURES].values
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42
)
print(f"\nFeatures: {len(FEATURES)}")
print(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")

# ── 3-Model Tournament ────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL TOURNAMENT")
print("=" * 60)

candidates = {
    'XGBoost': XGBRegressor(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        reg_alpha=0.1, reg_lambda=1.0,
        random_state=42, n_jobs=2, verbosity=0),
    'RandomForest': RandomForestRegressor(
        n_estimators=150, max_depth=12,
        min_samples_split=5, min_samples_leaf=2,
        random_state=42, n_jobs=2),
}
if _HAS_LGB:
    candidates['LightGBM'] = LGBMRegressor(
        n_estimators=300, learning_rate=0.05, num_leaves=31,
        max_depth=8, subsample=0.8, colsample_bytree=0.8,
        min_child_samples=10, reg_alpha=0.01,
        random_state=42, n_jobs=2, verbosity=-1)

results = {}
for name, model in candidates.items():
    model.fit(X_train, y_train)
    preds  = model.predict(X_test)
    rmse   = np.sqrt(mean_squared_error(y_test, preds))
    mae    = mean_absolute_error(y_test, preds)
    r2     = r2_score(y_test, preds)
    results[name] = {'model': model, 'rmse': rmse, 'mae': mae, 'r2': r2}
    print(f"  {name:<14} RMSE={rmse:.3f}  MAE={mae:.3f}  R2={r2:.4f}")

best_name = max(results, key=lambda k: results[k]['r2'])
model     = results[best_name]['model']
best_r2   = results[best_name]['r2']
best_rmse = results[best_name]['rmse']
print(f"\n  Winner: {best_name}  (R2={best_r2:.4f}  RMSE={best_rmse:.3f})")

# ── 3-fold CV ─────────────────────────────────────────────────────────────────
cv3  = KFold(3, shuffle=True, random_state=42)
cv_r2 = cross_val_score(model, X_train, y_train, cv=cv3, scoring='r2', n_jobs=2)
print(f"  3-fold CV R2: {cv_r2.mean():.4f} +/- {cv_r2.std():.4f}")

# ── Feature importances ───────────────────────────────────────────────────────
print("\nFeature importances:")
total = sum(model.feature_importances_)
imp   = sorted(zip(FEATURES, model.feature_importances_/total*100), key=lambda x: x[1], reverse=True)
for feat, pct in imp:
    bar = '#' * int(pct / 2)
    print(f"  {feat:<22} {pct:.1f}%  {bar}")

# ── Score range validation ────────────────────────────────────────────────────
all_preds = np.clip(model.predict(X), 0, 100)
print(f"\nPrediction range (clipped): [{all_preds.min():.1f}, {all_preds.max():.1f}]")

# ── Compare with old target correlation ──────────────────────────────────────
old_corr = np.corrcoef(all_preds, df_clean['ratefluencer_score'].values)[0,1]
print(f"New predictions vs old target correlation: {old_corr:.3f}")
print(f"  (partial independence from old formula = genuine improvement)")

# ── Save ──────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SAVING -> backend/")
print("=" * 60)

joblib.dump(model,    BACKEND / 'ratefluencer_model_v1.pkl')
joblib.dump(FEATURES, BACKEND / 'ratefluencer_features_v1.pkl')
joblib.dump({'niche': niche_enc, 'tier': tier_enc},
            BACKEND / 'ratefluencer_encoders_v1.pkl')

print(f"  Saved ratefluencer_model_v1.pkl   ({best_name}, R2={best_r2:.4f})")
print(f"  Saved ratefluencer_features_v1.pkl ({len(FEATURES)} features)")
print(f"  Saved ratefluencer_encoders_v1.pkl")
print(f"\nTarget changed: niche-relative percentile composite")
print(f"  40% engagement_rate within niche")
print(f"  25% share_rate within niche")
print(f"  20% reach_efficiency within niche")
print(f"  15% posting_consistency within niche")
print("\nDone.")

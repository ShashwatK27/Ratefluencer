"""
Ratefluencer Score Meta-Learner
Replaces hand-coded composite weights with a trained XGBoost regressor.

Input features: raw observable signals from the 33K creator dataset
Target: ratefluencer_score (ground-truth composite from the dataset)

This makes the composite score data-driven rather than hand-tuned.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import OrdinalEncoder
from xgboost import XGBRegressor

BACKEND  = Path(__file__).parent / 'backend'
DATA_CSV = BACKEND / 'influencers_engine_ready.csv'

print("=" * 60)
print("RATEFLUENCER SCORE META-LEARNER TRAINING")
print("=" * 60)

df = pd.read_csv(DATA_CSV).fillna(0)
print(f"Loaded {len(df):,} creators")
print(f"Target (ratefluencer_score): min={df['ratefluencer_score'].min():.1f}  "
      f"max={df['ratefluencer_score'].max():.1f}  "
      f"mean={df['ratefluencer_score'].mean():.1f}  "
      f"std={df['ratefluencer_score'].std():.1f}")

# -- Encode niche --------------------------------------------------------------
niche_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
tier_enc  = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
df['niche_enc'] = niche_enc.fit_transform(df[['niche']])
df['tier_enc']  = tier_enc.fit_transform(df[['tier']])

# -- Feature engineering -------------------------------------------------------
# Use raw observable signals only  -  NOT the pre-computed sub-scores
# so the model learns from the data, not from a formula
df['followers']      = df['followers'].clip(upper=1e7)
df['likes_per_f']    = df['likes']    / df['followers'].clip(lower=1)
df['comments_per_f'] = df['comments'] / df['followers'].clip(lower=1)
df['shares_per_f']   = df['shares']   / df['followers'].clip(lower=1)
df['reach_ratio']    = df['reach']    / df['impressions'].clip(lower=1)
df['log_followers']  = np.log1p(df['followers'])
df['save_proxy']     = df['shares']   * 0.8            # saves ≈ 80% of shares

FEATURES = [
    'log_followers', 'engagement_rate', 'posts',
    'likes_per_f', 'comments_per_f', 'shares_per_f',
    'reach_ratio', 'save_proxy',
    'niche_enc', 'tier_enc',
]

# Exclude fake accounts from training  -  they distort score distribution
df_clean = df[df['fake_account'] == 0].copy()
print(f"Clean (non-fake) creators: {len(df_clean):,}")

X = df_clean[FEATURES].values
y = df_clean['ratefluencer_score'].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42
)
print(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")

# -- Train ---------------------------------------------------------------------
print("\nTraining XGBoost Regressor...")
model = XGBRegressor(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    reg_alpha=0.1, reg_lambda=1.0,
    random_state=42, n_jobs=-1, verbosity=0,
)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
rmse   = np.sqrt(mean_squared_error(y_test, y_pred))
mae    = mean_absolute_error(y_test, y_pred)
r2     = r2_score(y_test, y_pred)

print(f"\nTest RMSE : {rmse:.3f}")
print(f"Test MAE  : {mae:.3f}")
print(f"Test R²   : {r2:.4f}")

# -- Cross-validation ----------------------------------------------------------
cv  = KFold(5, shuffle=True, random_state=42)
cv_r2 = cross_val_score(model, X, y, cv=cv, scoring='r2')
print(f"5-fold CV R²: {cv_r2.mean():.4f} ± {cv_r2.std():.4f}")

# -- Feature importances -------------------------------------------------------
print("\nFeature importances:")
imp = sorted(zip(FEATURES, model.feature_importances_), key=lambda x: x[1], reverse=True)
for feat, score in imp:
    bar = '#' * int(score * 200)
    print(f"  {feat:<22} {score:.4f}  {bar}")

# -- Validate score range is reasonable ---------------------------------------
all_pred = model.predict(X)
all_pred_clipped = np.clip(all_pred, 0, 100)
print(f"\nPrediction range on full set: [{all_pred.min():.1f}, {all_pred.max():.1f}]")
print(f"After clip [0,100]:           [{all_pred_clipped.min():.1f}, {all_pred_clipped.max():.1f}]")

# -- Save ----------------------------------------------------------------------
print("\n" + "=" * 60)
print("SAVING -> backend/")
print("=" * 60)

joblib.dump(model,    BACKEND / 'ratefluencer_model_v1.pkl')
joblib.dump(FEATURES, BACKEND / 'ratefluencer_features_v1.pkl')
joblib.dump({'niche': niche_enc, 'tier': tier_enc},
            BACKEND / 'ratefluencer_encoders_v1.pkl')

print(f"  Saved ratefluencer_model_v1.pkl   (XGBoost, R²={r2:.4f})")
print(f"  Saved ratefluencer_features_v1.pkl")
print(f"  Saved ratefluencer_encoders_v1.pkl")
print("\nDone.")

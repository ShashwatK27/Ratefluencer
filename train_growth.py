"""
Growth Model Retraining Pipeline  v2
Target: 7-day forward aggregate subscriber + views momentum
Tournament: RandomForest vs XGBoost vs LightGBM  ->  winner picked by RMSE
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor

try:
    from lightgbm import LGBMRegressor
    _HAS_LGB = True
except ImportError:
    _HAS_LGB = False
    print("LightGBM not found -- running RF vs XGBoost only")

# Cap rows used for training to prevent RAM crash on laptops.
# Feature engineering still uses the full CSV; only the model fit is capped.
MAX_TRAIN_ROWS = 25_000

BACKEND  = Path(__file__).parent / 'backend'
DATA_CSV = Path(__file__).parent / 'all_youtube_analytics.csv'

FEATURES = [
    'views_7d_avg', 'likes_7d_avg', 'comments_7d_avg', 'shares_7d_avg',
    'engagement_rate_7d', 'net_growth',
    'like_rate_7d', 'comment_rate_7d', 'share_rate_7d', 'growth_rate_vs_views',
    'net_growth_lag1', 'net_growth_lag2', 'net_growth_lag7',
    'growth_rolling_mean_3d', 'growth_rolling_std_3d', 'growth_momentum',
]

print("="*60)
print("GROWTH MODEL RETRAINING")
print("="*60)

df = pd.read_csv(DATA_CSV, parse_dates=['day'])
df = df.sort_values(['video_id', 'day']).reset_index(drop=True).fillna(0)
df['net_growth_raw'] = df['subscribersGained'] - df['subscribersLost']

print(f"Loaded {len(df):,} rows across {df['video_id'].nunique()} videos")
print(f"Net growth: mean={df['net_growth_raw'].mean():.3f}  "
      f"max={df['net_growth_raw'].max():.0f}  "
      f"% zero={(df['net_growth_raw']==0).mean()*100:.1f}%")

# -- Feature engineering -----------------------------------------------------
# Use 7-day forward aggregate as target (smooths daily sparsity)
# Target = sum of next 7 days' (subscribers + views_momentum)
print("\nEngineering features (7-day windows)...")
records = []

for vid_id, g in df.groupby('video_id', sort=False):
    g = g.reset_index(drop=True)
    if len(g) < 21:          # need 7 look-back + 7 forward + buffer
        continue

    views    = g['views'].values
    likes    = g['likes'].values
    comments = g['comments'].values
    shares   = g['shares'].values
    growth   = g['net_growth_raw'].values

    for i in range(7, len(g) - 7):
        wb = slice(i - 7, i)           # 7-day look-back window
        w3 = slice(max(0, i - 3), i)  # 3-day window

        v_avg = max(0.001, views[wb].mean())
        l_avg = likes[wb].mean()
        c_avg = comments[wb].mean()
        s_avg = shares[wb].mean()
        g_cur = growth[i]

        total_eng = max(1.0, l_avg + c_avg + s_avg)
        er = total_eng / v_avg * 100.0

        # 7-day forward target: combined growth + views momentum signal
        fwd_growth = growth[i:i+7].sum()
        fwd_views  = views[i:i+7].mean()
        prev_views = v_avg
        views_momentum = (fwd_views - prev_views) / max(1, prev_views)
        # Blend subscriber growth and views momentum
        target = fwd_growth + views_momentum * 2.0

        records.append({
            'views_7d_avg':           v_avg,
            'likes_7d_avg':           l_avg,
            'comments_7d_avg':        c_avg,
            'shares_7d_avg':          s_avg,
            'engagement_rate_7d':     er,
            'net_growth':             g_cur,
            'like_rate_7d':           l_avg / total_eng,
            'comment_rate_7d':        c_avg / total_eng,
            'share_rate_7d':          s_avg / total_eng,
            'growth_rate_vs_views':   g_cur / v_avg,
            'net_growth_lag1':        growth[i - 1],
            'net_growth_lag2':        growth[i - 2],
            'net_growth_lag7':        growth[i - 7],
            'growth_rolling_mean_3d': growth[w3].mean(),
            'growth_rolling_std_3d':  max(0.01, growth[w3].std() if len(growth[w3]) > 1 else 0.01),
            'growth_momentum':        g_cur - growth[w3].mean(),
            'target':                 target,
        })

feat_df = pd.DataFrame(records).replace([np.inf, -np.inf], 0).fillna(0)
print(f"Feature matrix: {feat_df.shape}")
print(f"Target stats: mean={feat_df['target'].mean():.3f}  "
      f"std={feat_df['target'].std():.3f}  "
      f"range=[{feat_df['target'].min():.1f}, {feat_df['target'].max():.1f}]")

X = feat_df[FEATURES].values
y = feat_df['target'].values

# Clip outliers at 3 std
mu, sigma = y.mean(), y.std()
mask = (y >= mu - 3*sigma) & (y <= mu + 3*sigma)
X, y = X[mask], y[mask]
print(f"After 3-sigma clip: {len(X):,} rows")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42)
print(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")

# -- Cap training rows to avoid RAM crash on laptops --------------------------
if len(X_train) > MAX_TRAIN_ROWS:
    rng = np.random.default_rng(42)
    idx = rng.choice(len(X_train), MAX_TRAIN_ROWS, replace=False)
    X_train, y_train = X_train[idx], y_train[idx]
    print(f"Training capped at {MAX_TRAIN_ROWS:,} rows (memory protection)")

# -- 3-Model Tournament with fixed hyperparameters ----------------------------
# RandomizedSearchCV replaced with pre-tuned params to prevent RAM crash.
# 3 fits total instead of 350+ -- runs in ~5 min instead of 40+.
print("\n[1/3] RandomForest (pre-tuned hyperparams)...")
rf_best = RandomForestRegressor(
    n_estimators=150, max_depth=12,
    min_samples_split=5, min_samples_leaf=2,
    max_features='sqrt', random_state=42,
    n_jobs=2,   # limit parallelism to 2 threads -- prevents RAM crash
)
rf_best.fit(X_train, y_train)
p_rf    = rf_best.predict(X_test)
rf_rmse = np.sqrt(mean_squared_error(y_test, p_rf))
rf_r2   = r2_score(y_test, p_rf)
print(f"  RMSE={rf_rmse:.4f}  MAE={mean_absolute_error(y_test,p_rf):.4f}  R2={rf_r2:.4f}")

print("\n[2/3] XGBoost (pre-tuned hyperparams)...")
xgb_best = XGBRegressor(
    n_estimators=200, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8,
    min_child_weight=2, reg_alpha=0.01, reg_lambda=1.0,
    random_state=42, n_jobs=2, verbosity=0,
)
xgb_best.fit(X_train, y_train)
p_xgb    = xgb_best.predict(X_test)
xgb_rmse = np.sqrt(mean_squared_error(y_test, p_xgb))
xgb_r2   = r2_score(y_test, p_xgb)
print(f"  RMSE={xgb_rmse:.4f}  MAE={mean_absolute_error(y_test,p_xgb):.4f}  R2={xgb_r2:.4f}")

lgb_rmse, lgb_r2, lgb_best = float('inf'), 0.0, None
if _HAS_LGB:
    print("\n[3/3] LightGBM (pre-tuned hyperparams)...")
    lgb_best = LGBMRegressor(
        n_estimators=200, learning_rate=0.05, num_leaves=31,
        max_depth=8, subsample=0.8, colsample_bytree=0.8,
        min_child_samples=20, reg_alpha=0.01,
        random_state=42, n_jobs=2, verbosity=-1,
    )
    lgb_best.fit(X_train, y_train)
    p_lgb    = lgb_best.predict(X_test)
    lgb_rmse = np.sqrt(mean_squared_error(y_test, p_lgb))
    lgb_r2   = r2_score(y_test, p_lgb)
    print(f"  RMSE={lgb_rmse:.4f}  MAE={mean_absolute_error(y_test,p_lgb):.4f}  R2={lgb_r2:.4f}")
else:
    print("\n[3/3] LightGBM not available -- skipping")

# -- 3-fold CV on winner candidates (light -- 3 folds only) -------------------
print("\n[4/4] 3-fold CV comparison:")
cv3 = KFold(3, shuffle=True, random_state=42)
for name, model in [('RandomForest', rf_best), ('XGBoost', xgb_best)] + (
        [('LightGBM', lgb_best)] if lgb_best else []):
    cv_r2  = cross_val_score(model, X_train, y_train, cv=cv3,
                             scoring='r2', n_jobs=2)
    cv_rmse = (-cross_val_score(model, X_train, y_train, cv=cv3,
                                scoring='neg_root_mean_squared_error', n_jobs=2))
    print(f"  {name:<14} CV-R2={cv_r2.mean():.4f}+-{cv_r2.std():.4f}  "
          f"CV-RMSE={cv_rmse.mean():.4f}+-{cv_rmse.std():.4f}")

contestants = [(rf_rmse, rf_best, 'RandomForest', rf_r2),
               (xgb_rmse, xgb_best, 'XGBoost', xgb_r2)]
if lgb_best is not None:
    contestants.append((lgb_rmse, lgb_best, 'LightGBM', lgb_r2))

best_rmse, best_model, best_name, best_r2 = min(contestants, key=lambda x: x[0])
print(f"\n  Winner: {best_name}  (RMSE={best_rmse:.4f}, R2={best_r2:.4f})")

# -- Scaler: map predictions -> 0-100 -----------------------------------------
all_raw = best_model.predict(X)
log_preds = np.log1p(np.clip(all_raw - all_raw.min(), 0, None)).reshape(-1, 1)
scaler = MinMaxScaler(feature_range=(0, 100))
scaler.fit(log_preds)

# -- Feature importance --------------------------------------------------------
print("\nTop feature importances:")
imp = sorted(zip(FEATURES, best_model.feature_importances_),
             key=lambda x: x[1], reverse=True)
for feat, score in imp[:8]:
    bar = '#' * int(score * 300)
    print(f"  {feat:<30} {score:.4f}  {bar}")

# -- Validate on 33k dataset ---------------------------------------------------
print("\n" + "="*60)
print("VALIDATION ON 33K INFLUENCER DATASET")
print("="*60)

df33 = pd.read_csv(BACKEND / 'influencers_engine_ready.csv').fillna(0)
print(f"Loaded {len(df33):,} creators")

def build_growth_features(row):
    followers = float(row.get('followers', 10000))
    er        = float(row.get('engagement_rate', 3.0))
    if er < 1.0: er *= 100.0
    likes     = float(row.get('likes',    max(1.0, followers * er/100 * 0.9)))
    comments  = float(row.get('comments', max(1.0, followers * er/100 * 0.1)))
    shares    = float(row.get('shares',   max(1.0, comments * 0.5)))
    reach     = float(row.get('reach',    max(1.0, likes * 12.0)))
    net_g     = float(max(0.01, followers * er/100 * 0.08))
    v_avg     = max(0.001, reach / 30.0)
    total_eng = max(1.0, likes + comments + shares)
    return [
        v_avg, likes/30.0, comments/30.0, shares/30.0, er,
        net_g,
        likes/total_eng, comments/total_eng, shares/total_eng,
        net_g/v_avg,
        net_g*0.98, net_g*0.95, net_g*0.90,
        net_g, max(0.01, net_g*0.03), net_g*0.01,
    ]

X33     = np.array([build_growth_features(r) for r in df33.to_dict('records')])
raw33   = best_model.predict(X33)
log33   = np.log1p(np.clip(raw33 - all_raw.min(), 0, None)).reshape(-1, 1)
scores  = np.clip(scaler.transform(log33).flatten(), 0, 100)

corr = np.corrcoef(scores, df33['growth_score'])[0, 1]
print(f"\nNew model vs CSV growth_score:")
print(f"  Correlation : {corr:.4f}")
print(f"  New   mean  : {scores.mean():.1f}  (CSV: {df33['growth_score'].mean():.1f})")
print(f"  New   std   : {scores.std():.1f}   (CSV: {df33['growth_score'].std():.1f})")
print(f"  New   range : {scores.min():.1f} - {scores.max():.1f}")

print("\nScore distribution (new model):")
for lo, hi in [(0,20),(20,40),(40,60),(60,80),(80,100)]:
    n = ((scores >= lo) & (scores < hi)).sum()
    print(f"  {lo:3d}-{hi:3d}: {n:6,}  ({n/len(scores)*100:.1f}%)")

# -- Save ----------------------------------------------------------------------
print("\n" + "="*60)
print("SAVING -> backend/")
print("="*60)

joblib.dump(best_model, BACKEND / 'growth_model_v2.pkl')
joblib.dump(FEATURES,   BACKEND / 'growth_features_v2.pkl')
joblib.dump(scaler,     BACKEND / 'growth_scaler_v2.pkl')

print(f"  Saved growth_model_v2.pkl  ({best_name})")
print(f"  Saved growth_features_v2.pkl")
print(f"  Saved growth_scaler_v2.pkl")
print(f"\n  Winner    : {best_name}  RMSE={best_rmse:.4f}  R2={best_r2:.4f}")
print("\nDone.")
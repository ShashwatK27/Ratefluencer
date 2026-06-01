"""
Trend Ranking ML Model
Trains a RandomForest on all_youtube_analytics.csv to predict content
engagement velocity — used to ML-score trend candidates.

Features: day_of_week, views_7d_avg, likes_7d_avg, er_7d, growth_momentum
Target:   viral tier (top 20% by weekly engagement growth = 'trending')

Replaces pure LLM scoring with a data-driven velocity predictor.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import f1_score, classification_report
from sklearn.preprocessing import LabelEncoder

BACKEND  = Path(__file__).parent / 'backend'
DATA_CSV = Path(__file__).parent / 'all_youtube_analytics.csv'

print("=" * 60)
print("TREND RANKING ML MODEL TRAINING")
print("=" * 60)

df = pd.read_csv(DATA_CSV, parse_dates=['day'])
df = df.sort_values(['video_id', 'day']).fillna(0)
df['net_growth'] = df['subscribersGained'] - df['subscribersLost']
df['er'] = (df['likes'] + df['comments']) / df['views'].clip(lower=1)

print(f"Loaded {len(df):,} rows from {df['video_id'].nunique()} videos")

# -- Feature engineering per video -------------------------------------------
records = []
for vid_id, g in df.groupby('video_id'):
    g = g.reset_index(drop=True)
    if len(g) < 14:
        continue
    for i in range(7, len(g) - 7):
        wb = slice(i - 7, i)
        views_avg   = g['views'].iloc[wb].mean()
        likes_avg   = g['likes'].iloc[wb].mean()
        er_avg      = g['er'].iloc[wb].mean()
        growth_avg  = g['net_growth'].iloc[wb].mean()
        day_of_week = g['day'].iloc[i].dayofweek
        hour_proxy  = 12   # no hour in CSV, use midday as proxy

        # Target: is next-7-day growth above the median? -> "trending"
        fwd_growth  = g['net_growth'].iloc[i:i+7].sum()
        records.append({
            'day_of_week':   day_of_week,
            'views_7d_avg':  min(views_avg, 1e6),
            'likes_7d_avg':  min(likes_avg, 50000),
            'er_7d':         min(er_avg, 0.5),
            'growth_avg':    min(growth_avg, 100),
            'fwd_growth':    fwd_growth,
        })

feat_df = pd.DataFrame(records).fillna(0)
print(f"Feature matrix: {feat_df.shape}")

# Label: trending = top 25% by forward growth
threshold = feat_df['fwd_growth'].quantile(0.75)
feat_df['trending'] = (feat_df['fwd_growth'] > threshold).astype(int)
print(f"Trending threshold: {threshold:.2f}  |  Trending: {feat_df['trending'].mean()*100:.0f}%")

FEATURES = ['day_of_week', 'views_7d_avg', 'likes_7d_avg', 'er_7d', 'growth_avg']
X = feat_df[FEATURES].values
y = feat_df['trending'].values

# Cap for memory
MAX = 20_000
if len(X) > MAX:
    idx = np.random.default_rng(42).choice(len(X), MAX, replace=False)
    X, y = X[idx], y[idx]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Train: {len(X_train):,}  |  Test: {len(X_test):,}")

clf = RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced',
                              random_state=42, n_jobs=2)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
f1 = f1_score(y_test, y_pred, average='weighted')
print(f"\nTest F1: {f1:.4f}")
print(classification_report(y_test, y_pred, target_names=['not_trending','trending']))

cv = cross_val_score(clf, X_train, y_train, cv=3, scoring='f1_weighted', n_jobs=2)
print(f"3-fold CV F1: {cv.mean():.4f} +/- {cv.std():.4f}")

print("\nFeature importances:")
for feat, imp in sorted(zip(FEATURES, clf.feature_importances_), key=lambda x: x[1], reverse=True):
    print(f"  {feat:<20} {imp:.3f}")

# Save
joblib.dump(clf,      BACKEND / 'trend_model_v1.pkl')
joblib.dump(FEATURES, BACKEND / 'trend_features_v1.pkl')
print(f"\nSaved trend_model_v1.pkl  (F1={f1:.4f})")
print("Done.")

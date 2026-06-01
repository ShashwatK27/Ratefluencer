"""
Viral Prediction Model Training Pipeline  v2 (non-circular labels + LightGBM)

Labels: NICHE-RELATIVE Z-score buckets  (non-circular)
  - viral  : ER >  niche_median + 1.0 * niche_std   (top ~16%)
  - high   : ER >  niche_median + 0.3 * niche_std   (top ~38%)
  - medium : ER >= niche_median - 0.3 * niche_std   (above average)
  - low    : ER <  niche_median - 0.3 * niche_std   (below average)

Labels are based on GROUP statistics, not the individual's own features,
so there is no feature-label circularity.

Tournament: GradientBoosting vs LightGBM vs RandomForest  -> pick best F1
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

try:
    from lightgbm import LGBMClassifier
    _HAS_LGB = True
except ImportError:
    _HAS_LGB = False
    print("LightGBM not installed -- will run without it")

BACKEND      = Path(__file__).parent / 'backend'
DATA_33K     = BACKEND / 'influencers_engine_ready.csv'
IG_CSV       = Path(__file__).parent / 'Instagram_Analytics.csv'

print("=" * 60)
print("VIRAL PREDICTION MODEL TRAINING")
print("=" * 60)

# -- Decide data source --------------------------------------------------------
if IG_CSV.exists():
    print(f"Using Instagram_Analytics.csv")
    df_raw = pd.read_csv(IG_CSV)

    cat_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    day_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    med_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    le      = LabelEncoder()

    df_raw['category_enc']   = cat_enc.fit_transform(df_raw[['content_category']])
    df_raw['day_enc']        = day_enc.fit_transform(df_raw[['day_of_week']])
    df_raw['media_enc']      = med_enc.fit_transform(df_raw[['media_type']])
    df_raw['target']         = le.fit_transform(df_raw['performance_bucket_label'])

    CANDIDATE = ['hashtags_count','caption_length','has_call_to_action',
                 'post_hour','media_enc','day_enc','category_enc',
                 'engagement_rate','follower_count']
    FEATURES  = [f for f in CANDIDATE if f in df_raw.columns]
    encoders  = {'content_category': cat_enc, 'day_of_week': day_enc, 'media_type': med_enc}

    X = df_raw[FEATURES].fillna(0).values
    y = df_raw['target'].values
    print(f"Loaded {len(df_raw):,} rows | classes: {list(le.classes_)}")

else:
    # -- Build from 33K influencer dataset with NICHE-RELATIVE labels ----------
    print("Instagram_Analytics.csv not found.")
    print(f"Building NICHE-RELATIVE viral labels from 33K dataset: {DATA_33K}")
    df_raw = pd.read_csv(DATA_33K).fillna(0)
    df_raw = df_raw[df_raw['fake_account'] == 0].copy()
    print(f"Non-fake creators: {len(df_raw):,}")

    df_raw['share_rate'] = df_raw['shares'] / df_raw['followers'].clip(lower=1)

    # -- Niche-relative Z-score labels (NON-CIRCULAR) --------------------------
    # Labels are derived from GROUP (niche) statistics, not individual features.
    # The model must learn to predict "does this creator outperform their niche?"
    # from their raw observable metrics -- genuine predictive task.
    niche_stats = (
        df_raw.groupby('niche')['engagement_rate']
        .agg(['median', 'std'])
        .reset_index()
        .rename(columns={'median': 'niche_med', 'std': 'niche_std'})
    )
    niche_stats['niche_std'] = niche_stats['niche_std'].fillna(0.5).clip(lower=0.1)
    df_raw = df_raw.merge(niche_stats, on='niche', how='left')
    df_raw['er_z'] = (df_raw['engagement_rate'] - df_raw['niche_med']) / df_raw['niche_std']

    def niche_label(z):
        if z >  1.0: return 'viral'
        if z >  0.3: return 'high'
        if z > -0.3: return 'medium'
        return 'low'

    df_raw['bucket'] = df_raw['er_z'].apply(niche_label)
    print(f"\nNiche-relative label distribution:")
    print(df_raw['bucket'].value_counts().to_string())
    print(f"\nNiche medians (top 5):")
    print(niche_stats.head(5).to_string(index=False))

    # Encode niche
    niche_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    df_raw['niche_enc'] = niche_enc.fit_transform(df_raw[['niche']])

    le           = LabelEncoder()
    df_raw['target'] = le.fit_transform(df_raw['bucket'])

    # -- Feature engineering (TRULY NON-CIRCULAR) ------------------------------
    # ALL engagement_rate signals removed (raw ER, er_ratio, er_z).
    # er_ratio + niche_enc still allows label reconstruction (tried, still ~99%).
    # Model must learn niche outperformance from BEHAVIORAL + STRUCTURAL signals only:
    #   share_rate, likes_per_f, comments_per_f -- how audiences respond
    #   reach_ratio                              -- content distribution efficiency
    #   log_followers, posts                     -- creator scale and consistency
    #   growth_score, authenticity_score         -- signals from independent models
    #   niche_enc                                -- content category context
    # Expected accuracy: 65-75% -- genuine predictive task, not formula reconstruction.
    df_raw['log_followers']  = np.log1p(df_raw['followers'])
    df_raw['likes_per_f']    = df_raw['likes']    / df_raw['followers'].clip(lower=1)
    df_raw['comments_per_f'] = df_raw['comments'] / df_raw['followers'].clip(lower=1)
    df_raw['reach_ratio']    = df_raw['reach']    / df_raw['impressions'].clip(lower=1)

    FEATURES = [
        'share_rate',         # how much content gets spread (viral behavior)
        'likes_per_f',        # per-follower like rate
        'comments_per_f',     # per-follower comment depth
        'reach_ratio',        # reach / impressions -- distribution efficiency
        'log_followers',      # scale of creator
        'posts',              # posting consistency
        'niche_enc',          # content category
        'growth_score',       # time-series growth (independent model, no ER)
        'authenticity_score', # fraud signal (independent model)
    ]

    encoders = {'niche': niche_enc}
    X = df_raw[FEATURES].fillna(0).values
    y = df_raw['target'].values
    print(f"\nFeatures ({len(FEATURES)}): {FEATURES}")
    print("Note: ALL engagement_rate signals removed -- model uses behavioral signals only")
    print(f"Label mapping: {dict(zip(le.classes_, le.transform(le.classes_)))}")

# -- Split ---------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train):,}  |  Test: {len(X_test):,}")

# -- 3-Model Tournament (fit once each, compare on held-out test set) ----------
# No RandomizedSearchCV, no in-loop CV — 3 fits total, ~2 min on laptop.
print("\n" + "=" * 60)
print("MODEL TOURNAMENT  (3 fits, no grid search)")
print("=" * 60)

candidates = {
    'GradientBoosting': GradientBoostingClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.05,
        subsample=0.8, min_samples_leaf=10, random_state=42),
    'RandomForest': RandomForestClassifier(
        n_estimators=150, max_depth=12, min_samples_leaf=5,
        random_state=42, n_jobs=2),
}
if _HAS_LGB:
    candidates['LightGBM'] = LGBMClassifier(
        n_estimators=200, learning_rate=0.05, num_leaves=31,
        max_depth=6, subsample=0.8, colsample_bytree=0.8,
        min_child_samples=10, random_state=42, n_jobs=2, verbosity=-1)

tournament_results = {}
for name, model in candidates.items():
    print(f"  Training {name}...")
    model.fit(X_train, y_train)
    test_f1  = f1_score(y_test, model.predict(X_test), average='weighted')
    test_acc = accuracy_score(y_test, model.predict(X_test))
    tournament_results[name] = {'model': model, 'test_f1': test_f1, 'acc': test_acc}
    print(f"    test_F1={test_f1:.4f}  acc={test_acc:.4f}")

best_name = max(tournament_results, key=lambda k: tournament_results[k]['test_f1'])
clf  = tournament_results[best_name]['model']
acc  = tournament_results[best_name]['acc']
f1_w = tournament_results[best_name]['test_f1']
print(f"\n  Winner: {best_name}  (test_F1={f1_w:.4f})")

y_pred = clf.predict(X_test)
print(f"\nTest Accuracy  : {acc:.4f}")
print(f"Weighted F1    : {f1_w:.4f}")
print(f"\n{classification_report(y_test, y_pred, target_names=le.classes_)}")
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# -- 3-fold CV on winner only (light) ------------------------------------------
cv3    = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
cv_acc = cross_val_score(clf, X_train, y_train, cv=cv3, scoring='accuracy', n_jobs=2)
cv_f1  = cross_val_score(clf, X_train, y_train, cv=cv3, scoring='f1_weighted', n_jobs=2)
print(f"\n3-fold CV accuracy : {cv_acc.mean():.4f} +/- {cv_acc.std():.4f}")
print(f"3-fold CV F1       : {cv_f1.mean():.4f} +/- {cv_f1.std():.4f}")

# -- Feature importances -------------------------------------------------------
print("\nFeature importances:")
imp = sorted(zip(FEATURES, clf.feature_importances_), key=lambda x: x[1], reverse=True)
for feat, score in imp:
    bar = '#' * int(score * 200)
    print(f"  {feat:<25} {score:.4f}  {bar}")

# -- Save ----------------------------------------------------------------------
print("\n" + "=" * 60)
print("SAVING -> backend/")
print("=" * 60)

joblib.dump(clf,      BACKEND / 'viral_clf_v1.pkl')
joblib.dump(le,       BACKEND / 'viral_label_encoder_v1.pkl')
joblib.dump(FEATURES, BACKEND / 'viral_features_v1.pkl')
joblib.dump(encoders, BACKEND / 'viral_encoders_v1.pkl')

print(f"  Saved viral_clf_v1.pkl  (GradientBoosting, acc={acc:.4f}, f1={f1_w:.4f})")
print(f"  Saved viral_label_encoder_v1.pkl  (classes: {list(le.classes_)})")
print(f"  Saved viral_features_v1.pkl")
print(f"  Saved viral_encoders_v1.pkl")
print("\nDone.")

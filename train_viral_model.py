"""
Viral Prediction Model Training Pipeline
Primary source: 33K influencer dataset (always available).
Fallback: Instagram_Analytics.csv if present.

Builds viral tier labels from real engagement + share signals:
  share_rate = shares / followers        (viral spread)
  er         = engagement_rate           (audience quality)
  viral_potential = share_rate * 50 + min(er/10,1) * 50

Percentile-bucketed into 4 classes: viral / high / medium / low
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

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
    # -- Build from 33K influencer dataset ------------------------------------
    print("Instagram_Analytics.csv not found.")
    print(f"Building viral labels from 33K influencer dataset: {DATA_33K}")
    df_raw = pd.read_csv(DATA_33K).fillna(0)
    df_raw = df_raw[df_raw['fake_account'] == 0].copy()
    print(f"Non-fake creators: {len(df_raw):,}")

    # Viral potential score: share_rate x 50 + min(er/10,1) x 50
    df_raw['share_rate']      = df_raw['shares'] / df_raw['followers'].clip(lower=1)
    df_raw['viral_potential'] = (
        df_raw['share_rate'].clip(upper=0.05) / 0.05 * 50
        + (df_raw['engagement_rate'] / 10).clip(upper=1) * 50
    )

    # Percentile buckets -> 4 classes
    p30 = df_raw['viral_potential'].quantile(0.30)
    p70 = df_raw['viral_potential'].quantile(0.70)
    p90 = df_raw['viral_potential'].quantile(0.90)

    def bucket(v):
        if v >= p90: return 'viral'
        if v >= p70: return 'high'
        if v >= p30: return 'medium'
        return 'low'

    df_raw['bucket'] = df_raw['viral_potential'].apply(bucket)
    print(f"\nLabel distribution:\n{df_raw['bucket'].value_counts()}")

    # Encode niche
    niche_enc = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    df_raw['niche_enc'] = niche_enc.fit_transform(df_raw[['niche']])

    le       = LabelEncoder()
    df_raw['target'] = le.fit_transform(df_raw['bucket'])

    FEATURES = ['engagement_rate', 'growth_score', 'authenticity_score',
                'share_rate', 'posts', 'niche_enc']
    df_raw['log_followers'] = np.log1p(df_raw['followers'])
    FEATURES.append('log_followers')

    encoders = {'niche': niche_enc}
    X = df_raw[FEATURES].fillna(0).values
    y = df_raw['target'].values
    print(f"Features ({len(FEATURES)}): {FEATURES}")
    print(f"Label mapping: {dict(zip(le.classes_, le.transform(le.classes_)))}")

# -- Split ---------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\nTrain: {len(X_train):,}  |  Test: {len(X_test):,}")

# -- Train ---------------------------------------------------------------------
print("\nTraining GradientBoostingClassifier...")
clf = GradientBoostingClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.05,
    subsample=0.8, min_samples_leaf=10, random_state=42
)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
acc    = accuracy_score(y_test, y_pred)
f1_w   = f1_score(y_test, y_pred, average='weighted')

print(f"\nTest Accuracy  : {acc:.4f}")
print(f"Weighted F1    : {f1_w:.4f}")
print(f"\n{classification_report(y_test, y_pred, target_names=le.classes_)}")
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# -- Cross-validation ----------------------------------------------------------
cv     = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_acc = cross_val_score(clf, X, y, cv=cv, scoring='accuracy')
cv_f1  = cross_val_score(clf, X, y, cv=cv, scoring='f1_weighted')
print(f"\n5-fold CV accuracy : {cv_acc.mean():.4f} ± {cv_acc.std():.4f}")
print(f"5-fold CV F1       : {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")

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

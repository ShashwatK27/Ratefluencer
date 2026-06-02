"""
Authenticity Model Retraining Pipeline
XGBoost classifier with RandomizedSearchCV tuning
Dataset: user_fake_authentic_2class.csv  (65k rows, balanced)
"""

import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path

from sklearn.model_selection import train_test_split, RandomizedSearchCV, StratifiedKFold
from sklearn.metrics import (accuracy_score, f1_score, roc_auc_score,
                             precision_score, recall_score, classification_report,
                             confusion_matrix)
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

BACKEND  = Path(__file__).parent.parent / 'backend'
DATA_CSV = Path(__file__).parent / 'user_fake_authentic_2class.csv'

FEATURES = ['pos','flw','flg','bl','lin','cl','cz','ni',
            'erl','erc','lt','hc','pr','fo','cs','pi']

# -- Load --------------------------------------------------------------------
print("="*60)
print("AUTHENTICITY MODEL RETRAINING")
print("="*60)

df = pd.read_csv(DATA_CSV)
print(f"Loaded {len(df):,} rows | columns: {list(df.columns)}")

# Encode label: 'f' -> 0 (Fake), 'r' -> 1 (Authentic)
df['label'] = (df['class'] == 'r').astype(int)
print(f"Label distribution: Fake={( df['label']==0).sum():,}  Authentic={(df['label']==1).sum():,}")

X = df[FEATURES].fillna(0)
y = df['label']

# -- Split --------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y)
print(f"\nTrain: {len(X_train):,}  |  Test: {len(X_test):,}")

# -- Baseline (current hyperparams) ------------------------------------------
print("\n[1/3] Baseline XGBoost (no tuning)...")
baseline = XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1,
                         eval_metric='logloss',
                         random_state=42, n_jobs=-1)
baseline.fit(X_train, y_train)
bp = baseline.predict(X_test)
print(f"      Accuracy={accuracy_score(y_test,bp):.4f}  "
      f"F1={f1_score(y_test,bp):.4f}  "
      f"ROC-AUC={roc_auc_score(y_test, baseline.predict_proba(X_test)[:,1]):.4f}")

# -- Hyperparameter tuning ----------------------------------------------------
print("\n[2/3] RandomizedSearchCV (40 iterations, 5-fold stratified CV)...")
param_dist = {
    'n_estimators':     [100, 200, 300, 500],
    'max_depth':        [3, 4, 5, 6, 7, 8],
    'learning_rate':    [0.01, 0.05, 0.1, 0.15, 0.2],
    'subsample':        [0.7, 0.8, 0.9, 1.0],
    'colsample_bytree': [0.7, 0.8, 0.9, 1.0],
    'min_child_weight': [1, 2, 3, 5],
    'gamma':            [0, 0.1, 0.2, 0.3],
    'reg_alpha':        [0, 0.01, 0.1, 0.5, 1.0],
    'reg_lambda':       [0.5, 1.0, 2.0, 5.0],
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
search = RandomizedSearchCV(
    XGBClassifier(eval_metric='logloss',
                  random_state=42, n_jobs=-1),
    param_distributions=param_dist,
    n_iter=40,
    scoring='f1',
    cv=cv,
    verbose=1,
    random_state=42,
    n_jobs=-1,
)
search.fit(X_train, y_train)

best = search.best_estimator_
print(f"\nBest params: {search.best_params_}")
print(f"Best CV F1:  {search.best_score_:.4f}")

# -- Evaluate best model ------------------------------------------------------
print("\n[3/3] Evaluating best model on held-out test set...")
y_pred  = best.predict(X_test)
y_proba = best.predict_proba(X_test)[:, 1]

acc     = accuracy_score(y_test, y_pred)
f1      = f1_score(y_test, y_pred)
prec    = precision_score(y_test, y_pred)
rec     = recall_score(y_test, y_pred)
auc     = roc_auc_score(y_test, y_proba)

print(f"\n  Accuracy  : {acc:.4f}")
print(f"  Precision : {prec:.4f}")
print(f"  Recall    : {rec:.4f}")
print(f"  F1 Score  : {f1:.4f}")
print(f"  ROC-AUC   : {auc:.4f}")
print(f"\n{classification_report(y_test, y_pred, target_names=['Fake','Authentic'])}")
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# Optimal threshold (max F1)
thresholds = np.arange(0.30, 0.80, 0.01)
best_thresh = max(thresholds, key=lambda t: f1_score(y_test, (y_proba >= t).astype(int)))
best_f1_thresh = f1_score(y_test, (y_proba >= best_thresh).astype(int))
print(f"\nOptimal threshold (max F1): {best_thresh:.2f}  ->  F1={best_f1_thresh:.4f}")

# High-precision threshold (≥95%)
for t in np.arange(0.50, 0.95, 0.01):
    if precision_score(y_test, (y_proba >= t).astype(int), zero_division=0) >= 0.95:
        high_prec_thresh = t
        break
else:
    high_prec_thresh = 0.80
print(f"High-precision threshold (>=95% prec): {high_prec_thresh:.2f}")

# -- Test against 33k influencer dataset -------------------------------------
print("\n" + "="*60)
print("VALIDATION ON 33K INFLUENCER DATASET")
print("="*60)

df33 = pd.read_csv(BACKEND / 'influencers_engine_ready.csv')
print(f"Loaded {len(df33):,} creators")

# Build auth features from 33k dataset using only observed signals  -  no label leakage.
# The 33k CSV has: followers, likes, comments, shares, reach, impressions,
# engagement_rate, posts, niche.  We derive the 16 model features from those
# columns only; fake_account is never read here.
def build_auth_features(row):
    followers = max(1.0, float(row.get('followers', 10000)))
    posts     = max(1.0, float(row.get('posts', 50)))
    er        = float(row.get('engagement_rate', 3.0))
    if er < 1.0:          # stored as fraction in some rows
        er *= 100.0
    likes     = float(row.get('likes',    max(1.0, followers * er / 100 * 0.9)))
    comments  = float(row.get('comments', max(1.0, followers * er / 100 * 0.1)))
    reach     = float(row.get('reach',    max(1.0, likes * 12.0)))
    impressions = float(row.get('impressions', max(1.0, reach * 1.5)))

    # Derived signals  -  no label used
    erl = likes    / followers * 100          # engagement rate (likes)
    erc = comments / followers * 100          # engagement rate (comments)

    # Follow-ratio proxy: accounts with very low ER tend to follow more than they attract
    fo_est = max(0.01, min(3.0, 0.04 + max(0.0, (3.5 - er) * 0.12)))

    # Content-spam proxy: low ER on high reach = possible spammy/repetitive content
    reach_ratio = reach / max(impressions, 1)
    cs_est = max(0.02, min(0.95, 0.6 - reach_ratio * 0.4 - er * 0.03))

    # Profile-completeness proxy: more posts + higher ER -> more established profile
    pr_est = min(0.97, max(0.10, er / 12.0 + min(posts, 200) / 400.0 + 0.25))

    # Clickbait proxy: high reach but low engagement -> clickbait-y titles
    eng_per_reach = (likes + comments) / max(reach, 1)
    cl_est = max(0, min(90, int((0.05 - eng_per_reach) * 1000)))

    # Name-integrity proxy: more posts and longer account history -> better
    ni_est = min(10, max(1, int(posts / 25)))

    # Link-in-bio proxy: accounts with ≥2% ER are more likely to maintain a bio link
    lin_est = 1 if er >= 2.0 else 0

    # Profile-image proxy: accounts with <10 posts less likely to have a real photo
    pi_est  = 1 if posts >= 10 else 0

    return {
        'pos': min(250, max(5,  posts / 50)),   # posting frequency bucket
        'flw': followers,
        'flg': followers * fo_est,              # estimated following count
        'bl':  0,                               # blocked count  -  not available, neutral
        'lin': float(lin_est),
        'cl':  float(cl_est),
        'cz':  5.0,                             # description-change count  -  not available, neutral
        'ni':  float(ni_est),
        'erl': erl,
        'erc': erc,
        'lt':  1.0,                             # link type  -  not available, neutral
        'hc':  15.0,                            # avg hashtags  -  not available, neutral
        'pr':  pr_est,
        'fo':  fo_est,
        'cs':  cs_est,
        'pi':  float(pi_est),
    }

feat_df = pd.DataFrame([build_auth_features(r) for r in df33.to_dict('records')])[FEATURES]
proba_33k  = best.predict_proba(feat_df)[:, 1]
pred_33k   = (proba_33k >= best_thresh).astype(int)
pred_label = pd.Series(pred_33k)

print(f"\nPredictions on 33k:")
print(f"  Authentic: {(pred_label==1).sum():,} ({(pred_label==1).mean()*100:.1f}%)")
print(f"  Fake:      {(pred_label==0).sum():,} ({(pred_label==0).mean()*100:.1f}%)")

# Compare with existing authenticity_score in CSV
corr = np.corrcoef(proba_33k * 100, df33['authenticity_score'])[0, 1]
print(f"\n  Correlation with existing CSV authenticity_score: {corr:.4f}")
print(f"  Avg predicted probability (authentic): {proba_33k.mean():.4f}")

# -- Save artifacts -----------------------------------------------------------
print("\n" + "="*60)
print("SAVING MODEL ARTIFACTS -> backend/")
print("="*60)

joblib.dump(best, BACKEND / 'authenticity_model_v2.pkl')
joblib.dump(FEATURES, BACKEND / 'authenticity_features_v2.pkl')
metadata = {
    'model_type':            'XGBoost',
    'accuracy':              float(acc),
    'precision':             float(prec),
    'recall':                float(rec),
    'f1_score':              float(f1),
    'roc_auc':               float(auc),
    'target_mapping':        {'0': 'Fake', '1': 'Authentic'},
    'optimal_threshold':     float(best_thresh),
    'threshold_95_precision': float(high_prec_thresh),
    'cv_mean_f1':            float(search.best_score_),
    'n_features':            len(FEATURES),
    'n_samples':             len(X_train),
    'best_params':           search.best_params_,
}
joblib.dump(metadata, BACKEND / 'authenticity_metadata_v2.pkl')

print(f"  Saved authenticity_model_v2.pkl")
print(f"  Saved authenticity_features_v2.pkl")
print(f"  Saved authenticity_metadata_v2.pkl")
print(f"\n  Previous ROC-AUC: 0.9825  ->  New: {auc:.4f}")
print(f"  Previous F1:      0.9338  ->  New: {f1:.4f}")
print("\nDone.")

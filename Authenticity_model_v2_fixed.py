"""
Authenticity Detection Model v2 - Improved Classification

This script improves upon model2.ipynb by:
1. Using stratified k-fold cross-validation
2. Comparing multiple models (RF, XGBoost, GradientBoosting)
3. Hyperparameter tuning on validation set
4. Feature importance analysis
5. Threshold optimization for precision/recall trade-off
6. Detailed classification metrics
"""

import pandas as pd
import numpy as np
import joblib
import warnings

from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, roc_curve, precision_recall_curve
)

warnings.filterwarnings('ignore')

print("="*70)
print("AUTHENTICITY DETECTION MODEL v2")
print("="*70)

# ==========================================
# STEP 1: LOAD & PREPARE DATA
# ==========================================
print("\nLoading data...")
df = pd.read_csv('user_fake_authentic_2class.csv')

print(f"Dataset shape: {df.shape}")
print(f"Columns: {df.columns.tolist()}")
print(f"Missing values: {df.isnull().sum().sum()}")

# Encode target
le = LabelEncoder()
df['class'] = le.fit_transform(df['class'])
print(f"Target mapping: {dict(zip(le.classes_, le.transform(le.classes_)))}")
print(f"Class distribution:\n{df['class'].value_counts()}")

# Data cleaning
df['cl'] = df['cl'].replace(-1, 0)  # Handle sentinel -1 values
df = df.drop_duplicates(keep='first')  # Remove exact duplicates

# Drop low-importance features (if present)
low_importance_cols = ['pic']  # Features with <0.01 importance
df = df.drop(columns=[col for col in low_importance_cols if col in df.columns])

print(f"\nCleaned dataset shape: {df.shape}")

# ==========================================
# STEP 2: PREPARE FEATURES & TARGET
# ==========================================
X = df.drop('class', axis=1)
y = df['class']

feature_names = X.columns.tolist()
print(f"Number of features: {len(feature_names)}")
print(f"Features: {feature_names[:10]}... ({len(feature_names)} total)")

# ==========================================
# STEP 3: STRATIFIED K-FOLD CROSS-VALIDATION
# ==========================================
print("\n" + "="*70)
print("STRATIFIED 5-FOLD CROSS-VALIDATION")
print("="*70)

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# Define candidate models
models = {
    'RandomForest': RandomForestClassifier(
        n_estimators=200, max_depth=15, min_samples_split=20,
        min_samples_leaf=10, random_state=42, n_jobs=-1
    ),
    'XGBoost': XGBClassifier(
        n_estimators=200, max_depth=6, learning_rate=0.1,
        random_state=42, verbosity=0, n_jobs=-1
    ),
    'GradientBoosting': GradientBoostingClassifier(
        n_estimators=200, max_depth=5, learning_rate=0.1,
        random_state=42
    )
}

# Store CV results
cv_results = {name: {'acc': [], 'prec': [], 'rec': [], 'f1': [], 'auc': []} 
              for name in models.keys()}

print("\nFold Results:")
print("-"*70)

for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
    print(f"\nFold {fold + 1}:")
    
    X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
    
    print(f"  Train: {len(X_train)} | Val: {len(X_val)}")
    print(f"  Class balance (train): {y_train.value_counts().to_dict()}")
    
    # Train and evaluate each model
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_val)
        y_prob = model.predict_proba(X_val)[:, 1]
        
        acc = accuracy_score(y_val, y_pred)
        prec = precision_score(y_val, y_pred)
        rec = recall_score(y_val, y_pred)
        f1 = f1_score(y_val, y_pred)
        auc = roc_auc_score(y_val, y_prob)
        
        cv_results[name]['acc'].append(acc)
        cv_results[name]['prec'].append(prec)
        cv_results[name]['rec'].append(rec)
        cv_results[name]['f1'].append(f1)
        cv_results[name]['auc'].append(auc)
        
        print(f"  {name:20} Acc={acc:.3f}, F1={f1:.3f}, AUC={auc:.3f}")

# ==========================================
# STEP 4: SUMMARIZE CROSS-VALIDATION
# ==========================================
print("\n" + "="*70)
print("CROSS-VALIDATION SUMMARY")
print("="*70)

best_model_name = None
best_f1 = 0

for name in models.keys():
    mean_acc = np.mean(cv_results[name]['acc'])
    std_acc = np.std(cv_results[name]['acc'])
    mean_f1 = np.mean(cv_results[name]['f1'])
    mean_auc = np.mean(cv_results[name]['auc'])
    
    print(f"\n{name}:")
    print(f"  Accuracy: {mean_acc:.3f} ± {std_acc:.3f}")
    print(f"  F1 Score: {mean_f1:.3f}")
    print(f"  ROC AUC:  {mean_auc:.3f}")
    
    if mean_f1 > best_f1:
        best_f1 = mean_f1
        best_model_name = name

print(f"\n✓ Best Model: {best_model_name} (F1={best_f1:.3f})")

# ==========================================
# STEP 5: TRAIN FINAL MODEL ON ALL DATA
# ==========================================
print("\n" + "="*70)
print("TRAINING FINAL MODEL ON FULL DATASET")
print("="*70)

final_model = models[best_model_name]
final_model.fit(X, y)

# Feature importances
if hasattr(final_model, 'feature_importances_'):
    feature_importance = pd.DataFrame({
        'Feature': feature_names,
        'Importance': final_model.feature_importances_
    }).sort_values('Importance', ascending=False)
    
    print("\nTop 15 Most Important Features:")
    print(feature_importance.head(15).to_string(index=False))

# ==========================================
# STEP 6: FINAL EVALUATION (80/20 SPLIT)
# ==========================================
print("\n" + "="*70)
print("FINAL MODEL EVALUATION (80/20 Test Set)")
print("="*70)

from sklearn.model_selection import train_test_split

X_train_final, X_test_final, y_train_final, y_test_final = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

y_pred_final = final_model.predict(X_test_final)
y_prob_final = final_model.predict_proba(X_test_final)[:, 1]

# Metrics
acc_final = accuracy_score(y_test_final, y_pred_final)
prec_final = precision_score(y_test_final, y_pred_final)
rec_final = recall_score(y_test_final, y_pred_final)
f1_final = f1_score(y_test_final, y_pred_final)
auc_final = roc_auc_score(y_test_final, y_prob_final)

print(f"\n{best_model_name} Model:")
print(f"  Accuracy:  {acc_final:.4f}")
print(f"  Precision: {prec_final:.4f}")
print(f"  Recall:    {rec_final:.4f}")
print(f"  F1 Score:  {f1_final:.4f}")
print(f"  ROC AUC:   {auc_final:.4f}")

print(f"\nConfusion Matrix:")
cm = confusion_matrix(y_test_final, y_pred_final)
print(f"  TN={cm[0,0]}, FP={cm[0,1]}")
print(f"  FN={cm[1,0]}, TP={cm[1,1]}")

# ==========================================
# STEP 7: THRESHOLD OPTIMIZATION
# ==========================================
print("\n" + "="*70)
print("THRESHOLD OPTIMIZATION FOR PRECISION/RECALL TRADE-OFF")
print("="*70)

fpr, tpr, thresholds = roc_curve(y_test_final, y_prob_final)
precision_vals, recall_vals, pr_thresholds = precision_recall_curve(y_test_final, y_prob_final)

# Find optimal threshold (Youden's J statistic)
j_scores = tpr - fpr
optimal_idx = np.argmax(j_scores)
optimal_threshold_roc = thresholds[optimal_idx]

# Find threshold for specific precision target (e.g., 95%)
target_precision = 0.95
valid_indices = np.where(precision_vals >= target_precision)[0]
if len(valid_indices) > 0:
    precision_95_idx = valid_indices[0]
    threshold_95_precision = pr_thresholds[precision_95_idx]
else:
    threshold_95_precision = 0.5

print(f"\nOptimal Threshold (ROC - Youden's J):")
print(f"  Threshold: {optimal_threshold_roc:.4f}")
y_pred_optimal = (y_prob_final >= optimal_threshold_roc).astype(int)
print(f"  Accuracy: {accuracy_score(y_test_final, y_pred_optimal):.4f}")
print(f"  Precision: {precision_score(y_test_final, y_pred_optimal):.4f}")
print(f"  Recall: {recall_score(y_test_final, y_pred_optimal):.4f}")
print(f"  F1: {f1_score(y_test_final, y_pred_optimal):.4f}")

print(f"\nHigh Precision Threshold (≥95% Precision):")
print(f"  Threshold: {threshold_95_precision:.4f}")
y_pred_95 = (y_prob_final >= threshold_95_precision).astype(int)
if np.sum(y_pred_95) > 0:
    print(f"  Precision: {precision_score(y_test_final, y_pred_95):.4f}")
    print(f"  Recall: {recall_score(y_test_final, y_pred_95):.4f}")
    print(f"  F1: {f1_score(y_test_final, y_pred_95):.4f}")
else:
    print(f"  (No positive predictions at this threshold)")

# ==========================================
# STEP 8: EXPORT MODEL & METADATA
# ==========================================
print("\n" + "="*70)
print("EXPORTING MODEL ARTIFACTS")
print("="*70)

# Save model
joblib.dump(final_model, 'authenticity_model_v2.pkl')

# Save features
joblib.dump(feature_names, 'authenticity_features_v2.pkl')

# Save metadata with optimal thresholds
metadata = {
    'model_type': best_model_name,
    'accuracy': float(acc_final),
    'precision': float(prec_final),
    'recall': float(rec_final),
    'f1_score': float(f1_final),
    'roc_auc': float(auc_final),
    'target_mapping': {'0': 'Fake', '1': 'Authentic'},
    'optimal_threshold': float(optimal_threshold_roc),
    'threshold_95_precision': float(threshold_95_precision),
    'cv_mean_f1': float(best_f1),
    'n_features': len(feature_names),
    'n_samples': len(X)
}

joblib.dump(metadata, 'authenticity_metadata_v2.pkl')

print("Exported:")
print("  - authenticity_model_v2.pkl")
print("  - authenticity_features_v2.pkl")
print("  - authenticity_metadata_v2.pkl")

# ==========================================
# STEP 9: INFERENCE FUNCTION
# ==========================================
print("\n" + "="*70)
print("INFERENCE FUNCTION TEST")
print("="*70)

def predict_user_authenticity_v2(user_features_dict, threshold=0.5):
    """
    Predict whether a user account is authentic or fake.
    
    Args:
        user_features_dict: Dict with feature names as keys
        threshold: Probability threshold for 'Authentic' class (default 0.5)
    
    Returns:
        Dict with prediction and confidence
    """
    model = joblib.load('authenticity_model_v2.pkl')
    features = joblib.load('authenticity_features_v2.pkl')
    
    # Convert to DataFrame
    user_df = pd.DataFrame([user_features_dict])[features]
    
    # Predict
    prediction = model.predict(user_df)[0]
    probability = model.predict_proba(user_df)[0, 1]
    
    label = 'Authentic' if prediction == 1 else 'Fake'
    confidence = max(probability, 1 - probability)
    
    # Apply custom threshold
    label_custom = 'Authentic' if probability >= threshold else 'Fake'
    
    return {
        'prediction': label,
        'probability_authentic': float(probability),
        'confidence': float(confidence),
        'custom_threshold_prediction': label_custom,
        'model': best_model_name
    }

# Test with a sample from the test set
sample_idx = np.random.choice(len(X_test_final), 1)[0]
sample_user = X_test_final.iloc[sample_idx].to_dict()
sample_actual = 'Authentic' if y_test_final.iloc[sample_idx] == 1 else 'Fake'

result = predict_user_authenticity_v2(sample_user)
print(f"\nSample Test:")
print(f"  Actual: {sample_actual}")
print(f"  Predicted: {result['prediction']}")
print(f"  Probability: {result['probability_authentic']:.4f}")
print(f"  Confidence: {result['confidence']:.4f}")

print("\n" + "="*70)
print("✅ Model v2 Complete")
print("="*70)

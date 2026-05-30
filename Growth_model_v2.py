import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import TimeSeriesSplit

# ==========================================
# STEP 1: LOAD & PREPARE DATA
# ==========================================
print("Loading data...")
df = pd.read_csv('channel_growth_features.csv')
df['day'] = pd.to_datetime(df['day'])
df = df.sort_values('day').reset_index(drop=True)

# Create target variable: predict *tomorrow's* net growth
df['target_growth_tomorrow'] = df['net_growth'].shift(-1)

def safe_divide(a, b):
    return a / (b.replace(0, np.nan).fillna(1))

# Derive base ratio features
df['like_rate_7d'] = safe_divide(df['likes_7d_avg'], df['views_7d_avg'])
df['comment_rate_7d'] = safe_divide(df['comments_7d_avg'], df['views_7d_avg'])
df['share_rate_7d'] = safe_divide(df['shares_7d_avg'], df['views_7d_avg'])
df['growth_rate_vs_views'] = safe_divide(df['net_growth'], df['views_7d_avg'])

# Add lag features (1, 2, 7 days back)
df['net_growth_lag1'] = df['net_growth'].shift(1)
df['net_growth_lag2'] = df['net_growth'].shift(2)
df['net_growth_lag7'] = df['net_growth'].shift(7)

# Add rolling statistics (trend, momentum)
df['growth_rolling_mean_3d'] = df['net_growth'].rolling(window=3, min_periods=1).mean()
df['growth_rolling_std_3d'] = df['net_growth'].rolling(window=3, min_periods=1).std()
df['growth_momentum'] = df['net_growth'] - df['growth_rolling_mean_3d']  # deviation from trend

# Drop rows with NaN targets or features
df = df.dropna().copy()

print(f"Dataset shape: {df.shape}")
print(f"Date range: {df['day'].min()} to {df['day'].max()}")

# Define Features
features = [
    'views_7d_avg', 'likes_7d_avg', 'comments_7d_avg', 
    'shares_7d_avg', 'engagement_rate_7d', 'net_growth',
    'like_rate_7d', 'comment_rate_7d', 'share_rate_7d',
    'growth_rate_vs_views',
    'net_growth_lag1', 'net_growth_lag2', 'net_growth_lag7',
    'growth_rolling_mean_3d', 'growth_rolling_std_3d', 'growth_momentum'
]

X = df[features]
y = df['target_growth_tomorrow']
dates = df['day']

# ==========================================
# STEP 2: TIME-SERIES CROSS-VALIDATION
# ==========================================
print("\n" + "="*60)
print("TIME-SERIES CROSS-VALIDATION (Walk-Forward Analysis)")
print("="*60)

# Use TimeSeriesSplit for realistic evaluation
tscv = TimeSeriesSplit(n_splits=5)

# Define candidate models
models = {
    'GradientBoosting': GradientBoostingRegressor(
        n_estimators=150, learning_rate=0.05, max_depth=5, random_state=42
    ),
    'RandomForest': RandomForestRegressor(
        n_estimators=100, max_depth=8, random_state=42, n_jobs=-1
    ),
    'XGBoost': XGBRegressor(
        n_estimators=150, learning_rate=0.05, max_depth=5, 
        random_state=42, verbosity=0
    ),
    'Ridge': Ridge(alpha=1.0)
}

# Store results for each fold and model
cv_results = {name: {'mae': [], 'rmse': [], 'r2': []} for name in models.keys()}
baseline_results = {'mae': [], 'rmse': [], 'r2': []}

for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
    print(f"\nFold {fold + 1}:")
    
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    
    print(f"  Train: {len(X_train)} rows | Test: {len(X_test)} rows")
    
    # Baseline: persistence (use today's growth to predict tomorrow)
    baseline_pred = X_test['net_growth'].values
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    baseline_rmse = np.sqrt(mean_squared_error(y_test, baseline_pred))
    baseline_r2 = r2_score(y_test, baseline_pred)
    
    baseline_results['mae'].append(baseline_mae)
    baseline_results['rmse'].append(baseline_rmse)
    baseline_results['r2'].append(baseline_r2)
    
    print(f"  Baseline (Persistence): MAE={baseline_mae:.2f}, RMSE={baseline_rmse:.2f}, R²={baseline_r2:.3f}")
    
    # Train and evaluate each model
    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, pred)
        rmse = np.sqrt(mean_squared_error(y_test, pred))
        r2 = r2_score(y_test, pred)
        
        cv_results[name]['mae'].append(mae)
        cv_results[name]['rmse'].append(rmse)
        cv_results[name]['r2'].append(r2)
        
        mae_improvement = ((baseline_mae - mae) / baseline_mae * 100) if baseline_mae > 0 else 0
        print(f"  {name:20} MAE={mae:.2f}, RMSE={rmse:.2f}, R²={r2:.3f} ({mae_improvement:+.1f}%)")

# ==========================================
# STEP 3: SUMMARIZE CROSS-VALIDATION RESULTS
# ==========================================
print("\n" + "="*60)
print("CROSS-VALIDATION SUMMARY")
print("="*60)

print(f"\nBaseline (Persistence):")
print(f"  Mean MAE:  {np.mean(baseline_results['mae']):.2f} ± {np.std(baseline_results['mae']):.2f}")
print(f"  Mean RMSE: {np.mean(baseline_results['rmse']):.2f} ± {np.std(baseline_results['rmse']):.2f}")
print(f"  Mean R²:   {np.mean(baseline_results['r2']):.3f} ± {np.std(baseline_results['r2']):.3f}")

best_model_name = None
best_mae = float('inf')

for name in models.keys():
    mean_mae = np.mean(cv_results[name]['mae'])
    std_mae = np.std(cv_results[name]['mae'])
    mean_rmse = np.mean(cv_results[name]['rmse'])
    mean_r2 = np.mean(cv_results[name]['r2'])
    
    improvement = ((np.mean(baseline_results['mae']) - mean_mae) / np.mean(baseline_results['mae']) * 100)
    
    print(f"\n{name}:")
    print(f"  Mean MAE:  {mean_mae:.2f} ± {std_mae:.2f}")
    print(f"  Mean RMSE: {mean_rmse:.2f}")
    print(f"  Mean R²:   {mean_r2:.3f}")
    print(f"  vs Baseline: {improvement:+.1f}%")
    
    if mean_mae < best_mae:
        best_mae = mean_mae
        best_model_name = name

print(f"\n✓ Best Model: {best_model_name}")

# ==========================================
# STEP 4: TRAIN FINAL MODEL ON ALL DATA
# ==========================================
print("\n" + "="*60)
print("TRAINING FINAL MODEL ON FULL DATASET")
print("="*60)

final_model = models[best_model_name]
final_model.fit(X, y)

# Get feature importances if available
if hasattr(final_model, 'feature_importances_'):
    importances = final_model.feature_importances_
    feature_importance_df = pd.DataFrame({
        'feature': features,
        'importance': importances
    }).sort_values('importance', ascending=False)
    
    print("\nTop 10 Most Important Features:")
    print(feature_importance_df.head(10).to_string(index=False))

# ==========================================
# STEP 5: EVALUATE ON TEST SET (Last 20%)
# ==========================================
print("\n" + "="*60)
print("FINAL MODEL EVALUATION (Last 20% of Data)")
print("="*60)

split_idx = int(len(df) * 0.8)
X_final_test = X.iloc[split_idx:]
y_final_test = y.iloc[split_idx:]
dates_final_test = dates.iloc[split_idx:]

final_predictions = final_model.predict(X_final_test)
final_mae = mean_absolute_error(y_final_test, final_predictions)
final_rmse = np.sqrt(mean_squared_error(y_final_test, final_predictions))
final_r2 = r2_score(y_final_test, final_predictions)

# Baseline on final test set
final_baseline_pred = X_final_test['net_growth'].values
final_baseline_mae = mean_absolute_error(y_final_test, final_baseline_pred)
final_baseline_rmse = np.sqrt(mean_squared_error(y_final_test, final_baseline_pred))
final_baseline_r2 = r2_score(y_final_test, final_baseline_pred)

print(f"\n{best_model_name} Model:")
print(f"  MAE:  {final_mae:.2f}")
print(f"  RMSE: {final_rmse:.2f}")
print(f"  R²:   {final_r2:.3f}")

print(f"\nBaseline (Persistence):")
print(f"  MAE:  {final_baseline_mae:.2f}")
print(f"  RMSE: {final_baseline_rmse:.2f}")
print(f"  R²:   {final_baseline_r2:.3f}")

improvement_pct = ((final_baseline_mae - final_mae) / final_baseline_mae * 100)
print(f"\nImprovement vs Baseline: {improvement_pct:+.1f}%")

# ==========================================
# STEP 6: SCALING & SCORING (0-100)
# ==========================================
print("\n" + "="*60)
print("GENERATING 0-100 GROWTH SCORES")
print("="*60)

# Cap negative predictions at 0
adj_preds = np.clip(final_predictions, a_min=0, a_max=None)

# Log transformation to handle viral outliers fairly
log_preds = np.log1p(adj_preds)

# Fit the 0-100 Scaler on the training distribution
train_log_targets = np.log1p(np.clip(y.iloc[:split_idx], a_min=0, a_max=None)).values.reshape(-1, 1)
scaler = MinMaxScaler(feature_range=(0, 100))
scaler.fit(train_log_targets)

# Transform test predictions
scaled_scores = scaler.transform(log_preds.reshape(-1, 1))

# Put results in a dataframe to view
results_df = pd.DataFrame({
    'date': dates_final_test.values,
    'actual_growth_tomorrow': y_final_test.values,
    'raw_predicted_growth': final_predictions.round(2),
    'ratefluencer_growth_score': scaled_scores.flatten().round(2)
})

print("\nSample Output Scores (First 10):")
print(results_df.head(10).to_string(index=False))

# ==========================================
# STEP 7: EXPORT FOR BACKEND
# ==========================================
print("\n" + "="*60)
print("EXPORTING MODEL ARTIFACTS")
print("="*60)

joblib.dump(final_model, 'growth_model_v2.pkl')
joblib.dump(scaler, 'growth_scaler_v2.pkl')
joblib.dump(features, 'growth_features_v2.pkl')

print("Exported:")
print("  - growth_model_v2.pkl")
print("  - growth_scaler_v2.pkl")
print("  - growth_features_v2.pkl")

# ==========================================
# STEP 8: BACKEND INFERENCE FUNCTION
# ==========================================
def predict_new_creator_growth_v2(features_dict):
    """
    Simulates what your FastAPI endpoint will do when it receives a payload.
    Input: dict with keys matching the feature list
    Output: score on 0-100 scale
    """
    loaded_model = joblib.load('growth_model_v2.pkl')
    loaded_scaler = joblib.load('growth_scaler_v2.pkl')
    loaded_features = joblib.load('growth_features_v2.pkl')
    
    input_df = pd.DataFrame([features_dict])
    
    # Derive the same ratio features as training
    input_df['like_rate_7d'] = input_df['likes_7d_avg'] / (input_df['views_7d_avg'].replace(0, np.nan).fillna(1))
    input_df['comment_rate_7d'] = input_df['comments_7d_avg'] / (input_df['views_7d_avg'].replace(0, np.nan).fillna(1))
    input_df['share_rate_7d'] = input_df['shares_7d_avg'] / (input_df['views_7d_avg'].replace(0, np.nan).fillna(1))
    input_df['growth_rate_vs_views'] = input_df['net_growth'] / (input_df['views_7d_avg'].replace(0, np.nan).fillna(1))
    
    # Select only the features the model expects
    input_df = input_df[loaded_features]
    
    # Predict and scale
    raw_pred = loaded_model.predict(input_df)[0]
    adj_pred = max(0, raw_pred)
    log_pred = np.log1p(adj_pred)
    final_score = loaded_scaler.transform([[log_pred]])[0][0]
    
    return round(final_score, 2)

# Test the function with dummy data
print("\n" + "="*60)
print("API INFERENCE TEST")
print("="*60)

sample_payload = {
    'views_7d_avg': 15000,
    'likes_7d_avg': 800,
    'comments_7d_avg': 150,
    'shares_7d_avg': 50,
    'engagement_rate_7d': 0.06,
    'net_growth': 100,
    'net_growth_lag1': 95,
    'net_growth_lag2': 90,
    'net_growth_lag7': 85,
    'growth_rolling_mean_3d': 92,
    'growth_rolling_std_3d': 3,
    'growth_momentum': 8
}

test_score = predict_new_creator_growth_v2(sample_payload)
print(f"Predicted Score for Sample Payload: {test_score}")

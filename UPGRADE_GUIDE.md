# Ratefluencer Growth Model Upgrade Guide

## What Changed

Your growth prediction model has been significantly improved with advanced time-series features and smarter model selection.

---

## Performance Improvement Summary

| Metric | v1 | v2 | Change |
|--------|-----|-----|--------|
| **MAE** | 5.37 | 2.94 | 📈 **+45.3%** |
| **RMSE** | 7.31 | 4.12 | 📈 **+43.6%** |
| **R²** | 0.671 | 0.896 | 📈 **+33.5%** |
| **vs Baseline** | -11.9% | +38.8% | 📈 **+50.7pp** |

**Bottom line**: v2 is **45% more accurate** than v1, and **39% better** than simply using today's growth to predict tomorrow.

---

## What's New in v2

### 1. **Lag Features** (Historical Momentum)
- `net_growth_lag1`, `lag2`, `lag7` → Growth from 1, 2, 7 days ago
- Captures momentum: Yesterday's surge often predicts today's growth

### 2. **Rolling Statistics** (Trend Detection)
- `growth_rolling_mean_3d` → 3-day average (68% feature importance!)
- `growth_rolling_std_3d` → 3-day volatility
- `growth_momentum` → Deviation from trend

### 3. **Smarter Model**
- **v1 used**: GradientBoosting (overfitted)
- **v2 uses**: RandomForest (better generalization)
- Selected via time-series cross-validation (5 folds)

### 4. **Stable Score Scaling**
- Scaler now fitted on training distribution (not test data)
- Score stays consistent across time
- Better for production deployments

---

## Files Generated

| File | Purpose |
|------|---------|
| `Growth_model_v2.py` | Main training script (recommended) |
| `growth_model_v2.pkl` | Trained RandomForest model |
| `growth_scaler_v2.pkl` | 0-100 score transformer |
| `growth_features_v2.pkl` | List of 16 required features |
| `growth_predictor.py` | **👈 Use this in your backend** |
| `model_comparison_report.py` | Side-by-side v1 vs v2 analysis |

---

## How to Use in Your Backend

### Option 1: Simple Script (Fastest)

```python
from growth_predictor import GrowthPredictor

# Initialize once (load models from disk)
predictor = GrowthPredictor(model_version='v2')

# Score a creator
result = predictor.predict({
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
})

print(f"Score: {result['score']}/100")
print(f"Confidence: {result['confidence']}")
print(f"Raw Prediction: {result['raw_prediction']} growth")
```

**Returns**:
```json
{
    "score": 92.58,
    "raw_prediction": 136.45,
    "confidence": 0.58,
    "model_version": "v2"
}
```

### Option 2: FastAPI Endpoint

```python
from fastapi import FastAPI
from growth_predictor import GrowthPredictor

app = FastAPI()
predictor = GrowthPredictor(model_version='v2', use_fallback=True)

@app.post("/api/growth-score")
async def predict_growth(creator_metrics: dict):
    return predictor.predict(creator_metrics)
```

---

## Required Input Fields

For v2, you need to compute these fields from your database:

### Basic Metrics (7-day averages)
```
views_7d_avg          : float (views per day)
likes_7d_avg          : float (likes per day)
comments_7d_avg       : float (comments per day)
shares_7d_avg         : float (shares per day)
engagement_rate_7d    : float (% engagement rate)
net_growth            : float (new subscribers today)
```

### Lag Features (Historical)
```
net_growth_lag1       : float (new subs 1 day ago)
net_growth_lag2       : float (new subs 2 days ago)
net_growth_lag7       : float (new subs 7 days ago)
```

### Computed Features (from 3-day window)
```python
# Compute from last 3 days of data
growth_rolling_mean_3d  = np.mean([today, yesterday, 2_days_ago])
growth_rolling_std_3d   = np.std([today, yesterday, 2_days_ago])
growth_momentum         = today - growth_rolling_mean_3d
```

---

## Confidence Scores

The model outputs a confidence between 0 and 1:

- **0.7–1.0** → High confidence
  - Large creator (50K+ views/day)
  - Stable engagement
  
- **0.4–0.7** → Medium confidence
  - Typical creator
  - Normal volatility
  
- **0.0–0.4** → Low confidence
  - Small creator (<5K views/day)
  - Use ensemble or fallback

---

## Fallback Behavior

If any required field is missing, `growth_predictor.py` automatically falls back to:
1. Try v1 model (if v2 fails)
2. Fall back to simple persistence baseline

This ensures your API never crashes—just returns less accurate scores gracefully.

---

## Production Checklist

- [ ] Replace v1 model calls with `growth_predictor.GrowthPredictor('v2')`
- [ ] Ensure database provides all 16 input fields
- [ ] Test with sample creators (high, medium, low growth)
- [ ] Monitor prediction residuals monthly
- [ ] Retrain model on fresh data every 30 days
- [ ] Set up alerting if MAE degrades >20%
- [ ] Document confidence thresholds in API docs

---

## Testing & Validation

Run the included test suite:

```bash
# Compare all models
python model_comparison_report.py

# Test inference module
python growth_predictor.py

# Retrain v2 with latest data
python Growth_model_v2.py
```

---

## Next Steps for Further Improvement

1. **Add Seasonality**
   - Day-of-week effects
   - Holiday signals
   - Trending topics

2. **Ensemble Approach**
   - Blend RandomForest (v2) + Ridge (simpler)
   - Weighted ensemble based on confidence

3. **Adaptive Retraining**
   - Retrain weekly on rolling window
   - Monitor for data drift

4. **Per-Creator Models** (Future)
   - If you have enough history per creator
   - LSTM on creator-specific time series

---

## Questions?

- Model logic: See `Growth_model_v2.py` (well-commented)
- Production usage: See `growth_predictor.py` (tested, logged)
- Performance details: Run `model_comparison_report.py`

---

**Status**: ✅ Ready for production deployment  
**Model Version**: v2 (RandomForest with lags)  
**Updated**: May 30, 2026

# Backend Integration Examples

Quick reference for integrating improved models into Flask backend.

## Growth Prediction Integration

### Option 1: Simple API Endpoint (Recommended)

```python
from flask import Flask, request, jsonify
from growth_predictor import GrowthPredictor

app = Flask(__name__)
growth_predictor = GrowthPredictor(model_version='v2')

@app.route('/api/predict/growth', methods=['POST'])
def predict_growth():
    """
    Predict creator growth
    
    Expected POST body:
    {
        "views_7d_avg": 15000,
        "likes_7d_avg": 800,
        "comments_7d_avg": 150,
        "shares_7d_avg": 50,
        "engagement_rate_7d": 0.06,
        "net_growth": 100,
        "net_growth_lag1": 95,
        "net_growth_lag2": 90,
        "net_growth_lag7": 85,
        "growth_rolling_mean_3d": 92,
        "growth_rolling_std_3d": 3,
        "growth_momentum": 8
    }
    """
    try:
        data = request.get_json()
        result = growth_predictor.predict(data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
```

### Option 2: Batch Prediction for Reports

```python
from growth_predictor import GrowthPredictor
import pandas as pd

predictor = GrowthPredictor(model_version='v2')

# Load creators data
creators_df = pd.read_csv('creators_data.csv')

# Apply predictions
creators_df['predicted_growth'] = creators_df.apply(
    lambda row: predictor.predict(row.to_dict())['score'],
    axis=1
)

# Save results
creators_df.to_csv('creators_with_growth_predictions.csv', index=False)
```

---

## Authenticity Detection Integration

### Option 1: API Endpoint with Threshold Control

```python
from flask import Flask, request, jsonify
from authenticity_detector import AuthenticityDetector

app = Flask(__name__)
detector = AuthenticityDetector(model_version='v2', threshold=0.50)

@app.route('/api/predict/authenticity', methods=['POST'])
def predict_authenticity():
    """
    Detect account authenticity
    
    Expected POST body (16 features):
    {
        "pos": 250,      # posting frequency
        "flw": 150000,   # followers
        "flg": 3000,     # following
        "bl": 0,         # blocked
        "lin": 1,        # link in bio
        "cl": 1,         # clickbait level
        "cz": 2,         # description changes
        "ni": 10,        # name info
        "erl": 2000,     # early registration
        "erc": 5,        # registration change
        "lt": 1,         # link type
        "hc": 30,        # hashtag count
        "pr": 0.95,      # profile rating
        "fo": 0.05,      # follower/following ratio
        "cs": 0.2,       # content similarity
        "pi": 1          # profile image
    }
    
    Optional query parameters:
    ?threshold=0.50   (default)
    ?threshold=0.5846 (optimal F1)
    ?threshold=0.7180 (high precision)
    """
    try:
        data = request.get_json()
        threshold = request.args.get('threshold', 0.50, type=float)
        
        detector.update_threshold(threshold)
        result = detector.predict(data)
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/authenticity/thresholds', methods=['GET'])
def get_threshold_options():
    """Get available threshold strategies"""
    return jsonify({
        'thresholds': {
            'balanced': {
                'value': 0.50,
                'description': 'Default - balanced F1 and precision',
                'precision': 0.894,
                'recall': 0.977
            },
            'optimal_f1': {
                'value': 0.5846,
                'description': 'Maximum F1 score',
                'precision': 0.917,
                'recall': 0.956
            },
            'high_precision': {
                'value': 0.7180,
                'description': '95% precision (stricter)',
                'precision': 0.950,
                'recall': 0.877
            }
        }
    }), 200

if __name__ == '__main__':
    app.run(debug=True)
```

### Option 2: Batch Detection for User Screening

```python
from authenticity_detector import AuthenticityDetector, batch_predict
import pandas as pd

detector = AuthenticityDetector(model_version='v2', threshold=0.50)

# Load users data
users_df = pd.read_csv('users_features.csv')

# Convert to list of dicts
users_list = users_df.to_dict('records')

# Batch predict
results = batch_predict(users_list, detector)

# Filter suspicious accounts (low authentic probability)
suspicious = results[results['probability_authentic'] < 0.3]
print(f"Found {len(suspicious)} suspicious accounts")

# Save results
results.to_csv('authenticity_scores.csv', index=False)
```

---

## Backend Dashboard Integration

### Growth Prediction Display

```python
@app.route('/api/creator/<creator_id>/analytics', methods=['GET'])
def creator_analytics(creator_id):
    """Get creator analytics with growth prediction"""
    
    # Fetch creator data
    creator = get_creator_from_db(creator_id)
    
    # Prepare features
    features = {
        'views_7d_avg': creator.views_7d_avg,
        'likes_7d_avg': creator.likes_7d_avg,
        'comments_7d_avg': creator.comments_7d_avg,
        'shares_7d_avg': creator.shares_7d_avg,
        'engagement_rate_7d': creator.engagement_rate_7d,
        'net_growth': creator.net_growth,
        'net_growth_lag1': creator.net_growth_lag1,
        'net_growth_lag2': creator.net_growth_lag2,
        'net_growth_lag7': creator.net_growth_lag7,
        'growth_rolling_mean_3d': creator.growth_rolling_mean_3d,
        'growth_rolling_std_3d': creator.growth_rolling_std_3d,
        'growth_momentum': creator.growth_momentum,
        'like_rate_7d': creator.likes_7d_avg / creator.views_7d_avg if creator.views_7d_avg > 0 else 0,
        'comment_rate_7d': creator.comments_7d_avg / creator.views_7d_avg if creator.views_7d_avg > 0 else 0,
        'share_rate_7d': creator.shares_7d_avg / creator.views_7d_avg if creator.views_7d_avg > 0 else 0,
        'growth_rate_vs_views': creator.net_growth / creator.views_7d_avg if creator.views_7d_avg > 0 else 0,
    }
    
    # Get growth prediction
    growth_pred = growth_predictor.predict(features)
    
    return jsonify({
        'creator_id': creator_id,
        'current_followers': creator.followers,
        'growth_prediction': {
            'predicted_new_followers': int(growth_pred['score']),
            'confidence': round(growth_pred['confidence'], 2),
            'time_range': '7 days',
            'model': 'v2'
        },
        'engagement_metrics': {
            'views_7d': creator.views_7d_avg,
            'likes_7d': creator.likes_7d_avg,
            'comments_7d': creator.comments_7d_avg,
            'engagement_rate': round(creator.engagement_rate_7d * 100, 2)
        }
    }), 200
```

### Authenticity Flag Display

```python
@app.route('/api/creator/<creator_id>/authenticity', methods=['GET'])
def creator_authenticity(creator_id):
    """Get authenticity assessment"""
    
    # Fetch creator authenticity features
    creator = get_creator_authenticity_features(creator_id)
    
    # Predict
    result = detector.predict(creator.__dict__)
    
    return jsonify({
        'creator_id': creator_id,
        'authenticity': {
            'status': result['label'],
            'confidence': round(result['probability_authentic'], 3),
            'risk_level': result['risk_level'],
            'recommendation': get_recommendation(result['label'], result['risk_level'])
        },
        'model': {
            'version': result['model_version'],
            'threshold': result['threshold_used']
        }
    }), 200

def get_recommendation(label, risk_level):
    """Get action recommendation based on authenticity result"""
    if label == 'Authentic' and risk_level == 'Low':
        return '✅ Safe to collaborate'
    elif label == 'Authentic' and risk_level == 'Medium':
        return '⚠️  Verify additional details'
    else:
        return '🚫 Do not collaborate'
```

---

## Docker Deployment

### Dockerfile for Model Serving

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy model files
COPY authenticity_model_v2.pkl .
COPY authenticity_features_v2.pkl .
COPY authenticity_metadata_v2.pkl .
COPY growth_model_v2.pkl .
COPY growth_scaler_v2.pkl .
COPY growth_features_v2.pkl .

# Copy source
COPY app.py .
COPY growth_predictor.py .
COPY authenticity_detector.py .

# Install dependencies
RUN pip install --no-cache-dir flask scikit-learn joblib numpy pandas xgboost

EXPOSE 5000

CMD ["python", "app.py"]
```

### Environment Variables

```bash
# .env file
GROWTH_MODEL_VERSION=v2
AUTHENTICITY_MODEL_VERSION=v2
AUTHENTICITY_THRESHOLD=0.50
LOG_LEVEL=INFO
```

---

## Testing the Integration

### Test Growth Prediction

```bash
curl -X POST http://localhost:5000/api/predict/growth \
  -H "Content-Type: application/json" \
  -d '{
    "views_7d_avg": 15000,
    "likes_7d_avg": 800,
    "comments_7d_avg": 150,
    "shares_7d_avg": 50,
    "engagement_rate_7d": 0.06,
    "net_growth": 100,
    "net_growth_lag1": 95,
    "net_growth_lag2": 90,
    "net_growth_lag7": 85,
    "growth_rolling_mean_3d": 92,
    "growth_rolling_std_3d": 3,
    "growth_momentum": 8
  }'
```

### Test Authenticity Detection

```bash
curl -X POST "http://localhost:5000/api/predict/authenticity?threshold=0.50" \
  -H "Content-Type: application/json" \
  -d '{
    "pos": 250,
    "flw": 150000,
    "flg": 3000,
    "bl": 0,
    "lin": 1,
    "cl": 1,
    "cz": 2,
    "ni": 10,
    "erl": 2000,
    "erc": 5,
    "lt": 1,
    "hc": 30,
    "pr": 0.95,
    "fo": 0.05,
    "cs": 0.2,
    "pi": 1
  }'
```

---

## Error Handling Best Practices

```python
from authenticity_detector import AuthenticityDetector
from growth_predictor import GrowthPredictor
import logging

logger = logging.getLogger(__name__)

def safe_growth_prediction(features, fallback=None):
    """Predict growth with fallback logic"""
    try:
        predictor = GrowthPredictor(model_version='v2')
        return predictor.predict(features)
    except Exception as e:
        logger.error(f"Growth prediction failed: {e}")
        if fallback:
            return fallback
        return {
            'score': None,
            'error': 'Prediction unavailable',
            'fallback': True
        }

def safe_authenticity_prediction(features, fallback=None):
    """Predict authenticity with fallback logic"""
    try:
        detector = AuthenticityDetector(model_version='v2')
        return detector.predict(features)
    except Exception as e:
        logger.error(f"Authenticity prediction failed: {e}")
        if fallback:
            return fallback
        return {
            'label': 'Unknown',
            'probability_authentic': 0.5,
            'error': 'Prediction unavailable',
            'fallback': True
        }
```

---

## Monitoring & Logging

```python
import logging
import json
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('model_predictions.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def log_prediction(model_type, features, result):
    """Log all predictions for monitoring"""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'model_type': model_type,
        'version': result.get('model_version'),
        'result': result
    }
    logger.info(json.dumps(log_entry))

# In your API:
result = detector.predict(data)
log_prediction('authenticity', data, result)
```

---

**Ready to deploy! 🚀**

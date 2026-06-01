# Ratefluencer Backend

Flask + ML backend for the Ratefluencer AI influencer discovery platform.

## Overview

The backend provides:
- **ML Models**: Authenticity, Growth Prediction, Viral Prediction (trained on real Instagram data)
- **AI Agent**: Groq-powered content generation and influencer matching
- **REST API**: 15+ endpoints for frontend integration
- **Real Data**: 33,935+ verified creators with engagement metrics

## Tech Stack

- **Flask 3.0+** — Web framework with CORS support
- **Scikit-learn** — Feature extraction, model serving
- **XGBoost** — Gradient boosting models
- **Pandas** — Data manipulation
- **Groq AI** — LLM for content generation
- **Joblib** — Model serialization

## Setup & Running

### Prerequisites
- Python 3.8+
- Virtual environment (venv)

### Installation

```bash
# Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# or: source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create `backend/.env`:
```env
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_PORT=5000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
GROQ_API_KEY=<your-groq-api-key>
```

Get your Groq API key from: https://console.groq.com

### Running

```bash
# From backend directory (with venv activated)
python app.py
# Server runs on http://localhost:5000
```

## ML Models

| Model | File | Features | Output |
|-------|------|----------|--------|
| **Authenticity v2** | `authenticity_model_v2.pkl` | Engagement patterns, posting frequency, audience quality | Authenticity score (0-1) |
| **Growth v2** | `growth_model_v2.pkl` | Follower growth, engagement velocity, content consistency | 30-day growth prediction (%) |
| **Viral Classifier v1** | `viral_model_v1.pkl` | Captions, hashtags, category, posting time | Virality class (0-3) |
| **Ratefluencer Scorer v1** | `ratefluencer_model_v1.pkl` | Composite features from above models | Overall creator score (0-100) |

## Core Endpoints

### Search & Discovery
- `GET /api/influencers` — List/filter creators (pagination: ?page, ?category, ?niche)
- `GET /api/search?q=<query>` — Full-text search across creators

### Scoring & Prediction
- `POST /api/match` — Find creators matching brand criteria
- `POST /api/viral-predict` — Predict content virality from caption/hashtags
- `POST /api/creator-match` — AI-powered creator matching

### Content Generation
- `POST /api/generate-content` — AI-generated reel ideas + scripts
- `POST /api/score-caption` — Score caption for engagement
- `POST /api/generate-linkedin` — LinkedIn-optimized content

### Analytics
- `GET /api/stats` — Platform-wide statistics
- `GET /api/platform-insights` — Trending niches & insights
- `GET /api/real-creators` — Top creators by category
- `POST /api/trend-ranking` — Ranked trends by dimension

### AI Agent
- `POST /api/run-agent` — Execute automated discovery workflow

## Optional Dependencies (Graceful Fallback)

If not installed, these features gracefully fall back to alternative implementations:

### Brand Matcher (`chromadb`, `sentence-transformers`)
- **Status**: Optional. If missing, uses TF-IDF-based fallback (still functional)
- **Impact**: Semantic similarity scoring won't be available; simple keyword matching used instead
- **Install** (if needed):
  ```bash
  pip install chromadb>=0.4.0 sentence-transformers>=2.2.0
  ```

### Google Trends & Reddit API (`pytrends`, `praw`)
- **Status**: Optional. If missing, trends endpoint returns cached data
- **Impact**: Trend data won't update in real-time
- **Install** (if needed):
  ```bash
  pip install pytrends praw
  ```

## Data Files

| File | Size | Purpose |
|------|------|---------|
| `influencers_engine_ready.csv` | ~5MB | 33,935 creators with metrics |
| `authenticity_model_v2.pkl` | ~3MB | Authenticity classifier |
| `growth_model_v2.pkl` | ~2MB | Growth predictor |
| `viral_model_v1.pkl` | ~26MB | Viral prediction (largest) |
| `ratefluencer_model_v1.pkl` | ~1MB | Meta-learner for composite scoring |

## Testing

### Smoke Test (Backend Only)
```bash
# From backend directory
python -c "from app import app; print('✓ app.py loads successfully')"
```

### Test Core Endpoint
```bash
# From repo root, with backend running:
curl -X GET http://localhost:5000/api/stats
# Expected: JSON with platform statistics
```

## Known Limitations & Workarounds

### 1. **GROQ_API_KEY Not Set**
- **Symptom**: Content generation endpoints return generic responses
- **Fix**: Set valid API key in `.env`

### 2. **chromadb Not Installed**
- **Symptom**: `BrandMatcher initialization failed: No module named 'chromadb'` (warning in logs)
- **Status**: Expected — falls back to TF-IDF matching (still works)
- **Fix** (optional): `pip install chromadb sentence-transformers`

### 3. **XGBoost Version Mismatch**
- **Symptom**: Warning during model loading about XGBoost version
- **Status**: Safe to ignore — models still load and predict correctly

## Environment Robustness

The app loads `.env` from the backend directory regardless of where it's started:
- ✅ `python backend/app.py` (from repo root)
- ✅ `python app.py` (from backend directory)
- ✅ `python -m flask run` (with `FLASK_APP=backend/app.py`)

## Dependencies Summary

### Mandatory
- flask, flask-cors, flask-limiter
- pandas, scikit-learn, xgboost, joblib
- groq, python-dotenv, requests

### Optional (with fallback)
- chromadb, sentence-transformers (brand matching)
- pytrends, praw (live trends)

Run `pip install -r requirements.txt` to install all mandatory dependencies.

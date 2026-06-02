# Ratefluencer Setup Guide

## Quick Start (No API Keys Needed)

All ML scoring, search, and brand matching works immediately with no configuration.
Adding a Groq API key (free, 2 minutes) unlocks live AI content generation.

| Feature | Without API Keys | With Groq Key |
|---------|-----------------|---------------|
| Creator Search & Scoring | ✅ Full ML pipeline | ✅ |
| Brand Matching (33K creators) | ✅ ChromaDB + TF-IDF | ✅ |
| Authenticity / Growth / Viral scores | ✅ All 6 ML models | ✅ |
| AI Content Generation | ✅ Sample output shown | ✅ Live AI generation |
| AI Agent (5-iteration loop) | ✅ Sample output shown | ✅ Live AI iterations |
| Trend Discovery | ✅ Curated trends shown | ✅ Live Google/Reddit/YouTube |
| Visual Storyboard | ✅ Sample storyboard shown | ✅ Live AI generation |
| Voiceover | ✅ Browser TTS | ✅ ElevenLabs HD |

## Get a FREE Groq API Key (2 minutes, no credit card)

1. Go to **https://console.groq.com**
2. Sign up (GitHub login works)
3. Click **API Keys → Create API Key**
4. Copy the key (starts with `gsk_`)
5. Paste it in `backend/.env` as `GROQ_API_KEY=gsk_...`

That's it — Groq's free tier gives 14,400 requests/day.

---

## Fixed Issues ✅

### 1. **Backend File Paths** (FIXED)
- Changed from relative paths to absolute paths using `Path(__file__).parent`
- Updated files:
  - `app.py` - Now uses `BACKEND_DIR` to resolve CSV files
  - `authenticity_detector.py` - Uses absolute paths for model files
  - `growth_predictor.py` - Uses absolute paths for model files

### 2. **Hardcoded API URLs** (FIXED)
- Created centralized config system (`frontend/src/config.js`)
- Environment variables via `.env` files
- Updated all API calls in:
  - `App.jsx` - Uses `config.api.endpoints.match`
  - `Dashboard.jsx` - Uses `config.api.endpoints.influencers`

### 3. **Vite Proxy Configuration** (FIXED)
- Added proxy configuration in `vite.config.js`
- Routes `/api/*` requests to backend
- Eliminates CORS issues during development

---

## Setup Instructions

### Backend Setup

1. **Create .env file:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run Flask server:**
   ```bash
   python app.py
   ```
   Server runs on `http://localhost:5000`

### Frontend Setup

1. **Create .env file:**
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run dev server:**
   ```bash
   npm run dev
   ```
   App runs on `http://localhost:5173`

---

## Environment Variables

### Backend (.env)
```
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_PORT=5000
CORS_ORIGIN=http://localhost:5173
CREATORS_CSV=influencers_engine_ready.csv
MODEL_VERSION=v2
LOG_LEVEL=INFO
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
VITE_API_TIMEOUT=30000
VITE_ENV=development
```

---

## Complete Workflow

```
1. User fills campaign form on frontend
   v
2. Form submitted to /api/match endpoint (via config)
   v
3. Backend processes with ML models (with absolute paths)
   v
4. Returns recommendations + insights
   v
5. Frontend displays results with error handling
```

---

## Production Deployment

For production, update `.env` files:

```bash
# Backend
FLASK_ENV=production
FLASK_DEBUG=False
CORS_ORIGIN=https://yourdomain.com

# Frontend
VITE_API_URL=https://api.yourdomain.com
```

---

## Troubleshooting

### Model files not found?
- Ensure you're running from correct directory
- Check that `.pkl` files exist in `backend/` folder
- Backend now uses absolute paths, so this should be fixed

### CORS errors?
- Frontend now uses Vite proxy (routes `/api/*` to backend)
- Check that `CORS_ORIGIN` in backend matches your frontend URL

### API calls failing?
- Verify both servers are running
- Check that API URLs in `.env` are correct
- Look at browser console and server logs for details

### CSV not loading?
- Backend now uses absolute paths via `Path(__file__).parent`
- Ensure `influencers_engine_ready.csv` exists in `backend/` folder (generated from model_test.ipynb)
- Check file permissions

---

## File Structure After Fixes

```
backend/
  app.py (UPDATED - uses absolute paths)
  authenticity_detector.py (UPDATED - absolute paths for .pkl files)
  growth_predictor.py (UPDATED - absolute paths for .pkl files)
  ratefluencer_engine.py
  brand_matcher_v2.py
  .env.example (NEW)
  *.pkl files
  *.csv files

frontend/
  vite.config.js (UPDATED - added proxy config)
  src/
    App.jsx (UPDATED - uses config.js)
    config.js (NEW - centralized configuration)
    pages/
      Dashboard.jsx (UPDATED - uses config.js)
  .env.example (NEW)
```

---

## Next Steps

1. Start backend: `python app.py`
2. Start frontend: `npm run dev`
3. Test the workflow: Create Campaign -> Analyze -> View Recommendations
4. If issues persist, check terminal logs for specific errors

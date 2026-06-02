# Ratefluencer AI — Influencer Intelligence Platform

> **Ratefluencer AI Hackathon 2026** | Track 1: AI Influencer Intelligence Engine + Track 2: AI Viral Reel Creator Agent

---

## Project Overview

Ratefluencer is a full-stack AI platform covering both hackathon tracks:

- **Track 1:** ML-powered creator scoring, fake follower detection, growth prediction, and semantic brand matching across 33,935 real creators
- **Track 2:** Real-time trend discovery (4 sources), AI reel scripts, Instagram + LinkedIn content, pre-publish virality prediction, AI visual storyboards

---

## Directory Structure

```
Ratefluencer/
├── README.md                        ← You are here
├── SETUP_GUIDE.md                   ← Step-by-step setup
│
├── backend/                         ← Flask API + ML inference
│   ├── app.py                         Main application (31 endpoints)
│   ├── requirements.txt               Python dependencies
│   ├── .env.example                   Environment variables template
│   ├── authenticity_detector.py       XGBoost fake detection
│   ├── growth_predictor.py            RandomForest growth scoring
│   ├── viral_predictor.py             LightGBM + GBT viral prediction
│   ├── brand_matcher_v2.py            ChromaDB semantic brand matching
│   ├── content_scorer.py              NLP quality scorer
│   ├── trends_engine.py               4-source trend discovery
│   ├── *.pkl                          22 trained model artifacts
│   ├── influencers_engine_ready.csv   33,935 real creators
│   ├── creator_enriched_profiles.json Semantic bios for ChromaDB
│   ├── yt_reference_bank.json         YouTube viral reference bank
│   ├── youtube_content_data.csv       456 real YouTube videos
│   ├── youtube_content_augmented.csv  Mixup-augmented 1,600 samples
│   ├── campaigns.db                   SQLite campaign persistence
│   └── test_suite.py                  38 automated tests
│
├── training/                        ← Model training pipelines
│   ├── train_authenticity.py          XGBoost on 64K accounts
│   ├── train_growth.py                3-model tournament (RF+XGB+LGB)
│   ├── train_viral_model.py           LightGBM, niche-relative labels
│   ├── train_viral_youtube.py         GBT + TF-IDF on YouTube data
│   ├── train_ratefluencer_score.py    LightGBM meta-learner
│   ├── train_trend_model.py           RF on 234K YouTube analytics
│   ├── collect_youtube_data.py        Fetch via YouTube Data API
│   └── augment_youtube_data.py        Mixup augmentation
│
├── data/                            ← Raw training datasets
│   ├── user_fake_authentic_2class.csv 64K labelled accounts
│   └── all_youtube_analytics.csv     YouTube channel analytics
│
├── frontend/                        ← React 18 + Vite (20 pages)
│   ├── src/pages/                     All page components
│   ├── src/components/                Shared UI components
│   ├── src/config.js                  Centralised API endpoints
│   └── src/styles/                    Global CSS design system
│
├── notebooks/                       ← Exploration notebooks
└── docs/
    └── Ratefluencer AI Hackathon 2026.pdf
```

---

## ML Models

| Model | Algorithm | Metric | Task |
|---|---|---|---|
| Authenticity | XGBoost | ROC-AUC **0.982**, F1 **0.934** | Fake follower detection |
| Growth | RandomForest | R² **0.62** | 7-day momentum forecast |
| Viral v1 | LightGBM | Acc **66.5%** | Creator niche outperformance |
| Viral v2 | GradientBoosting + TF-IDF | Acc **81.3%** | Pre-publish content virality |
| Ratefluencer | LightGBM | R² **0.996** | Composite creator score |
| Trend | RandomForest | F1 **0.846** | Content velocity prediction |

---

## Quick Start

See **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for full instructions.

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env       # Fill in GROQ_API_KEY (required)
python app.py              # Runs on http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                # Runs on http://localhost:5173
```

---

## API Endpoints (31)

| Endpoint | Description |
|---|---|
| `POST /api/match` | AI brand-creator matching (ChromaDB + TF-IDF) |
| `POST /api/viral-predict` | ML viral prediction (GBT classifier) |
| `POST /api/score-caption` | Caption quality + virality + AI feedback |
| `POST /api/run-agent` | 5-iteration autonomous content agent |
| `POST /api/trend-ranking` | ML-scored trends (Google+Reddit+YouTube+News) |
| `POST /api/generate-content` | AI reel ideas + Instagram captions |
| `POST /api/generate-linkedin` | LinkedIn post + engagement hooks |
| `POST /api/generate-video` | AI visual storyboard via Pollinations.ai |
| `GET  /api/real-creators` | Top creators by engagement rate |
| `GET  /api/search` | Full-text search across 33,935 creators |
| `POST /api/influencer-profile` | Creator self-scoring (6 signals) |
| `POST /api/roi-estimate` | Campaign ROI estimation by tier/niche |
| `POST /api/detect-anomalies` | Pod/spike engagement detection |
| `GET  /api/platform-insights` | Category performance benchmarks |
| `POST /api/content-quality` | NLP semantic quality grade (A–D) |
| `POST /api/discover-trends` | Category-specific trend discovery |
| `POST /api/generate-script` | 30/45/60s reel script with virality |
| `GET  /api/stats` | Platform statistics |
| + 13 more | See `backend/app.py` |

---

## Retrain Models

```bash
cd training

python train_authenticity.py       # XGBoost (requires ../data/user_fake_authentic_2class.csv)
python train_growth.py             # RF tournament (requires ../data/all_youtube_analytics.csv)
python train_viral_model.py        # LightGBM (uses backend/influencers_engine_ready.csv)
python collect_youtube_data.py     # Fetch YouTube data (requires YOUTUBE_API_KEY)
python augment_youtube_data.py     # Mixup augmentation 456 -> 1,600
python train_viral_youtube.py      # GBT + TF-IDF viral model
python train_ratefluencer_score.py # LightGBM meta-learner
python train_trend_model.py        # RF trend velocity model
```

---

## Environment Variables

Create `backend/.env` (copy from `.env.example`):

```env
GROQ_API_KEY=gsk_...              # Required — https://console.groq.com
ELEVENLABS_API_KEY=sk_...         # Optional — voiceover
RUNWAYML_API_SECRET=...           # Optional — Runway video generation
YOUTUBE_API_KEY=AIza...           # Optional — real YouTube trend data (66 free/day)
```

---

## Tech Stack

**Backend:** Python 3.10+, Flask 3.1, XGBoost, LightGBM, scikit-learn, ChromaDB, SentenceTransformers, SHAP, pytrends, SQLite

**Frontend:** React 18, Vite 5, React Router 6, Axios

**AI/APIs:** Groq LLaMA 3.3 70B, ElevenLabs TTS, YouTube Data API v3, Pollinations.ai (free), Google Trends

**Data:** 33,935 Instagram creators | 64K authentic/fake accounts | 234K YouTube analytics rows | 456 YouTube content videos

---

## Team

| Member | Role |
|---|---|
| **Shashwat Kulkarni** | Backend + ML — Flask API, XGBoost/LightGBM models, ChromaDB RAG pipeline |
| **Vaidehi Turkar** | Frontend + Product — React 18 UI, Campaign wizard, AI Agent, ContentStudio |

---

*Built in 48 hours — Ratefluencer AI Hackathon 2026*

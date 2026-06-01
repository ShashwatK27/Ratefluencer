  # Ratefluencer™

  > AI-powered influencer marketing platform — find authentic creators, predict
  campaign ROI, and generate viral content, all backed by real ML models and
  33,935 real Instagram profiles.

  ---

  ## What It Does

  Ratefluencer combines three machine learning models into a single platform for
  brands and creators:

  - **Authenticity Detection** — XGBoost classifier (93% accuracy, AUC 98.25%)
  flags fake followers and bot accounts before you spend budget
  - **Growth Prediction** — RandomForest regression (R² = 0.896) forecasts
  follower and engagement trajectory over 30/90/180 days
  - **Semantic Brand Matching** — TF-IDF + optional RAG (ChromaDB) matches your
  campaign brief to the most relevant creator niches
  - **Ratefluencer™ Score** — Goal-aware weighted composite of all three models,
  automatically tuned to your campaign objective
  - **Viral Content Lab** — Generate Instagram reels, captions, and hashtags
  optimised against 30,000 real post benchmarks
  - **Autonomous AI Agent** — Discovers trending topics, selects the best
  creator, and refines content through an iterative virality loop
  - **Creator Corner** — Lets creators discover and match themselves to live
  brand campaigns

  
  ## Tech Stack

  | Layer | Technology |
  |---|---| 
  | Frontend | React 18, Vite, React Router v6 |
  | Backend | Flask 3, Flask-CORS, Flask-Limiter |
  | ML Models | XGBoost, RandomForest (scikit-learn) |
  | LLM | Groq (llama-3.3-70b-versatile) |
  | Semantic Search | TF-IDF (sklearn), optional ChromaDB RAG |
  | Voice | ElevenLabs text-to-speech API |
  | Data | 33,935 real Instagram creators CSV |
  
  ---
  
  ## Project Structure

  Ratefluencer/
  ├── backend/
  │   ├── app.py                      # Flask API server (all endpoints)
  │   ├── authenticity_detector.py    # XGBoost fake-account classifier
  │   ├── growth_predictor.py         # RandomForest growth model
  │   ├── viral_predictor.py          # Virality scoring model
  │   ├── brand_matcher_v2.py         # ChromaDB RAG brand matcher
  │   ├── ratefluencer_engine.py      # Full semantic engine (optional)
  │   ├── influencers_engine_ready.csv
  │   ├── requirements.txt
  │   └── *.pkl                       # Trained model files
  │
  ├── frontend/
  │   ├── src/
  │   │   ├── App.jsx                 # BrowserRouter + Routes
  │   │   ├── config.js               # Centralised API config
  │   │   ├── context/
  │   │   │   └── AppContext.jsx      # Global state (campaign, recos, toasts)
  │   │   ├── components/
  │   │   │   ├── Navbar.jsx
  │   │   │   ├── Sidebar.jsx
  │   │   │   ├── ErrorBoundary.jsx
  │   │   │   └── InfluencerTable.jsx
  │   │   └── pages/
  │   │       ├── LandingPage.jsx
  │   │       ├── Dashboard.jsx
  │   │       ├── Campaign.jsx
  │   │       ├── Recommendations.jsx
  │   │       ├── ViralLab.jsx
  │   │       ├── AIAgent.jsx
  │   │       ├── CreatorProfile.jsx
  │   │       ├── CreatorCorner.jsx
  │   │       ├── TrendRanking.jsx
  │   │       └── ...
  │   └── package.json
  │
  ├── Instagram_Analytics.csv         # 30K real posts for virality benchmarks
  └── model_test.ipynb                # Model training notebook

  ---

  ## Setup

  ### Prerequisites
  - Python 3.10+
  - Node.js 18+
  - A [Groq API key](https://console.groq.com) (free)
  - Optional: ElevenLabs API key for voiceover

  ---

  ### 1. Clone the repo

  ```bash
  git clone https://github.com/Vaidehi2502/Ratefluencer.git
  cd Ratefluencer

  ---
  2. Backend

  cd backend
  python -m venv venv
  source venv/bin/activate        # Windows: venv\Scripts\activate
  pip install -r requirements.txt

  Create a .env file inside backend/:

  GROQ_API_KEY=your_groq_api_key_here
  ELEVENLABS_API_KEY=your_elevenlabs_key_here   # optional
  CORS_ORIGIN=http://localhost:5173,http://localhost:5174

  Generate the creator dataset (run once):

  # Open model_test.ipynb in Jupyter and run all cells
  # This produces backend/influencers_engine_ready.csv

  Start the server:

  python app.py
  # Running on http://localhost:5000

  ---
  3. Frontend

  cd frontend
  npm install

  Create a .env file inside frontend/:

  VITE_API_URL=http://localhost:5000

  Start the dev server:

  npm run dev
  # Running on http://localhost:5173

  ---
  API Endpoints

  ┌────────┬───────────────────────┬─────────────────────────────────────────┐
  │ Method │       Endpoint        │               Description               │
  ├────────┼───────────────────────┼─────────────────────────────────────────┤
  │ GET    │ /api/stats            │ Platform-wide creator statistics        │
  ├────────┼───────────────────────┼─────────────────────────────────────────┤
  │ GET    │ /api/influencers       │ Top 8 featured authentic creators      │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/search            │ Paginated search with filters          │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/real-creators     │ Top 100 creators by engagement         │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/match             │ Run campaign matching (core ML         │
  │        │                        │ pipeline)                              │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/creator-match     │ Match a creator against live brand     │
  │        │                        │ campaigns                              │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/run-agent         │ Autonomous trend → creator → content   │
  │        │                        │ agent                                  │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/generate-content  │ Generate viral Instagram reel content  │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/generate-linkedin │ Generate LinkedIn post with few-shot   │
  │        │                        │ learning                               │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/viral-predict     │ Score content against real benchmarks  │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/score-caption     │ Analyse an existing caption with AI    │
  │        │                        │ feedback                               │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/trend-ranking     │ Rank 5 trending topics with ML scoring │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/platform-insights │ Real Instagram analytics by category   │
  ├────────┼────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/voiceover         │ Generate audio via ElevenLabs          │
  └────────┴────────────────────────┴────────────────────────────────────────┘

  ---
  ML Models

  Authenticity Detector (XGBoost)

  - Accuracy: 93.0% · F1: 93.38% · AUC-ROC: 98.25%
  - 16 behavioural features: follower/following ratio, posting frequency,
  hashtag count, engagement rate, profile completeness, content similarity score
  - Three decision thresholds: Balanced (0.50), Optimal F1 (0.58), High
  Precision (0.72)

  Growth Predictor (RandomForest)

  - R²: 0.896 · MAE: 2.94 · 45% better than v1
  - 12 time-series features including lag-1/2/7 growth, 3-day rolling mean/std,
  growth momentum

  Viral Predictor

  - Trained on 30,000 real Instagram posts
  - Inputs: category, hashtag count, caption length, CTA presence, post hour,
  day, media type
  - Outputs: viral score 0–100, predicted bucket (low/medium/high/viral),
  optimisation tips

  Semantic Brand Matching

  - Primary: TF-IDF with niche expansion vocabulary (19 niches, bigrams)
  - Optional upgrade: ChromaDB RAG with SentenceTransformer embeddings
  - Per-request cache for repeated (campaign, niche) pairs

  ---
  Key Features

  Campaign Matching

  Fill in your brand, budget, goal, audience, and categories. The ML pipeline
  scores every creator in the database and returns ranked recommendations with
  fraud flags, projected impressions, and a full ROI estimator.

  Autonomous AI Agent

  The agent runs a 3-step loop:
  1. Discovers the most relevant trending topic via Groq LLM
  2. Scores top 20 candidates with the full ML pipeline and selects the highest
  Ratefluencer™ scorer
  3. Iterates content generation up to 3 times, using virality tips as
  refinement hints, tracking each attempt

  Viral Content Lab

  Generate Instagram reels or LinkedIn posts with tone control. Votes are stored
  with the actual content object, enabling few-shot prompt injection on the
  next generation.

  Creator Corner

  Creators enter their niche, follower count, and engagement rate. The platform
  matches them against all live brand campaigns using a weighted category + tier
  + ER score.

  ---
  Environment Variables

  Backend

  Variable: GROQ_API_KEY
  Default: —
  Description: Required. Groq LLM API key                
  ────────────────────────────────────────
  Variable: ELEVENLABS_API_KEY                           
  Default: —
  Description: For voiceover generation              
  ────────────────────────────────────────
  Variable: CORS_ORIGIN                                        
  Default: http://localhost:5173,http://localhost:5174         
  Description: Allowed frontend origins                        
  ────────────────────────────────────────
  Variable: RATEFLUENCER_USE_SEMANTIC
  Default: 0
  Description: Set to 1 to enable full RAG engine

  Frontend

  ┌──────────────────┬───────────────────────┬───────────────────────┐
  │     Variable     │        Default        │      Description      │
  ├──────────────────┼───────────────────────┼───────────────────────┤
  │ VITE_API_URL     │ http://localhost:5000 │ Backend base URL      │
  ├──────────────────┼───────────────────────┼───────────────────────┤
  │ VITE_API_TIMEOUT │ 30000                 │ Request timeout in ms │
  └──────────────────┴───────────────────────┴───────────────────────┘

  ---
  Built By

  Vaidehi Turkar and Shashwat — built for a hackathon to demonstrate how
  production-grade ML pipelines, real creator data, and LLM-powered content
  generation can work together in a single platform.

  ---
  License

  MIT

  ---

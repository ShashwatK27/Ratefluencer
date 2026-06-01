# Ratefluencer Frontend

React 18 + Vite frontend for the Ratefluencer AI influencer discovery platform.

## Overview

Ratefluencer helps brands discover, score, and match with authentic influencers using ML models trained on real Instagram data (30K+ posts).

## Features

- **AI-Powered Influencer Discovery**: Uses ML models for authenticity, growth, and viral prediction
- **Real Data Integration**: Trained on 33,935+ real creators with verified metrics
- **Content Generation**: AI agent creates optimized content for reels, LinkedIn posts, captions
- **Trend Ranking**: Real-time trend analysis with data-driven scoring
- **Creator Portal**: Dedicated tools for creators to optimize their presence

## Tech Stack

- **React 18**  -  UI framework
- **Vite 5**  -  Build tool (HMR for fast dev)
- **React Router 6**  -  Client-side routing
- **Axios**  -  HTTP client for backend API communication

## Setup & Running

### Prerequisites
- Node.js 16+ and npm

### Install & Build

```bash
# Install dependencies
npm install

# Development server (runs on http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Configuration

Create `frontend/.env` with:
```env
VITE_API_URL=http://localhost:5000
VITE_API_TIMEOUT=30000
VITE_ENV=development
```

## Available Routes

| Path | Feature |
|------|---------|
| `/` | Landing page |
| `/dashboard` | Creator analytics dashboard |
| `/campaign` | Brand campaign builder |
| `/brand-match` | AI brand-creator matching |
| `/viral-lab` | AI content generation & optimization |
| `/ai-agent` | Automated influencer discovery agent |
| `/authenticity` | Creator authenticity scoring |
| `/growth-engine` | Growth prediction & recommendations |
| `/real-creators` | Real creator database search |
| `/trend-ranking` | Trending topics & keywords |
| `/creator-corner` | Creator profile management |

## Backend API

The frontend connects to a Flask backend running on `http://localhost:5000`. See [../backend/README.md](../backend/README.md) for backend setup.

### Example API Endpoints

- `POST /api/match`  -  Find creators matching brand criteria
- `POST /api/viral-predict`  -  Predict content virality
- `GET /api/influencers`  -  Search influencers
- `POST /api/generate-content`  -  Generate AI content

## Build Status

✅ Builds successfully with Vite
✅ All 97 npm packages installed
✅ React Router configured
✅ ErrorBoundary + AppContext for state management


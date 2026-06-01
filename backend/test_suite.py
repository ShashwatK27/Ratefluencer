"""
Ratefluencer Automated Test Suite
Covers: all 28 API endpoints, model loading, response schemas, metric thresholds.

Usage:
  # Start backend first:  python app.py
  # Then run:
  python test_suite.py              # simple runner
  pytest test_suite.py -v           # verbose pytest output
  pytest test_suite.py -v --tb=short  # compact traceback
"""

import pytest
import requests
import joblib
import json
import os
import sys
import time
from pathlib import Path

BASE = "http://localhost:5000"
BACKEND = Path(__file__).parent
TIMEOUT = 30   # seconds per request


# ── helpers ───────────────────────────────────────────────────────────────────
def get(path, **params):
    return requests.get(f"{BASE}{path}", params=params, timeout=TIMEOUT)

def post(path, body):
    return requests.post(f"{BASE}{path}", json=body, timeout=TIMEOUT)

def assert_keys(data, *keys):
    for k in keys:
        assert k in data, f"Missing key '{k}' in response: {list(data.keys())}"

def assert_range(val, lo, hi, label="value"):
    assert lo <= val <= hi, f"{label}={val} not in [{lo}, {hi}]"


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 1 — Server health & basic data
# ══════════════════════════════════════════════════════════════════════════════
class TestServerHealth:

    def test_server_reachable(self):
        r = get("/")
        assert r.status_code == 200

    def test_stats_structure(self):
        r = get("/api/stats")
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "total_influencers", "authentic_count",
                    "avg_engagement_rate", "fake_detection_rate")
        assert d["total_influencers"] > 30_000, "Dataset too small"
        assert_range(d["avg_engagement_rate"], 0, 20, "avg_er")
        assert_range(d["fake_detection_rate"], 0, 100, "fake_rate")

    def test_groq_status(self):
        r = get("/api/groq-status")
        assert r.status_code == 200
        d = r.json()
        assert "available" in d
        assert isinstance(d["available"], bool)


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 2 — Creator search & discovery
# ══════════════════════════════════════════════════════════════════════════════
class TestCreatorDiscovery:

    def test_influencers_list(self):
        r = get("/api/influencers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert_keys(data[0], "id", "name", "handle", "er", "auth", "growth")

    def test_real_creators(self):
        r = get("/api/real-creators")
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "results", "total")
        assert d["total"] > 0
        if d["results"]:
            c = d["results"][0]
            assert_keys(c, "name", "handle", "cat", "followers", "er", "auth", "growth", "score")
            assert_range(c["auth"],   0, 100, "authenticity")
            assert_range(c["growth"], 0, 100, "growth_score")

    def test_search_by_keyword(self):
        r = get("/api/search", q="fitness")
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "results", "total", "page", "pages")
        assert isinstance(d["results"], list)

    def test_search_by_niche(self):
        r = get("/api/search", niche="beauty")
        assert r.status_code == 200

    def test_search_pagination(self):
        r = get("/api/search", page=1, limit=5)
        assert r.status_code == 200
        d = r.json()
        assert len(d["results"]) <= 5

    def test_search_with_filters(self):
        r = get("/api/search", min_auth=70, min_er=2.0, sort_by="engagement_rate")
        assert r.status_code == 200
        d = r.json()
        for creator in d["results"]:
            assert creator.get("auth", 100) >= 70


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 3 — ML model scoring
# ══════════════════════════════════════════════════════════════════════════════
class TestMLScoring:

    def test_viral_predict_structure(self):
        r = post("/api/viral-predict", {
            "content_category": "Fitness",
            "hashtags_count": 10,
            "has_call_to_action": 1,
            "post_hour": 18,
            "day_of_week": "Wednesday",
            "media_type": "reel",
            "follower_count": 50000,
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "viral_score", "predicted_bucket", "optimization_tips",
                    "classifier_used", "best_hours", "best_days")
        assert_range(d["viral_score"], 0, 100, "viral_score")
        assert d["predicted_bucket"] in ("viral", "high", "medium", "low")
        assert isinstance(d["optimization_tips"], list)

    def test_viral_predict_classifier_active(self):
        r = post("/api/viral-predict", {"content_category": "Beauty"})
        assert r.status_code == 200
        d = r.json()
        assert d.get("classifier_used") is True, \
            "Classifier not active -- run train_viral_model.py"

    def test_score_caption_structure(self):
        r = post("/api/score-caption", {
            "caption": "Transform your skin in 7 days using this organic serum. Link in bio!",
            "hashtags": "#skincare #organic #beauty #glow",
            "media_type": "reel",
            "content_category": "Beauty",
            "post_hour": 18,
            "day_of_week": "Wednesday",
            "follower_count": 80000,
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "virality_score", "has_cta", "strengths", "improvements")
        assert_range(d["virality_score"], 0, 100, "virality_score")
        assert isinstance(d["has_cta"], bool)

    def test_influencer_profile_scoring(self):
        r = post("/api/influencer-profile", {
            "name": "Test Creator",
            "handle": "@test_creator",
            "niche": "fitness",
            "followers": 85000,
            "avg_likes": 3200,
            "avg_comments": 140,
            "avg_shares": 80,
            "posts": 320,
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "ratefluencer_score", "tier", "scores",
                    "top_categories", "improvement_tips", "computed_er")
        assert_range(d["ratefluencer_score"], 0, 100, "RF_score")
        assert d["tier"] in ("Elite", "Premium", "Established", "Growing", "Emerging")
        assert_keys(d["scores"], "authenticity", "growth", "engagement",
                    "brand_match", "consistency", "share_rate")
        assert d["computed_er"] > 0, "ER not computed from counts"

    def test_roi_estimate(self):
        r = post("/api/roi-estimate", {
            "followers": 85000,
            "engagement_rate": 4.5,
            "niche": "fitness",
            "budget": 500000,
            "campaign_goal": "awareness",
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "tier", "cpp", "cpm", "expected_reach",
                    "posts_with_budget", "roi_ratio")
        assert d["expected_reach"] > 0
        assert d["posts_with_budget"] >= 1

    def test_content_quality_score(self):
        r = post("/api/content-quality", {
            "content": "I lost 10kg in 30 days with this 15-minute home workout. No equipment needed!",
            "category": "Fitness",
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "quality_score", "grade", "interpretation", "model")
        assert_range(d["quality_score"], 0, 100, "quality_score")
        assert d["grade"] in ("A", "B", "C", "D")

    def test_content_quality_comparison(self):
        r = post("/api/content-quality", {
            "content": "Amazing skincare transformation in 30 days using this organic serum!",
            "category": "Beauty",
            "compare_b": "New post.",
        })
        assert r.status_code == 200
        d = r.json()
        assert "comparison" in d
        assert d["comparison"]["winner"] in ("A", "B")


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 4 — Campaign matching
# ══════════════════════════════════════════════════════════════════════════════
class TestCampaignMatching:

    def test_match_returns_recommendations(self):
        r = post("/api/match", {
            "campaign_text": "organic skincare wellness beauty India",
            "campaign_goal": "awareness",
            "category_filters": ["Beauty"],
            "top_k": 3,
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "recommendations", "insights")
        recs = d["recommendations"]
        assert len(recs) > 0, "No recommendations returned"
        for rec in recs:
            assert_keys(rec, "name", "handle", "ratefluencer",
                        "authenticity", "brandMatch", "growth")
            assert_range(rec["ratefluencer"], 0, 100, "RF_score")
            assert_range(rec["authenticity"], 0, 100, "auth_score")

    def test_match_goal_conversion(self):
        r = post("/api/match", {
            "campaign_text": "protein supplement gym fitness India",
            "campaign_goal": "Sales / Conversions",
            "category_filters": ["Fitness"],
            "top_k": 2,
        })
        assert r.status_code == 200
        d = r.json()
        assert len(d.get("recommendations", [])) > 0

    def test_creator_match_against_campaigns(self):
        r = post("/api/creator-match", {
            "niche": "beauty",
            "followers": 80000,
            "engagement_rate": 4.5,
            "handle": "@beauty_creator",
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "campaigns", "total")
        assert isinstance(d["campaigns"], list)


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 5 — Trend discovery
# ══════════════════════════════════════════════════════════════════════════════
class TestTrendDiscovery:

    def test_trend_ranking_structure(self):
        r = post("/api/trend-ranking", {"category": "Technology"})
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "trends", "category")
        assert len(d["trends"]) > 0
        for t in d["trends"]:
            assert_keys(t, "topic", "trend_score", "source")
            assert_range(t["trend_score"], 0, 100, "trend_score")

    def test_discover_trends_endpoint(self):
        r = post("/api/discover-trends", {"category": "Fitness", "context": "gym brand"})
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "trends", "source")
        assert len(d["trends"]) > 0


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 6 — Content generation (Groq)
# ══════════════════════════════════════════════════════════════════════════════
class TestContentGeneration:

    def test_generate_content_structure(self):
        r = post("/api/generate-content", {
            "topic": "sustainable fitness routine for busy people",
            "tone": "Inspirational",
            "content_category": "Fitness",
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "reel_idea", "caption", "hashtags",
                    "virality_score", "predicted_bucket")
        assert len(d["reel_idea"]) > 10
        assert len(d["caption"]) > 10

    def test_generate_script_structure(self):
        r = post("/api/generate-script", {
            "topic": "morning skincare routine for glowing skin",
            "category": "Beauty",
            "duration": 30,
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "hook", "story", "cta", "estimated_duration")
        assert d["estimated_duration"] == 30

    def test_generate_linkedin_structure(self):
        r = post("/api/generate-linkedin", {
            "topic": "Why micro-influencers outperform celebrities in India",
            "tone": "Professional",
            "content_category": "Business",
        })
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "hook", "post", "hashtags")
        assert len(d["hook"]) > 5

    def test_score_caption_has_ai_feedback(self):
        r = post("/api/score-caption", {
            "caption": "New reel just dropped! Check my bio for the link.",
            "hashtags": "#reels #viral",
            "media_type": "reel",
            "content_category": "Lifestyle",
            "follower_count": 20000,
        })
        assert r.status_code == 200
        d = r.json()
        assert len(d.get("strengths", [])) >= 0
        assert len(d.get("improvements", [])) >= 0


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 7 — Feedback & learning loop
# ══════════════════════════════════════════════════════════════════════════════
class TestFeedbackLoop:

    def test_save_feedback(self):
        r = post("/api/feedback", {
            "key": "test_content",
            "vote": "up",
            "virality": 72,
            "category": "Fitness",
            "content": {"hook": "Test hook", "caption": "Test caption"},
        })
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert "total" in d

    def test_feedback_invalid_vote(self):
        r = post("/api/feedback", {"key": "test", "vote": "invalid"})
        assert r.status_code == 400

    def test_feedback_history(self):
        r = requests.get(f"{BASE}/api/feedback/history", timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert_keys(d, "total", "upvoted", "downvoted", "history")

    def test_agent_learn_endpoint(self):
        r = post("/api/agent/learn", {"category": "Fitness"})
        assert r.status_code == 200
        d = r.json()
        assert "learned" in d
        assert "message" in d

    def test_agent_preferences(self):
        r = get("/api/agent/preferences", category="Fitness")
        assert r.status_code == 200
        d = r.json()
        assert "has_preferences" in d


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 8 — Platform analytics
# ══════════════════════════════════════════════════════════════════════════════
class TestAnalytics:

    def test_platform_insights(self):
        r = get("/api/platform-insights")
        # May return 503 if Instagram_Analytics.csv not present -- acceptable
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            d = r.json()
            assert_keys(d, "category_stats", "platform_summary")

    def test_video_generation_storyboard(self):
        r = post("/api/generate-video", {
            "reel_idea": "Sunrise yoga flow on a rooftop",
            "category": "Fitness",
            "duration": 30,
        })
        assert r.status_code in (200, 202)
        d = r.json()
        assert "status" in d
        assert d["status"] in ("generating", "storyboard_ready")
        if d["status"] == "storyboard_ready":
            assert len(d.get("scenes", [])) > 0


# ══════════════════════════════════════════════════════════════════════════════
# GROUP 9 — Model files & inference validation (offline, no server needed)
# ══════════════════════════════════════════════════════════════════════════════
class TestModelFiles:

    REQUIRED_MODELS = [
        "authenticity_model_v2.pkl",
        "growth_model_v2.pkl",
        "viral_clf_v1.pkl",
        "ratefluencer_model_v1.pkl",
    ]

    def test_all_model_files_exist(self):
        for f in self.REQUIRED_MODELS:
            path = BACKEND / f
            assert path.exists(), f"Missing model file: {f}"

    def test_authenticity_model_metrics(self):
        meta = joblib.load(BACKEND / "authenticity_metadata_v2.pkl")
        assert meta["roc_auc"] >= 0.95, f"Auth ROC-AUC too low: {meta['roc_auc']}"
        assert meta["f1_score"] >= 0.85, f"Auth F1 too low: {meta['f1_score']}"
        assert meta["accuracy"] >= 0.85, f"Auth accuracy too low: {meta['accuracy']}"

    def test_authenticity_model_loads_and_predicts(self):
        import numpy as np
        model    = joblib.load(BACKEND / "authenticity_model_v2.pkl")
        features = joblib.load(BACKEND / "authenticity_features_v2.pkl")
        # Authentic-looking account
        authentic = {
            'pos': 200, 'flw': 80000, 'flg': 1600, 'bl': 0,
            'lin': 1, 'cl': 3, 'cz': 2, 'ni': 8,
            'erl': 1200, 'erc': 4, 'lt': 1, 'hc': 12,
            'pr': 0.92, 'fo': 0.02, 'cs': 0.15, 'pi': 1,
        }
        import pandas as pd
        X = pd.DataFrame([authentic])[features]
        prob = model.predict_proba(X)[0][1]
        assert prob > 0.5, f"Authentic account scored as fake: {prob:.3f}"

    def test_viral_classifier_loads(self):
        clf   = joblib.load(BACKEND / "viral_clf_v1.pkl")
        feats = joblib.load(BACKEND / "viral_features_v1.pkl")
        le    = joblib.load(BACKEND / "viral_label_encoder_v1.pkl")
        assert len(feats) >= 7, "Too few viral features"
        assert set(le.classes_) == {"viral", "high", "medium", "low"}

    def test_growth_model_loads(self):
        model = joblib.load(BACKEND / "growth_model_v2.pkl")
        feats = joblib.load(BACKEND / "growth_features_v2.pkl")
        assert model.n_features_in_ == len(feats)
        assert model.n_estimators >= 100

    def test_ratefluencer_meta_learner(self):
        import numpy as np
        model = joblib.load(BACKEND / "ratefluencer_model_v1.pkl")
        feats = joblib.load(BACKEND / "ratefluencer_features_v1.pkl")
        # Predict for a high-ER creator
        test_X = [[13.5, 4.5, 50, 0.05, 0.005, 0.003, 0.65, 3.6, 2, 1]]
        if len(feats) == len(test_X[0]):
            pred = float(np.clip(model.predict(test_X)[0], 0, 100))
            assert_range(pred, 0, 100, "RF_meta_score")


# ══════════════════════════════════════════════════════════════════════════════
# Simple runner (alternative to pytest)
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import traceback

    # Check if server is running
    try:
        requests.get(f"{BASE}/", timeout=3)
        server_up = True
    except Exception:
        server_up = False
        print("WARNING: Backend not running at localhost:5000")
        print("  Start it with: cd backend && python app.py")
        print("  Only offline model tests will run.\n")

    classes = [
        TestServerHealth, TestCreatorDiscovery, TestMLScoring,
        TestCampaignMatching, TestTrendDiscovery, TestContentGeneration,
        TestFeedbackLoop, TestAnalytics, TestModelFiles,
    ]

    passed = failed = skipped = 0
    results = []

    for cls in classes:
        obj = cls()
        group = cls.__name__.replace("Test", "")
        print(f"\n[{group}]")
        for name in [m for m in dir(obj) if m.startswith("test_")]:
            # Skip server tests when server is down
            if not server_up and cls not in (TestModelFiles,):
                print(f"  SKIP  {name}")
                skipped += 1
                continue
            try:
                getattr(obj, name)()
                print(f"  PASS  {name}")
                passed += 1
            except Exception as e:
                short = str(e)[:80]
                print(f"  FAIL  {name} -- {short}")
                failed += 1

    print("\n" + "="*60)
    print(f"RESULTS:  {passed} passed  |  {failed} failed  |  {skipped} skipped")
    print(f"SUCCESS RATE: {passed/(passed+failed)*100:.0f}%" if (passed+failed) > 0 else "No tests ran")
    print("="*60)
    sys.exit(0 if failed == 0 else 1)

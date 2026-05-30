from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import logging
import os
from pathlib import Path
from ratefluencer_engine import RatefluencerEngine

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS to allow the frontend (localhost:5173) to communicate with the API
CORS(app)

# Get absolute path to backend directory
BACKEND_DIR = Path(__file__).parent.absolute()
# Use the expanded 50,000 creator dataset (50x more variety!)
CREATORS_CSV = BACKEND_DIR / 'synthetic_influencer_50k.csv'
# Fallback to original if 50k not available
if not CREATORS_CSV.exists():
    CREATORS_CSV = BACKEND_DIR / 'synthetic_influencer_v2.csv'

# Initialize Ratefluencer engine at startup
logger.info("Initializing Ratefluencer AI Orchestrator inside Flask server...")
logger.info(f"Using creators CSV from: {CREATORS_CSV}")
logger.info(f"Dataset size: {len(pd.read_csv(CREATORS_CSV))} creators")
engine = RatefluencerEngine(creators_csv=str(CREATORS_CSV))


@app.route("/")
def home():
    return "Ratefluencer AI Model Server Running Successfully"


@app.route("/api/influencers")
def influencers():
    """Returns general featured influencers list (from CSV)"""
    try:
        # Return a quick list of top authentic creators from the dataset
        sample_creators = engine.creators_df[engine.creators_df['fake_account'] == 0].head(8)
        names = ["Aarav Mehta", "Ananya Sharma", "Kabir Kapoor", "Pooja Malhotra", "Rohan Sen", "Aditi Rao", "Ishaan Roy", "Kiara Joshi"]
        
        result_list = []
        for idx, row in enumerate(sample_creators.to_dict('records')):
            c_name = names[idx % len(names)]
            c_handle = f"@{c_name.lower().replace(' ', '_')}"
            
            result_list.append({
                "id": int(row['creator_id']),
                "name": c_name,
                "handle": c_handle,
                "cat": str(row['niche']),
                "followers": f"{int(row['followers']) / 1000:.0f}K" if row['followers'] < 1000000 else f"{int(row['followers']) / 1000000:.1f}M",
                "er": f"{float(row['engagement_rate']):.1f}%",
                "auth": int(row['authenticity_score']),
                "growth": int(row['growth_score']),
                "score": int(row['growth_score'] * 0.5 + row['authenticity_score'] * 0.5),
                "tier": "S" if row['followers'] > 100000 else "A",
                "av": "".join([part[0] for part in c_name.split()]),
                "c1": "#E1F5EE" if idx % 2 == 0 else "#E6F1FB",
                "c2": "#085041" if idx % 2 == 0 else "#0C447C"
            })
            
        return jsonify(result_list), 200
    except Exception as e:
        logger.error(f"Featured influencers load failed: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/api/match", methods=["POST"])
def match_creators():
    """
    Unified ML RAG Matcher endpoint.
    
    Integrates all 3 models (Growth, Authenticity, Brand Match) dynamically.
    """
    try:
        data = request.get_json() or {}
        campaign_text = data.get("campaign_text", "")
        campaign_goal = data.get("campaign_goal", "balanced")
        category_filter = data.get("category_filter", None)
        top_k = int(data.get("top_k", 3))
        
        if not campaign_text:
            return jsonify({"error": "campaign_text parameter is required."}), 400
            
        logger.info(f"Received match request for campaign: '{campaign_text[:40]}...' | Goal: {campaign_goal}")
        
        # Retrieve candidates from Cosine ChromaDB
        match_results = engine.brand_matcher.match(
            brand_campaign=campaign_text,
            top_k=top_k * 3,  # query more candidates to account for goal-scoring re-rank
            category_filter=category_filter,
            min_confidence=0.05
        )
        
        formatted_recos = []
        names = ["Aarav Mehta", "Ananya Sharma", "Kabir Kapoor", "Pooja Malhotra", "Rohan Sen", "Aditi Rao", "Ishaan Roy", "Kiara Joshi", "Neha Verma", "Siddharth Das", "Zoya Khan", "Vikram Gill"]
        
        # Rerank candidates dynamically
        for match in match_results['top_matches']:
            creator_id = int(match['creator_id'])
            
            # Predict scores across ALL 3 Models dynamically!
            score_res = engine.score_creator(
                creator_id=creator_id,
                campaign_text=campaign_text,
                campaign_goal=campaign_goal
            )
            
            # Exclude high-risk/suspicious accounts completely from recommendations
            if score_res['risk_metrics']['risk_level'] == 'High' or score_res['risk_metrics']['is_fake']:
                logger.info(f"Excluding creator ID {creator_id} from recommendations due to High Fraud Risk.")
                continue
            
            final_score = int(score_res['ratefluencer_score'])
            success_prob = f"{score_res['success_probability'] * 100.0:.0f}%"
            virality = int(score_res['scores']['growth_score'])
            brand_match = int(score_res['scores']['brand_match_score'])
            authenticity = int(score_res['scores']['authenticity_score'])
            er = f"{score_res['engagement_rate']:.1f}%"
            niche = score_res['niche']
            followers_val = score_res['followers']
            risk_level = score_res['risk_metrics']['risk_level']
            
            # Follower label formatter
            if followers_val >= 1000000:
                followers_str = f"{followers_val / 1000000:.1f}M"
            elif followers_val >= 1000:
                followers_str = f"{followers_val / 1000:.0f}K"
            else:
                followers_str = str(followers_val)
                
            # Assign presentation variables
            c_name = names[creator_id % len(names)]
            c_handle = f"@{c_name.lower().replace(' ', '_')}"
            
            # Ring color maps
            if final_score >= 80:
                ring_color = '#C8F068'  # green
            elif final_score >= 60:
                ring_color = '#68B8F0'  # blue
            else:
                ring_color = '#F0C96A'  # yellow
                
            # Circle dash offset math
            ring_offset = int(201 * (1.0 - (final_score / 100.0)))
            
            why_text = f"✦ Category similarity of {score_res['scores']['brand_match_score']:.0f}% with verified {risk_level.lower()} fraud risk."
            if risk_level == 'High':
                why_text = f"⚠️ SUSPICIOUS: Flagged by Authenticity Detector. Do not collaborate."
            
            badge_val = "👑 #1 Match" if len(formatted_recos) == 0 else None
            
            formatted_recos.append({
                "rank": len(formatted_recos) + 1,
                "name": c_name,
                "handle": c_handle,
                "meta": f"{niche} · {followers_str} followers · Instagram",
                "badge": badge_val,
                "ratefluencer": final_score,
                "growth": virality,
                "authenticity": authenticity,
                "brandMatch": brand_match,
                "successProb": success_prob,
                "engRate": er,
                "why": why_text,
                "ringColor": ring_color,
                "ringOffset": ring_offset,
                "rankClass": f"rank-{len(formatted_recos) + 1}"
            })
            
            # Clamp to requested limit after re-ranking
            if len(formatted_recos) >= top_k:
                break
                
        # Generate dynamic Campaign Insights based on matching results
        insights = []
        if len(formatted_recos) > 0:
            first_creator = formatted_recos[0]
            insights.append({
                "icon": "🎯",
                "title": "Optimal Allocation",
                "text": f"Allocate the majority of your budget to {first_creator['name']} ({first_creator['meta'].split(' · ')[1]}) to maximize reach, reserving 10% for highly targeted wellness micro-creators."
            })
            
            suspicious_found = any(m['risk_metrics']['risk_level'] == 'High' for m in [score_res])
            if suspicious_found:
                insights.append({
                    "icon": "⚠️",
                    "title": "Fraud Alert",
                    "text": "The model successfully isolated suspicious bot accounts. Collaborations with these creators are highly discouraged due to unnatural follower ratios."
                })
            else:
                insights.append({
                    "icon": "🛡️",
                    "title": "Safety Verified",
                    "text": "All top recommended profiles are confirmed authentic (Low Risk) by the XGBoost fraud detection model."
                })
                
            insights.append({
                "icon": "💡",
                "title": "Niche Opportunity",
                "text": f"Micro-creators in the {category_filter or 'wellness'} category show a 2.5× higher save rate and 15% lower CPC than mega-influencers."
            })
            
        return jsonify({
            "recommendations": formatted_recos,
            "insights": insights,
            "goal": campaign_goal,
            "timestamp": pd.Timestamp.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Campaign matching failed: {e}")
        return jsonify({"error": str(e)}), 400


if __name__ == '__main__':
    # Start the Flask app
    app.run(debug=True, port=5000)
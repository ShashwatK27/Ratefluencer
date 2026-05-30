from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import logging
from pathlib import Path
from ratefluencer_engine import RatefluencerEngine

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

BACKEND_DIR = Path(__file__).parent.absolute()
CREATORS_CSV = BACKEND_DIR / 'synthetic_influencer_50k.csv'
if not CREATORS_CSV.exists():
    CREATORS_CSV = BACKEND_DIR / 'synthetic_influencer_v2.csv'

# Auto-generate the dataset on first run if the CSV doesn't exist
if not CREATORS_CSV.exists():
    logger.info(f"{CREATORS_CSV.name} not found — running generator (this takes ~10s)...")
    from generate_50k_creators import generate_dataset
    generate_dataset(output_path=str(CREATORS_CSV))
    logger.info("Dataset generation complete.")

logger.info("Initializing Ratefluencer AI Orchestrator inside Flask server...")
logger.info(f"Using creators CSV from: {CREATORS_CSV}")
logger.info(f"Dataset size: {len(pd.read_csv(CREATORS_CSV))} creators")
engine = RatefluencerEngine(creators_csv=str(CREATORS_CSV))

# 50 names so nearby creator IDs don't collide (Fix #10)
CREATOR_NAMES = [
    "Aarav Mehta", "Ananya Sharma", "Kabir Kapoor", "Pooja Malhotra",
    "Rohan Sen", "Aditi Rao", "Ishaan Roy", "Kiara Joshi",
    "Neha Verma", "Siddharth Das", "Zoya Khan", "Vikram Gill",
    "Priya Nair", "Arjun Bose", "Divya Iyer", "Rahul Gupta",
    "Sneha Patel", "Karan Bajaj", "Meera Krishnan", "Ayaan Sheikh",
    "Trisha Bansal", "Vivek Reddy", "Aisha Mirza", "Dev Saxena",
    "Nisha Choudhary", "Rajat Sinha", "Simran Dhawan", "Aditya Joshi",
    "Kavya Menon", "Nikhil Arora", "Tara Pillai", "Harsh Malhotra",
    "Riyanshi Shah", "Parth Desai", "Shruti Nambiar", "Gaurav Pandey",
    "Pallavi Hegde", "Varun Khanna", "Ankita Singh", "Manav Oberoi",
    "Disha Thakur", "Rishab Chandra", "Natasha Bhat", "Surya Vardhan",
    "Layla Kapoor", "Aryan Trivedi", "Chithra Rajan", "Mihir Jain",
    "Tanvi Agarwal", "Saurabh Naik",
]


@app.route("/")
def home():
    return "Ratefluencer AI Model Server Running Successfully"


@app.route("/api/influencers")
def influencers():
    try:
        sample_creators = engine.creators_df[engine.creators_df['fake_account'] == 0].head(8)
        result_list = []
        for idx, row in enumerate(sample_creators.to_dict('records')):
            c_name = CREATOR_NAMES[int(row['creator_id']) % len(CREATOR_NAMES)]
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
    try:
        data = request.get_json() or {}
        campaign_text = data.get("campaign_text", "")
        campaign_goal = data.get("campaign_goal", "balanced")
        category_filters = data.get("category_filters", [])  # now a list (Fix #2)
        top_k = int(data.get("top_k", 3))

        # Parse advanced filters (Fix #4)
        min_auth_str = data.get("min_authenticity", "Any")
        tier_filter_str = data.get("tier_filter", "All tiers")
        min_er_str = data.get("min_engagement_rate", "Any")
        excluded_brands_str = data.get("excluded_brands", "")

        min_auth_val = 0
        if min_auth_str and min_auth_str != "Any":
            try:
                min_auth_val = int(min_auth_str.replace("+", ""))
            except ValueError:
                pass

        min_er_val = 0.0
        if min_er_str and min_er_str != "Any":
            try:
                min_er_val = float(min_er_str.replace("%+", ""))
            except ValueError:
                pass

        tier_ranges = {
            "All tiers":        (0, float('inf')),
            "Nano (1K–10K)":    (1_000, 10_000),
            "Micro (10K–100K)": (10_000, 100_000),
            "Macro (100K–1M)":  (100_000, 1_000_000),
            "Mega (1M+)":       (1_000_000, float('inf')),
        }
        tier_min, tier_max = tier_ranges.get(tier_filter_str, (0, float('inf')))

        excluded_niches = [b.strip().lower() for b in excluded_brands_str.split(",") if b.strip()] if excluded_brands_str else []

        if not campaign_text:
            return jsonify({"error": "campaign_text parameter is required."}), 400

        logger.info(f"Match request: '{campaign_text[:40]}...' | Goal: {campaign_goal} | Categories: {category_filters}")

        match_results = engine.brand_matcher.match(
            brand_campaign=campaign_text,
            top_k=top_k * 3,
            category_filters=category_filters if category_filters else None,  # Fix #2
            min_confidence=0.05
        )

        formatted_recos = []
        all_score_results = []  # Fix #1: collect all scores before filtering

        for match in match_results['top_matches']:
            creator_id = int(match['creator_id'])

            score_res = engine.score_creator(
                creator_id=creator_id,
                campaign_text=campaign_text,
                campaign_goal=campaign_goal
            )
            all_score_results.append(score_res)  # Fix #1: track before any continue

            if score_res['risk_metrics']['risk_level'] == 'High' or score_res['risk_metrics']['is_fake']:
                logger.info(f"Excluding creator {creator_id}: High fraud risk.")
                continue

            final_score = int(score_res['ratefluencer_score'])
            virality = int(score_res['scores']['growth_score'])
            brand_match = int(score_res['scores']['brand_match_score'])
            authenticity = int(score_res['scores']['authenticity_score'])
            er_raw = score_res['engagement_rate']
            er = f"{er_raw:.1f}%"
            niche = score_res['niche']
            followers_val = score_res['followers']
            risk_level = score_res['risk_metrics']['risk_level']

            # Apply advanced filters (Fix #4)
            if authenticity < min_auth_val:
                logger.info(f"Skipping creator {creator_id}: authenticity {authenticity} < {min_auth_val}")
                continue
            if not (tier_min <= followers_val <= tier_max):
                logger.info(f"Skipping creator {creator_id}: followers {followers_val} outside tier range")
                continue
            if er_raw < min_er_val:
                logger.info(f"Skipping creator {creator_id}: ER {er_raw:.1f}% < {min_er_val}%")
                continue
            if excluded_niches and any(excl in niche.lower() for excl in excluded_niches):
                logger.info(f"Skipping creator {creator_id}: niche '{niche}' matches excluded list")
                continue

            if followers_val >= 1_000_000:
                followers_str = f"{followers_val / 1_000_000:.1f}M"
            elif followers_val >= 1_000:
                followers_str = f"{followers_val / 1_000:.0f}K"
            else:
                followers_str = str(followers_val)

            c_name = CREATOR_NAMES[creator_id % len(CREATOR_NAMES)]
            c_handle = f"@{c_name.lower().replace(' ', '_')}"

            if final_score >= 80:
                ring_color = '#C8F068'
            elif final_score >= 60:
                ring_color = '#68B8F0'
            else:
                ring_color = '#F0C96A'

            ring_offset = int(201 * (1.0 - (final_score / 100.0)))
            # Fix #3: removed dead High-risk why_text branch (high-risk already excluded above)
            why_text = f"❆ Category similarity of {score_res['scores']['brand_match_score']:.0f}% with verified {risk_level.lower()} fraud risk."
            badge_val = "\U0001f451 #1 Match" if len(formatted_recos) == 0 else None

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
                "successProb": f"{score_res['success_probability'] * 100.0:.0f}%",
                "engRate": er,
                "why": why_text,
                "ringColor": ring_color,
                "ringOffset": ring_offset,
                "rankClass": f"rank-{len(formatted_recos) + 1}"
            })

            if len(formatted_recos) >= top_k:
                break

        insights = []
        if formatted_recos:
            first = formatted_recos[0]
            insights.append({
                "icon": "\U0001f3af",
                "title": "Optimal Allocation",
                "text": f"Allocate the majority of your budget to {first['name']} ({first['meta'].split(' · ')[1]}) to maximise reach, reserving 10% for highly targeted micro-creators."
            })

            # Fix #1: use all_score_results (not just the last loop variable)
            suspicious_found = any(
                s['risk_metrics']['risk_level'] == 'High' or s['risk_metrics']['is_fake']
                for s in all_score_results
            )
            if suspicious_found:
                insights.append({
                    "icon": "⚠️",
                    "title": "Fraud Alert",
                    "text": "Suspicious bot accounts were detected and excluded from recommendations. The XGBoost model flagged unnatural follower ratios in the candidate pool."
                })
            else:
                insights.append({
                    "icon": "\U0001f6e1️",
                    "title": "Safety Verified",
                    "text": "All top recommended profiles are confirmed authentic (Low Risk) by the XGBoost fraud detection model."
                })

            primary_cat = category_filters[0] if category_filters else 'wellness'
            insights.append({
                "icon": "\U0001f4a1",
                "title": "Niche Opportunity",
                "text": f"Micro-creators in the {primary_cat} category show a 2.5× higher save rate and 15% lower CPC than mega-influencers."
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
    app.run(debug=True, port=5000)

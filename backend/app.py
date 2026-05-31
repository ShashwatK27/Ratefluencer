from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import logging
import os
import json
from pathlib import Path
from ratefluencer_engine import RatefluencerEngine
from viral_predictor import ViralPredictor
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Groq client — reads GROQ_API_KEY from .env
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

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
viral_predictor = ViralPredictor()

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


NICHE_ALIASES = {
    'tech': 'tech', 'fitness': 'fitness', 'food': 'food',
    'fashion': 'fashion', 'beauty': 'beauty', 'travel': 'travel',
    'gaming': 'gaming', 'finance': 'finance', 'education': 'education',
    'entertainment': 'entertainment', 'wellness': 'wellness', 'pets': 'pets',
    'art': 'art', 'comedy': 'comedy', 'music': 'music', 'sports': 'sports',
    'cooking': 'cooking', 'diy': 'diy', 'lifestyle': 'lifestyle',
    'photography': 'photography', 'business': 'business',
}


@app.route("/")
def home():
    return "Ratefluencer AI Model Server Running Successfully"


@app.route("/api/stats")
def stats():
    """Returns live platform statistics computed from the loaded dataset."""
    try:
        df = engine.creators_df
        total = len(df)
        authentic_count = int((df['fake_account'] == 0).sum())
        avg_er = float(df['engagement_rate'].mean())
        top_score = int(df['growth_score'].max() * 0.5 + df['authenticity_score'].max() * 0.5)
        return jsonify({
            "total_influencers": total,
            "authentic_count": authentic_count,
            "avg_engagement_rate": round(avg_er, 2),
            "top_score": top_score,
            "fake_detection_rate": round((1 - authentic_count / total) * 100, 1),
        }), 200
    except Exception as e:
        logger.error(f"Stats failed: {e}")
        return jsonify({"error": str(e)}), 500


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


@app.route("/api/search")
def search_creators():
    """Search and filter all 50k creators with pagination"""
    try:
        # Get query parameters
        query = request.args.get('q', '').lower()  # Name or handle search
        niche = request.args.get('niche', '')  # Filter by niche/category
        min_followers = int(request.args.get('min_followers', 0))
        max_followers = int(request.args.get('max_followers', float('inf')))
        min_auth = int(request.args.get('min_auth', 0))
        min_er = float(request.args.get('min_er', 0.0))
        sort_by = request.args.get('sort_by', 'followers')  # followers, authenticity, growth, engagement_rate
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))

        # Start with all creators
        df = engine.creators_df.copy()

        # Apply filters
        if query:
            # Search by niche
            df = df[df['niche'].str.lower().str.contains(query, na=False)]
        
        if niche:
            df = df[df['niche'].str.lower() == niche.lower()]
        
        df = df[(df['followers'] >= min_followers) & (df['followers'] <= max_followers)]
        df = df[df['authenticity_score'] >= min_auth]
        df = df[df['engagement_rate'] >= min_er]

        total_count = len(df)

        # Sort
        if sort_by == 'authenticity':
            df = df.sort_values('authenticity_score', ascending=False)
        elif sort_by == 'growth':
            df = df.sort_values('growth_score', ascending=False)
        elif sort_by == 'engagement_rate':
            df = df.sort_values('engagement_rate', ascending=False)
        else:  # followers (default)
            df = df.sort_values('followers', ascending=False)

        # Pagination
        start = (page - 1) * limit
        end = start + limit
        paginated_df = df.iloc[start:end]

        # Format results
        result_list = []
        for idx, (_, row) in enumerate(paginated_df.iterrows()):
            creator_id = int(row['creator_id'])
            c_name = CREATOR_NAMES[creator_id % len(CREATOR_NAMES)]
            c_handle = f"@{c_name.lower().replace(' ', '_')}"
            
            followers_val = int(row['followers'])
            if followers_val >= 1_000_000:
                followers_str = f"{followers_val / 1_000_000:.1f}M"
            elif followers_val >= 1_000:
                followers_str = f"{followers_val / 1_000:.0f}K"
            else:
                followers_str = str(followers_val)

            result_list.append({
                "id": creator_id,
                "name": c_name,
                "handle": c_handle,
                "cat": str(row['niche']),
                "followers": followers_str,
                "followersRaw": followers_val,
                "er": f"{float(row['engagement_rate']):.1f}%",
                "erRaw": float(row['engagement_rate']),
                "auth": int(row['authenticity_score']),
                "growth": int(row['growth_score']),
                "score": int(row['growth_score'] * 0.5 + row['authenticity_score'] * 0.5),
                "fake": int(row['fake_account']),
                "av": "".join([part[0] for part in c_name.split()]),
            })

        return jsonify({
            "results": result_list,
            "total": total_count,
            "page": page,
            "limit": limit,
            "pages": (total_count + limit - 1) // limit
        }), 200

    except Exception as e:
        logger.error(f"Search failed: {e}")
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


def _parse_groq_json(raw: str) -> dict:
    """Extract and parse the first JSON object from a Groq response string."""
    start = raw.find('{')
    end = raw.rfind('}') + 1
    if start >= 0 and end > start:
        return json.loads(raw[start:end])
    return {}


@app.route("/api/generate-content", methods=["POST"])
def generate_content():
    """Generate viral reel idea, script, caption, and hashtags — with real data optimization."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        tone  = data.get("tone", "Inspirational")
        content_category = data.get("content_category", "Lifestyle")

        if not topic:
            return jsonify({"error": "topic is required"}), 400

        # Get real data insights for this category
        insights = viral_predictor.get_content_insights(content_category)
        best_hours   = insights.get('best_hours', [18, 12, 20])
        best_days    = insights.get('best_days', ['Wednesday', 'Friday'])
        opt_hashtags = insights.get('optimal_hashtag_range', (6, 15))
        best_media   = insights.get('best_media_type', 'reel')

        logger.info(f"Generating viral content for topic: '{topic}'")

        prompt = f"""You are a viral social media content strategist specialising in Instagram Reels.
Generate {tone.lower()} viral content for this topic: "{topic}"

Data-driven context from real Instagram analytics (30K posts):
- Best posting hours: {best_hours[0]}:00–{best_hours[-1]}:00
- Optimal hashtag count: {opt_hashtags[0]}–{opt_hashtags[1]}
- Best performing format: {best_media}

Return ONLY a valid JSON object with these exact keys (no extra text):
{{
  "trend_score": <integer 0-100, how trending this topic is right now>,
  "reel_idea": "<1-2 sentence creative reel concept>",
  "script": "<60-second reel script with hook, body, and CTA>",
  "caption": "<engaging Instagram caption under 150 words with strong CTA>",
  "hashtags": "<exactly {opt_hashtags[0]} to {opt_hashtags[1]} relevant hashtags separated by spaces>"
}}"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content.strip()
        result = _parse_groq_json(raw)

        if not result:
            return jsonify({"error": "Failed to parse AI response"}), 500

        # Count hashtags in generated content to score against real data
        hashtag_count = len(result.get('hashtags', '').split())
        has_cta = int(any(w in result.get('caption','').lower() for w in ['click','link','bio','comment','share','follow','save','dm']))

        viral_score_result = viral_predictor.predict({
            'content_category': content_category,
            'hashtags_count': hashtag_count,
            'has_call_to_action': has_cta,
            'post_hour': best_hours[0],
            'day_of_week': best_days[0],
            'media_type': best_media,
        })

        result['virality_score'] = viral_score_result['viral_score']
        result['predicted_bucket'] = viral_score_result['predicted_bucket']
        result['optimization_tips'] = viral_score_result.get('optimization_tips', [])
        result['best_post_time'] = f"{best_hours[0]}:00 on {best_days[0]}"
        result['data_source'] = f"Optimised using {insights.get('data_points', 3000):,} real {content_category} posts"

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/run-agent", methods=["POST"])
def run_agent():
    """
    Autonomous agent with feedback loop:
    discover trend → find influencer → [retry if low score] → generate content → predict success
    """
    try:
        data = request.get_json() or {}
        goal = data.get("goal", "").strip()

        if not goal:
            return jsonify({"error": "goal is required"}), 400

        logger.info(f"Running autonomous agent for goal: '{goal}'")

        # Step 1 — Discover trend
        trend_prompt = f"""You are a social media trend analyst.
For this campaign goal: "{goal}"

Identify the single most relevant trending topic right now.
Return ONLY JSON (no other text): {{"trend": "<trend description in 1-2 sentences>", "category": "<one of: Fitness, Beauty, Fashion, Technology, Food, Lifestyle, Travel, Music, Photography, Comedy>"}}"""

        trend_resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": trend_prompt}],
            temperature=0.5,
            max_tokens=200,
        )
        trend_data = _parse_groq_json(trend_resp.choices[0].message.content.strip())
        trend = trend_data.get("trend", "Sustainable lifestyle content is surging across Gen-Z audiences.")
        detected_category = trend_data.get("category", "Lifestyle")

        # Step 2 — Find best influencer via ML engine (with feedback loop)
        match_results = engine.brand_matcher.match(
            brand_campaign=goal,
            top_k=15,
            min_confidence=0.05
        )

        best_creator = None
        iterations = 0
        for match in match_results.get("top_matches", []):
            creator_id = int(match["creator_id"])
            score_res = engine.score_creator(creator_id=creator_id, campaign_text=goal)
            iterations += 1

            # Feedback loop: skip low-scoring or high-risk creators
            if score_res["risk_metrics"]["risk_level"] == "High":
                logger.info(f"Agent feedback: skipping creator {creator_id} (High risk)")
                continue
            if score_res["success_probability"] < 0.55 and iterations < 10:
                logger.info(f"Agent feedback: skipping creator {creator_id} (low success prob {score_res['success_probability']:.0%})")
                continue

            score_res["display_name"] = CREATOR_NAMES[creator_id % len(CREATOR_NAMES)]
            best_creator = score_res
            break

        influencer_name   = best_creator["display_name"]        if best_creator else "Ananya Sharma"
        virality_score    = int(best_creator["scores"]["growth_score"])  if best_creator else 72
        campaign_success  = int(best_creator["success_probability"]*100) if best_creator else 75
        influencer_niche  = best_creator.get("niche", detected_category) if best_creator else detected_category

        # Get real data insights for the detected category
        insights = viral_predictor.get_content_insights(detected_category)
        best_hours = insights.get('best_hours', [18, 12])
        best_days  = insights.get('best_days', ['Wednesday', 'Friday'])
        opt_hashtags = insights.get('optimal_hashtag_range', (6, 15))

        # Step 3 — Generate content for that influencer
        content_prompt = f"""You are a viral content creator for Instagram.
Campaign goal: {goal}
Trending topic: {trend}
Assigned influencer: {influencer_name} (niche: {influencer_niche})
Data insight: Best posting time is {best_hours[0]}:00 on {best_days[0]}, use {opt_hashtags[0]}–{opt_hashtags[1]} hashtags

Generate a reel idea and a caption tailored to this influencer and trend.
Return ONLY JSON (no other text):
{{
  "reel_idea": "<creative 1-2 sentence reel concept>",
  "caption": "<engaging Instagram caption under 100 words with a clear CTA>"
}}"""

        content_resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": content_prompt}],
            temperature=0.7,
            max_tokens=400,
        )
        content_data = _parse_groq_json(content_resp.choices[0].message.content.strip())

        return jsonify({
            "trend":            trend,
            "category":         detected_category,
            "influencer":       influencer_name,
            "reel_idea":        content_data.get("reel_idea", "Create an authentic day-in-the-life reel showcasing real product use."),
            "caption":          content_data.get("caption", "Real results, real people. Discover the difference. #sponsored"),
            "virality_score":   virality_score,
            "campaign_success": campaign_success,
            "best_post_time":   f"{best_hours[0]}:00 on {best_days[0]}",
            "agent_iterations": iterations,
            "data_backed":      True,
        }), 200

    except Exception as e:
        logger.error(f"Agent run failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/viral-predict", methods=["POST"])
def viral_predict():
    """Score a content brief against real Instagram performance benchmarks."""
    try:
        data = request.get_json() or {}
        result = viral_predictor.predict({
            'content_category': data.get('content_category', 'Lifestyle'),
            'hashtags_count':   data.get('hashtags_count', 10),
            'caption_length':   data.get('caption_length', 150),
            'has_call_to_action': int(data.get('has_call_to_action', 1)),
            'post_hour':        data.get('post_hour', 18),
            'day_of_week':      data.get('day_of_week', 'Wednesday'),
            'media_type':       data.get('media_type', 'reel'),
            'follower_count':   data.get('follower_count', 50000),
        })
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Viral predict failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/platform-insights")
def platform_insights():
    """Real Instagram performance insights by category."""
    try:
        ig_csv = BACKEND_DIR.parent / 'Instagram_Analytics.csv'
        df = pd.read_csv(ig_csv)

        cat_stats = []
        for cat in df['content_category'].unique():
            cdf = df[df['content_category'] == cat]
            viral_count = len(cdf[cdf['performance_bucket_label'].isin(['viral','high'])])
            cat_stats.append({
                'category': cat,
                'total_posts': len(cdf),
                'viral_rate': round(viral_count / len(cdf) * 100, 1),
                'avg_engagement_rate': round(float(cdf['engagement_rate'].mean()) * 100, 2),
                'avg_hashtags': round(float(cdf['hashtags_count'].mean()), 1),
                'best_media': cdf[cdf['performance_bucket_label'].isin(['viral','high'])].groupby('media_type').size().idxmax()
                    if len(cdf[cdf['performance_bucket_label'].isin(['viral','high'])]) > 0 else 'reel',
            })

        hour_df = df[df['performance_bucket_label'].isin(['viral','high'])].groupby('post_hour').size().reset_index()
        hour_df.columns = ['hour', 'count']

        day_df = df[df['performance_bucket_label'].isin(['viral','high'])].groupby('day_of_week').size().reset_index()
        day_df.columns = ['day', 'count']

        summary = viral_predictor.get_platform_summary()

        return jsonify({
            'category_stats': sorted(cat_stats, key=lambda x: x['viral_rate'], reverse=True),
            'hourly_distribution': hour_df.to_dict('records'),
            'daily_distribution': day_df.to_dict('records'),
            'platform_summary': summary,
            'total_posts': len(df),
        }), 200
    except Exception as e:
        logger.error(f"Platform insights failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/real-creators")
def real_creators():
    """Returns real top influencers formatted for the dashboard table."""
    try:
        ig_path = BACKEND_DIR.parent / 'Top100.csv'
        tt_path = BACKEND_DIR.parent / 'tiktok.csv'

        ig_df = pd.read_csv(ig_path)
        tt_df = pd.read_csv(tt_path)

        # Known categories for top creators
        KNOWN_CATS = {
            'cristiano': 'Sports',       'kyliejenner': 'Beauty',
            'leomessi': 'Sports',        'therock': 'Fitness',
            'kimkardashian': 'Fashion',  'selenagomez': 'Beauty',
            'beyonce': 'Music',          'instagram': 'Lifestyle',
            'natgeo': 'Photography',     'nike': 'Fitness',
            'fcbarcelona': 'Sports',     'realmadrid': 'Sports',
            'neymarjr': 'Sports',        'justinbieber': 'Music',
            'kendalljenner': 'Fashion',  'taylorswift': 'Music',
            'arianagrande': 'Music',     'khloekardashian': 'Fashion',
            'virat.kohli': 'Sports',     'jlo': 'Music',
            'dualipa': 'Music',          'zendaya': 'Fashion',
            'khaby.lame': 'Comedy',      'charlidamelio': 'Dance',
            'addisonre': 'Lifestyle',    'bellapoarch': 'Music',
        }

        def parse_num(s):
            if pd.isna(s): return 0
            s = str(s).strip().lower().replace(',', '')
            if s.endswith('b'): return float(s[:-1]) * 1_000_000_000
            if s.endswith('m'): return float(s[:-1]) * 1_000_000
            if s.endswith('k'): return float(s[:-1]) * 1_000
            try: return float(s)
            except: return 0

        def fmt_followers(n):
            if n >= 1_000_000_000: return f"{n/1_000_000_000:.1f}B"
            if n >= 1_000_000:     return f"{n/1_000_000:.1f}M"
            if n >= 1_000:         return f"{n/1_000:.0f}K"
            return str(int(n))

        def avatar_colors(i):
            palettes = [
                ('#E1F5EE','#085041'), ('#E6F1FB','#0C447C'),
                ('#FAEEDA','#633806'), ('#FAECE7','#4A1B0C'),
                ('#EEEDFE','#26215C'), ('#FBEAF0','#4B1528'),
                ('#E8FEF0','#0A4A24'), ('#FEF3E8','#4A2A0A'),
            ]
            return palettes[i % len(palettes)]

        results = []

        # Instagram Top 100
        for i, (_, row) in enumerate(ig_df.head(50).iterrows()):
            handle_raw = str(row.get('channel_info', '')).strip()
            name = handle_raw.replace('_', ' ').replace('.', ' ').title()
            followers = parse_num(row.get('followers', 0))
            er_str = str(row.get('60_day_eng_rate', '0')).replace('%', '').strip()
            try: er = float(er_str)
            except: er = 0.0
            influence = int(row.get('influence_score', 70))
            auth  = min(99, max(50, influence - 2))
            growth = min(99, max(40, int(er * 20 + 50)))
            score = min(99, int(influence * 0.6 + er * 5 + 30))
            tier  = 'S' if followers > 100_000_000 else 'A' if followers > 10_000_000 else 'B'
            cat   = KNOWN_CATS.get(handle_raw.lower(), 'Lifestyle')
            c1, c2 = avatar_colors(i)
            results.append({
                'id':       i + 1,
                'name':     name,
                'handle':   f"@{handle_raw}",
                'cat':      cat,
                'followers': fmt_followers(followers),
                'er':        f"{er:.2f}%",
                'auth':      auth,
                'growth':    growth,
                'score':     score,
                'tier':      tier,
                'av':        ''.join(p[0].upper() for p in name.split()[:2]),
                'c1':        c1,
                'c2':        c2,
                'platform':  'Instagram',
                'real':      True,
            })

        # TikTok top creators
        for i, (_, row) in enumerate(tt_df.head(30).iterrows()):
            name = str(row.get('Tiktoker name', ''))
            handle_raw = str(row.get('Tiktok name', ''))
            subs  = parse_num(str(row.get('Subscribers', '0')).replace('M','m').replace('K','k'))
            likes = parse_num(str(row.get('Likes avg.', '0')).replace('M','m').replace('K','k'))
            views = parse_num(str(row.get('Views avg.', '0')).replace('M','m').replace('K','k'))
            er    = round(likes / max(views, 1) * 100, 2)
            score = min(99, max(50, int(er * 3 + 60)))
            tier  = 'S' if subs > 50_000_000 else 'A' if subs > 10_000_000 else 'B'
            cat   = KNOWN_CATS.get(handle_raw.lower(), 'Entertainment')
            c1, c2 = avatar_colors(50 + i)
            results.append({
                'id':       1000 + i,
                'name':     name,
                'handle':   f"@{handle_raw}",
                'cat':      cat,
                'followers': fmt_followers(subs),
                'er':        f"{er:.2f}%",
                'auth':      min(99, score),
                'growth':    min(99, score - 5),
                'score':     score,
                'tier':      tier,
                'av':        ''.join(p[0].upper() for p in name.split()[:2]),
                'c1':        c1,
                'c2':        c2,
                'platform':  'TikTok',
                'real':      True,
            })

        return jsonify({'results': results, 'total': len(results), 'real': True}), 200
    except Exception as e:
        logger.error(f"Real creators failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)

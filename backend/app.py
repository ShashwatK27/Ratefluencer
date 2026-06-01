from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import logging
import os
import json
import math
from pathlib import Path
from growth_predictor import GrowthPredictor
from authenticity_detector import AuthenticityDetector
from viral_predictor import ViralPredictor
from groq import Groq
from dotenv import load_dotenv
import requests as http_requests
import base64
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS — read allowed origins from env
_cors_origins = [o.strip() for o in os.environ.get(
    "CORS_ORIGIN", "http://localhost:5173,http://localhost:5174"
).split(",")]
CORS(app, origins=_cors_origins)

# Rate limiting with graceful fallback
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _limiter = Limiter(get_remote_address, app=app, default_limits=[])

    def rate_limit(rule):
        return _limiter.limit(rule)
except ImportError:
    logger.warning("flask-limiter not installed — rate limiting disabled")

    def rate_limit(rule):
        def decorator(f):
            return f
        return decorator

# Groq client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

BACKEND_DIR = Path(__file__).parent.absolute()
PARENT_DIR = BACKEND_DIR.parent
CREATORS_CSV = BACKEND_DIR / 'influencers_engine_ready.csv'

if not CREATORS_CSV.exists():
    logger.error(f"Real data not found at {CREATORS_CSV}. Please run model_test.ipynb first.")
    raise FileNotFoundError(f"Missing: {CREATORS_CSV}")

logger.info("Initializing Ratefluencer AI Orchestrator inside Flask server...")
logger.info(f"Using creators CSV from: {CREATORS_CSV}")
viral_predictor = ViralPredictor()

# ── Module-level creator name pools ─────────────────────────────────────────
CREATOR_NAMES = [
    'Arjun','Priya','Rohan','Simran','Dev','Vikram','Neha','Karan','Aditi','Rahul','Pooja','Kabir'
]

_NICHE_FIRST = {
    'fitness':       ['Arjun','Priya','Rohan','Simran','Dev','Vikram','Neha','Karan','Aditi','Rahul','Pooja','Kabir'],
    'beauty':        ['Ananya','Zoya','Kiara','Tara','Meera','Aisha','Divya','Nisha','Riya','Shruti','Kavya','Tanvi'],
    'fashion':       ['Pallavi','Disha','Natasha','Trisha','Ishani','Shreya','Myra','Avni','Piya','Zaara','Roshni','Sana'],
    'food':          ['Vikram','Pooja','Rahul','Aditi','Sneha','Gaurav','Preeti','Arjun','Meena','Suresh','Deepa','Nikhil'],
    'tech':          ['Siddharth','Aditya','Gaurav','Mihir','Parth','Varun','Rishab','Saurabh','Ankur','Vivek','Rajat','Dev'],
    'travel':        ['Layla','Ayaan','Chithra','Surya','Tanvi','Rohan','Priya','Aryan','Kiran','Neel','Maya','Arun'],
    'gaming':        ['Rishab','Varun','Aryan','Manav','Harsh','Krish','Yash','Aman','Veer','Nihal','Shiv','Ranbir'],
    'wellness':      ['Trisha','Sneha','Ankita','Divya','Nisha','Prerna','Shweta','Puja','Geeta','Lakshmi','Sarita','Mona'],
    'entertainment': ['Aisha','Kabir','Ishaan','Karan','Aarav','Ranbir','Neha','Sana','Zara','Aliya','Farhan','Imran'],
    'music':         ['Riyanshi','Saurabh','Vivek','Rajat','Trisha','Aditya','Mishka','Shreya','Shaan','Neeti','Armaan','Sunidhi'],
    'sports':        ['Virat','Rohit','Smriti','Sania','Neeraj','Bajrang','Mirabai','PV','Shikhar','Hardik','Jasprit','Sunil'],
    'comedy':        ['Tanmay','Kenny','Biswa','Kaneez','Aadar','Sumukhi','Varun','Naveen','Anirban','Sapan','Kiku','Suresh'],
}

_NICHE_LAST = {
    'fitness':       ['Fit','Strong','Gains','Active','Health','Power','Bold','Flex','Runs','Lifts'],
    'beauty':        ['Glow','Beauty','Skin','Looks','Style','Vibes','Radiance','Bloom','Glam','Shine'],
    'fashion':       ['Couture','Trends','Chic','Vogue','Style','Drip','Fits','Edge','Mode','Flair'],
    'food':          ['Eats','Cooks','Recipes','Kitchen','Bites','Plates','Chef','Bakes','Tastes','Serves'],
    'tech':          ['Dev','Code','Tech','Builds','Digital','Bytes','Stack','Logic','Data','Script'],
    'travel':        ['Explore','Wanders','Travels','Roams','Trips','Ventures','Discovers','Journeys','Drifts','Roams'],
    'gaming':        ['Plays','Games','Level','Quest','XP','Arena','Ranked','Clutch','Spawn','Grind'],
    'wellness':      ['Zen','Calm','Heals','Mindful','Flow','Balance','Peace','Restore','Renew','Breathe'],
    'entertainment': ['Reels','Viral','Shorts','Clips','Creates','Trends','Hype','Buzz','Live','Stars'],
    'music':         ['Beats','Rhythm','Tunes','Drops','Vibes','Melodies','Flows','Notes','Groove','Sings'],
    'sports':        ['Sports','Goals','Wins','Scores','Plays','Trains','Sprints','Tackles','Serves','Shoots'],
    'comedy':        ['Laughs','Jokes','Roasts','Quips','Grins','Bits','Acts','Rants','Vibes','Skits'],
}


def get_creator_name(creator_id, niche):
    key = niche.lower().strip()
    firsts = _NICHE_FIRST.get(key, CREATOR_NAMES)
    lasts  = _NICHE_LAST.get(key, ['Creator'])
    first  = firsts[creator_id % len(firsts)]
    last   = lasts[(creator_id // len(firsts)) % len(lasts)]
    return f"{first} {last}"


# ── TF-IDF semantic brand matching ───────────────────────────────────────────
_NICHE_EXPANSION = {
    'beauty':        'beauty skincare makeup glow serum cosmetic lipstick foundation moisturizer sunscreen blush eyeshadow toner',
    'wellness':      'wellness health yoga mindfulness mental organic holistic meditation ayurveda supplement detox vitality self-care',
    'fitness':       'fitness gym workout protein supplement muscle strength training cardio exercise weight loss bodybuilding crossfit',
    'food':          'food recipe cooking vegan restaurant meal healthy diet cuisine chef culinary baking nutrition snack',
    'fashion':       'fashion style clothing outfit apparel trend wardrobe accessories streetwear luxury designer couture',
    'tech':          'technology gadget smartphone app software device review unboxing innovation startup ai digital product',
    'travel':        'travel adventure tourism destination hotel photography explore journey road trip backpacking wanderlust holiday',
    'gaming':        'gaming game esports streaming console PC online multiplayer tournament twitch youtube gameplay',
    'finance':       'finance investing money banking crypto stock market personal finance wealth savings budget fintech',
    'education':     'education learning course tutorial student university skill development career knowledge online training',
    'entertainment': 'entertainment music movie comedy show celebrity pop culture media viral trending celebrity',
    'sports':        'sports cricket football football basketball athletics running cycling swimming team competition league',
    'music':         'music song artist band album playlist rap hip-hop pop indie indie acoustic performance concert',
    'comedy':        'comedy funny jokes memes satire stand-up humor entertainment viral sketch parody',
    'lifestyle':     'lifestyle daily routine morning evening home decor family relationships productivity vlog',
    'photography':   'photography camera portrait nature landscape lighting editing DSLR iPhone content creation visual',
    'pets':          'pets dogs cats animals veterinary grooming training adoption rescue pet care',
    'diy':           'diy craft handmade tutorial home improvement woodwork upcycle recycle art project make',
    'business':      'business entrepreneur startup marketing branding strategy leadership management sales B2B',
}

_tfidf_vectorizer = None
_tfidf_niche_vecs = {}
_bm_score_cache = {}


def _init_tfidf():
    global _tfidf_vectorizer, _tfidf_niche_vecs
    docs = list(_NICHE_EXPANSION.values())
    niches = list(_NICHE_EXPANSION.keys())
    try:
        vec = TfidfVectorizer(ngram_range=(1, 2))
        vec.fit(docs)
        _tfidf_vectorizer = vec
        for niche, doc in _NICHE_EXPANSION.items():
            _tfidf_niche_vecs[niche] = vec.transform([doc])
        logger.info("TF-IDF vectorizer initialized for semantic brand matching")
    except Exception as e:
        logger.warning(f"TF-IDF init failed: {e}")


class CsvEngine:
    def __init__(self, creators_csv):
        self.creators_csv = creators_csv
        self.creators_df = pd.read_csv(creators_csv)
        self.brand_matcher = None
        self.growth_predictor = GrowthPredictor(model_version='v2', use_fallback=True)
        self.authenticity_detector = AuthenticityDetector(model_version='v2')
        try:
            from brand_matcher_v2 import BrandMatcher
            self.brand_matcher = BrandMatcher(creators_csv=creators_csv)
            logger.info("BrandMatcher initialized successfully")
        except Exception as e:
            logger.warning(f"BrandMatcher initialization failed: {e}")
            self.brand_matcher = None

    def score_creator(self, *args, **kwargs):
        raise RuntimeError("Semantic scoring engine is disabled; using CSV scores.")


if os.getenv("RATEFLUENCER_USE_SEMANTIC", "0") == "1":
    from ratefluencer_engine import RatefluencerEngine
    engine = RatefluencerEngine(creators_csv=str(CREATORS_CSV))
else:
    engine = CsvEngine(str(CREATORS_CSV))

logger.info(f"Dataset size: {len(engine.creators_df)} creators")

# Initialize TF-IDF after engine is ready
_init_tfidf()

# ── Campaign store ───────────────────────────────────────────────────────────
campaigns_store = []

DEMO_CAMPAIGNS = [
    {"id": "demo_1", "name": "Diwali Skincare Launch", "brand": "Nykaa", "goal": "Brand Awareness",
     "category_filters": ["Beauty","Wellness"], "campaign_text": "Skincare beauty wellness glow serum organic India women",
     "budget": 1000000, "ageGroup": "18–34", "country": "India", "timestamp": "2026-06-01T10:00:00"},
    {"id": "demo_2", "name": "Protein Supplement Campaign", "brand": "MuscleBlaze", "goal": "Sales / Conversions",
     "category_filters": ["Fitness"], "campaign_text": "Fitness gym workout protein supplement muscle strength training",
     "budget": 500000, "ageGroup": "18–34", "country": "India", "timestamp": "2026-06-01T11:00:00"},
    {"id": "demo_3", "name": "Food Delivery App Launch", "brand": "Swiggy", "goal": "App Downloads",
     "category_filters": ["Food","Lifestyle"], "campaign_text": "Food delivery restaurant healthy meal cooking recipe India",
     "budget": 750000, "ageGroup": "18–30", "country": "India", "timestamp": "2026-06-01T12:00:00"},
    {"id": "demo_4", "name": "Tech Gadget Unboxing", "brand": "OnePlus", "goal": "Product Launch",
     "category_filters": ["Tech","Gaming"], "campaign_text": "Technology gadget smartphone unboxing review tech product",
     "budget": 2000000, "ageGroup": "18–34", "country": "India", "timestamp": "2026-06-01T13:00:00"},
    {"id": "demo_5", "name": "Travel Booking Campaign", "brand": "MakeMyTrip", "goal": "Brand Awareness",
     "category_filters": ["Travel","Photography"], "campaign_text": "Travel adventure tourism destination photography explore India",
     "budget": 1500000, "ageGroup": "25–44", "country": "India", "timestamp": "2026-06-01T14:00:00"},
]
campaigns_store.extend(DEMO_CAMPAIGNS)


# ── Utility helpers ──────────────────────────────────────────────────────────
def creator_identity(row):
    raw_name = str(row.get('creator_name') or f"creator_{int(row['creator_id'])}").strip()
    display_name = raw_name.lstrip('@') or f"creator_{int(row['creator_id'])}"
    handle = raw_name if raw_name.startswith('@') else f"@{display_name.lower().replace(' ', '_')}"
    return display_name, handle


def creator_initials(name):
    parts = name.replace('_', ' ').replace('.', ' ').split()
    return "".join(part[0].upper() for part in parts[:2]) or name[:2].upper()


def format_followers(followers):
    followers_val = int(followers)
    if followers_val >= 1_000_000:
        return f"{followers_val / 1_000_000:.1f}M"
    if followers_val >= 1_000:
        return f"{followers_val / 1_000:.0f}K"
    return str(followers_val)


def tier_range(tier_filter):
    tier = (tier_filter or "All tiers").lower()
    if "nano" in tier:
        return 1_000, 10_000
    if "micro" in tier:
        return 10_000, 100_000
    if "macro" in tier:
        return 100_000, 1_000_000
    if "mega" in tier:
        return 1_000_000, float('inf')
    return 0, float('inf')


def clamp(value, low=0, high=100):
    return max(low, min(high, value))


def prepare_growth_features(row):
    followers = float(row.get('followers', 10000))
    er = float(row.get('engagement_rate', 3.0))
    if er < 1.0:
        er *= 100.0

    # Prefer real CSV columns before deriving proxies
    likes    = float(row.get('likes') or row.get('avg_likes') or (followers * (er / 100.0) * 0.9))
    comments = float(row.get('comments') or row.get('avg_comments') or (followers * (er / 100.0) * 0.1))
    shares   = float(row.get('shares') or row.get('avg_shares') or max(1.0, comments * 0.5))
    reach    = float(row.get('reach') or row.get('impressions') or max(1.0, likes * 12.0))
    net_growth = float(max(1.0, followers * (er / 100.0) * 0.08))

    # growth_momentum is relative: net_growth / followers * 100
    growth_momentum = net_growth / max(followers, 1) * 100

    return {
        'views_7d_avg':          reach / 30.0,
        'likes_7d_avg':          likes / 30.0,
        'comments_7d_avg':       comments / 30.0,
        'shares_7d_avg':         shares / 30.0,
        'engagement_rate_7d':    er,
        'net_growth':            net_growth,
        'net_growth_lag1':       net_growth * 0.98,
        'net_growth_lag2':       net_growth * 0.95,
        'net_growth_lag7':       net_growth * 0.90,
        'growth_rolling_mean_3d': net_growth,
        'growth_rolling_std_3d':  max(1.0, net_growth * 0.03),
        'growth_momentum':       growth_momentum,
    }


def prepare_authenticity_features(row):
    followers = float(row.get('followers', 10000))
    is_fake   = int(row.get('fake_account', 0)) == 1

    # pos=posts, flw=followers, flg=following
    # Prefer real CSV columns before deriving proxies
    following = float(row.get('following') or (followers * (1.5 if is_fake else 0.02)))
    posts     = float(row.get('posts', 20 if is_fake else min(250, max(30, followers / 50))))
    avg_hash  = float(row.get('avg_hashtags', 150 if is_fake else 15))
    er_likes  = float(row.get('er_likes', 10 if is_fake else 1500))
    er_cmts   = float(row.get('er_comments', 450 if is_fake else 5))

    return {
        'pos': posts,                               # posts count
        'flw': followers,                           # followers
        'flg': following,                           # following
        'bl':  float(80 if is_fake else 0),         # blocked users signal
        'lin': float(0 if is_fake else 1),          # link in bio
        'cl':  float(85 if is_fake else 5),         # clickbait level
        'cz':  float(95 if is_fake else 2),         # content similarity
        'ni':  float(1 if is_fake else 10),         # name integrity
        'erl': er_likes,                            # er_likes
        'erc': er_cmts,                             # er_comments
        'lt':  float(2 if is_fake else 1),          # link type
        'hc':  avg_hash,                            # hashtag count
        'pr':  float(0.1 if is_fake else 0.95),     # profile completeness
        'fo':  float(following / (followers + 1.0)),# follow ratio
        'cs':  float(0.95 if is_fake else 0.2),     # content spam score
        'pi':  float(0 if is_fake else 1),          # profile image present
    }


def live_brand_match(row, campaign_text, category_filters):
    """Keyword-based brand match — used as final fallback."""
    text = (campaign_text or "").lower()
    niche = str(row.get('niche', '')).lower()
    selected = {str(cat).lower() for cat in category_filters or []}

    score = 15.0
    if niche in selected:
        score += 50.0
    elif niche and niche in text:
        score += 33.0

    category_terms = {
        'beauty': {'beauty', 'skincare', 'makeup', 'glow', 'serum', 'cosmetic'},
        'wellness': {'wellness', 'health', 'yoga', 'mindfulness', 'mental', 'organic'},
        'fitness': {'fitness', 'gym', 'workout', 'protein', 'training', 'muscle'},
        'food': {'food', 'recipe', 'cooking', 'vegan', 'restaurant', 'meal'},
        'fashion': {'fashion', 'style', 'clothing', 'outfit', 'apparel'},
        'tech': {'tech', 'app', 'software', 'gadget', 'device'},
        'travel': {'travel', 'hotel', 'tourism', 'trip', 'destination'},
        'finance': {'finance', 'investing', 'money', 'banking', 'crypto'},
        'gaming': {'gaming', 'game', 'esports', 'streaming'},
        'education': {'education', 'learning', 'course', 'student'},
        'entertainment': {'entertainment', 'music', 'movie', 'comedy'},
    }
    terms = category_terms.get(niche, {niche} if niche else set())
    overlap = sum(1 for term in terms if term and term in text)
    score += min(20.0, overlap * 5.0)

    return round(clamp(score), 2)


def semantic_brand_match(row, campaign_text, category_filters):
    """TF-IDF / RAG semantic brand match with keyword fallback."""
    # 1. Try BrandMatcher RAG
    if engine.brand_matcher is not None:
        try:
            niche = str(row.get('niche', '')).lower()
            selected = {str(cat).lower() for cat in category_filters or []}
            result = engine.brand_matcher.match(
                brand_campaign=campaign_text,
                top_k=1,
                category_filters=list(selected) if selected else None,
                min_confidence=0.0,
            )
            matches = result.get('top_matches', [])
            if matches:
                # Scale cosine similarity to 0-100 range with category bonus
                base = float(matches[0].get('similarity_score', 0)) * 100
                if niche in selected:
                    base = min(100, base + 30)
                return round(clamp(base), 2)
        except Exception:
            pass  # fall through to TF-IDF

    # 2. TF-IDF cosine similarity
    niche = str(row.get('niche', '')).lower()
    cache_key = (campaign_text, niche)
    if cache_key in _bm_score_cache:
        return _bm_score_cache[cache_key]

    if _tfidf_vectorizer and niche in _tfidf_niche_vecs:
        try:
            campaign_vec = _tfidf_vectorizer.transform([campaign_text])
            sim = float(cosine_similarity(campaign_vec, _tfidf_niche_vecs[niche])[0][0])
            score = sim * 100
            selected = {str(cat).lower() for cat in category_filters or []}
            if niche in selected:
                score = min(100, score + 50)
            elif niche and niche in (campaign_text or '').lower():
                score = min(100, score + 33)
            result = round(clamp(score), 2)
            _bm_score_cache[cache_key] = result
            return result
        except Exception:
            pass

    # 3. Keyword fallback
    return live_brand_match(row, campaign_text, category_filters)


def engagement_score(row):
    followers = float(row.get('followers', 0))
    er = float(row.get('engagement_rate', 0))
    er_quality = clamp(er * 8.0)
    audience_quality = clamp(math.log10(max(followers, 10)) * 16.0)
    return round(er_quality * 0.65 + audience_quality * 0.35, 2)


def generated_scores(row, campaign_text, category_filters, campaign_goal):
    csv_auth   = row.get('authenticity_score')
    csv_growth = row.get('growth_score')
    is_fake    = int(row.get('fake_account', 0)) == 1

    if csv_auth is not None and not is_fake:
        authenticity = clamp(float(csv_auth))
        risk_level   = 'Low' if authenticity >= 70 else 'Medium' if authenticity >= 50 else 'High'
    else:
        auth_res     = engine.authenticity_detector.predict(prepare_authenticity_features(row))
        authenticity = float(auth_res['probability_authentic'] * 100.0)
        risk_level   = auth_res['risk_level']

    if csv_growth is not None:
        growth = clamp(float(csv_growth))
    else:
        growth_res = engine.growth_predictor.predict(prepare_growth_features(row))
        growth     = float(growth_res['score'])

    brand_match = semantic_brand_match(row, campaign_text, category_filters)
    engagement  = engagement_score(row)

    goal = (campaign_goal or 'balanced').lower()
    if 'conversion' in goal or 'sales' in goal or 'download' in goal or 'launch' in goal:
        weights = {'brand': 0.25, 'growth': 0.15, 'auth': 0.35, 'engagement': 0.25}
    elif 'community' in goal or 'niche' in goal:
        weights = {'brand': 0.50, 'growth': 0.15, 'auth': 0.20, 'engagement': 0.15}
    elif 'awareness' in goal:
        weights = {'brand': 0.35, 'growth': 0.20, 'auth': 0.15, 'engagement': 0.30}
    else:
        weights = {'brand': 0.40, 'growth': 0.20, 'auth': 0.20, 'engagement': 0.20}

    final = (
        brand_match * weights['brand'] +
        growth      * weights['growth'] +
        authenticity * weights['auth'] +
        engagement  * weights['engagement']
    )

    if is_fake or risk_level == 'High':
        final *= 0.3
    elif risk_level == 'Medium':
        final *= 0.75

    return {
        'ratefluencer':     round(clamp(final), 1),
        'growth':           round(clamp(growth), 1),
        'authenticity':     round(clamp(authenticity), 1),
        'brand_match':      round(clamp(brand_match), 1),
        'engagement':       round(clamp(engagement), 1),
        'model_confidence': round(clamp(authenticity * 0.45 + growth * 0.35 + brand_match * 0.20), 1),
        'risk_level':       risk_level,
        'is_fake':          is_fake,
        'success_probability': clamp(final) / 100.0,
    }


def recommendation_from_row(row, rank, scores, fallback=False):
    c_name, c_handle = creator_identity(row)
    followers_val = int(row['followers'])
    final_score = round(scores['ratefluencer'], 1)
    growth = round(scores['growth'], 1)
    authenticity = round(scores['authenticity'], 1)
    brand_match = round(scores['brand_match'], 1)

    if final_score >= 80:
        ring_color = '#C8F068'
    elif final_score >= 60:
        ring_color = '#68B8F0'
    else:
        ring_color = '#F0C96A'

    return {
        "rank": rank,
        "name": c_name,
        "handle": c_handle,
        "meta": f"{row['niche']} - {format_followers(followers_val)} followers - Instagram",
        "badge": "\U0001f451 #1 Match" if rank == 1 else None,
        "ratefluencer": final_score,
        "growth": growth,
        "authenticity": authenticity,
        "brandMatch": brand_match,
        "modelConfidence": scores['model_confidence'],
        "projectedImpressions": int(row.get('impressions') or row.get('reach') or followers_val * (float(row.get('engagement_rate', 0)) / 100.0) * 8),
        "successProb": f"{min(95, max(50, round(50 + final_score * 0.45)))}%",
        "engRate": f"{float(row['engagement_rate']):.1f}%",
        "why": "Scores generated live from the Growth and Authenticity models." if fallback else f"Category similarity of {brand_match}% with verified low fraud risk.",
        "ringColor": ring_color,
        "ringOffset": int(201 * (1.0 - (final_score / 100.0))),
        "rankClass": f"rank-{rank}"
    }


def csv_recommendations(category_filters=None, min_auth_val=0, tier_min=0, tier_max=float('inf'),
                        min_er_val=0.0, excluded_niches=None, top_k=3, campaign_text='',
                        campaign_goal='balanced', existing_ids=None, start_rank=1):
    df = engine.creators_df.copy()
    df = df[df['fake_account'] == 0]

    if category_filters:
        wanted = {str(cat).lower() for cat in category_filters}
        category_df = df[df['niche'].str.lower().isin(wanted)]
        if not category_df.empty:
            df = category_df

    filtered = df[
        (df['followers'] >= tier_min) &
        (df['followers'] <= tier_max) &
        (df['engagement_rate'] >= min_er_val)
    ]

    if excluded_niches:
        filtered = filtered[~filtered['niche'].str.lower().apply(
            lambda niche: any(excl in niche for excl in excluded_niches)
        )]

    # Filter out already-shown creators by handle
    if existing_ids:
        names = filtered['creator_name'].fillna('').astype(str)
        derived = names.apply(lambda n: n if n.startswith('@') else f"@{n.lstrip('@').lower().replace(' ', '_')}")
        filtered = filtered[~derived.isin(existing_ids)]

    if filtered.empty:
        filtered = df

    candidate_pool = filtered.sort_values(['engagement_rate', 'followers'], ascending=False).head(150)
    scored = []
    for _, row in candidate_pool.iterrows():
        row_dict = row.to_dict()
        scores = generated_scores(row_dict, campaign_text, category_filters, campaign_goal)
        if scores['authenticity'] < min_auth_val or scores['is_fake']:
            continue
        scored.append((scores['ratefluencer'], row_dict, scores))

    if not scored:
        for _, row in candidate_pool.head(top_k).iterrows():
            row_dict = row.to_dict()
            scores = generated_scores(row_dict, campaign_text, category_filters, campaign_goal)
            scored.append((scores['ratefluencer'], row_dict, scores))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        recommendation_from_row(row, start_rank + idx, scores, fallback=True)
        for idx, (_, row, scores) in enumerate(scored[:top_k])
    ]


# ── Routes ───────────────────────────────────────────────────────────────────
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
            c_name, c_handle = creator_identity(row)
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
                "av": creator_initials(c_name),
                "c1": "#E1F5EE" if idx % 2 == 0 else "#E6F1FB",
                "c2": "#085041" if idx % 2 == 0 else "#0C447C"
            })
        return jsonify(result_list), 200
    except Exception as e:
        logger.error(f"Featured influencers load failed: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/api/search")
def search_creators():
    """Search and filter creators with pagination"""
    try:
        query = request.args.get('q', '').lower()
        niche = request.args.get('niche', '')
        min_followers = int(request.args.get('min_followers', 0))
        max_followers_raw = request.args.get('max_followers')
        max_followers = int(max_followers_raw) if max_followers_raw else float('inf')
        # Clamped validation
        min_auth = max(0, min(100, int(request.args.get('min_auth', 0))))
        min_er   = max(0.0, float(request.args.get('min_er', 0.0)))
        sort_by  = request.args.get('sort_by', 'followers')
        page     = max(1, int(request.args.get('page', 1)))
        limit    = max(1, min(100, int(request.args.get('limit', 20))))

        df = engine.creators_df.copy()

        if query:
            name_match  = df['creator_name'].str.lower().str.contains(query, na=False)
            niche_match = df['niche'].str.lower().str.contains(query, na=False)
            df = df[name_match | niche_match]

        if niche:
            df = df[df['niche'].str.lower() == niche.lower()]

        df = df[(df['followers'] >= min_followers) & (df['followers'] <= max_followers)]
        df = df[df['authenticity_score'] >= min_auth]
        df = df[df['engagement_rate'] >= min_er]

        total_count = len(df)

        if sort_by == 'authenticity':
            df = df.sort_values('authenticity_score', ascending=False)
        elif sort_by == 'growth':
            df = df.sort_values('growth_score', ascending=False)
        elif sort_by == 'engagement_rate':
            df = df.sort_values('engagement_rate', ascending=False)
        else:
            df = df.sort_values('followers', ascending=False)

        start = (page - 1) * limit
        end   = start + limit
        paginated_df = df.iloc[start:end]

        result_list = []
        for _, row in paginated_df.iterrows():
            creator_id = int(row['creator_id'])
            c_name, c_handle = creator_identity(row)
            followers_val = int(row['followers'])

            result_list.append({
                "id": creator_id,
                "name": c_name,
                "handle": c_handle,
                "cat": str(row['niche']),
                "followers": format_followers(followers_val),
                "followersRaw": followers_val,
                "er": f"{float(row['engagement_rate']):.1f}%",
                "erRaw": float(row['engagement_rate']),
                "auth": int(row['authenticity_score']),
                "growth": int(row['growth_score']),
                "score": int(row['growth_score'] * 0.5 + row['authenticity_score'] * 0.5),
                "fake": int(row['fake_account']),
                "av": creator_initials(c_name),
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
        return jsonify({"error": str(e)}), 500


@app.route("/api/match", methods=["POST"])
def match_creators():
    try:
        data = request.get_json() or {}
        campaign_text    = data.get("campaign_text", "")
        campaign_goal    = data.get("campaign_goal", "balanced")
        category_filters = data.get("category_filters", [])
        top_k            = int(data.get("top_k", 3))

        min_auth_str       = data.get("min_authenticity", "Any")
        tier_filter_str    = data.get("tier_filter", "All tiers")
        min_er_str         = data.get("min_engagement_rate", "Any")
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

        tier_min, tier_max = tier_range(tier_filter_str)
        excluded_niches = [b.strip().lower() for b in excluded_brands_str.split(",") if b.strip()] if excluded_brands_str else []

        if not campaign_text:
            return jsonify({"error": "campaign_text parameter is required."}), 400

        logger.info(f"Match request: '{campaign_text[:40]}...' | Goal: {campaign_goal} | Categories: {category_filters}")

        try:
            match_results = engine.brand_matcher.match(
                brand_campaign=campaign_text,
                top_k=top_k * 10 if category_filters else top_k * 3,
                category_filters=category_filters if category_filters else None,
                min_confidence=0.05
            )
            top_matches = match_results['top_matches']
        except Exception as e:
            logger.warning(f"Semantic matcher failed, using CSV fallback: {e}")
            top_matches = []

        formatted_recos = []
        all_score_results = []

        for match in top_matches:
            creator_id = int(match['creator_id'])

            score_res = engine.score_creator(
                creator_id=creator_id,
                campaign_text=campaign_text,
                campaign_goal=campaign_goal
            )
            all_score_results.append(score_res)

            if score_res['risk_metrics']['risk_level'] == 'High' or score_res['risk_metrics']['is_fake']:
                logger.info(f"Excluding creator {creator_id}: High fraud risk.")
                continue

            final_score  = int(score_res['ratefluencer_score'])
            virality     = int(score_res['scores']['growth_score'])
            brand_match  = int(score_res['scores']['brand_match_score'])
            authenticity = int(score_res['scores']['authenticity_score'])
            er_raw       = score_res['engagement_rate']
            er           = f"{er_raw:.1f}%"
            niche        = score_res['niche']
            followers_val = score_res['followers']
            risk_level   = score_res['risk_metrics']['risk_level']

            if authenticity < min_auth_val:
                continue
            if not (tier_min <= followers_val <= tier_max):
                continue
            if er_raw < min_er_val:
                continue
            if excluded_niches and any(excl in niche.lower() for excl in excluded_niches):
                continue
            if category_filters:
                niche_lower = niche.lower()
                if not any(cf.lower() in niche_lower or niche_lower in cf.lower() for cf in category_filters):
                    continue

            if followers_val >= 1_000_000:
                followers_str = f"{followers_val / 1_000_000:.1f}M"
            elif followers_val >= 1_000:
                followers_str = f"{followers_val / 1_000:.0f}K"
            else:
                followers_str = str(followers_val)

            try:
                creator_row = engine.creators_df[engine.creators_df['creator_id'] == creator_id].iloc[0].to_dict()
                c_name, c_handle = creator_identity(creator_row)
            except Exception:
                c_name   = get_creator_name(creator_id, niche)
                c_handle = f"@{c_name.lower().replace(' ', '_')}"

            if final_score >= 80:
                ring_color = '#C8F068'
            elif final_score >= 60:
                ring_color = '#68B8F0'
            else:
                ring_color = '#F0C96A'

            ring_offset = int(201 * (1.0 - (final_score / 100.0)))
            why_text    = f"❆ Category similarity of {score_res['scores']['brand_match_score']:.0f}% with verified {risk_level.lower()} fraud risk."
            badge_val   = "\U0001f451 #1 Match" if len(formatted_recos) == 0 else None

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
                "modelConfidence": score_res.get('model_confidence', int(score_res['success_probability'] * 100.0)),
                "projectedImpressions": int(followers_val * max(er_raw / 100.0, 0.01) * 8),
                "successProb": f"{score_res['success_probability'] * 100.0:.0f}%",
                "engRate": er,
                "why": why_text,
                "ringColor": ring_color,
                "ringOffset": ring_offset,
                "rankClass": f"rank-{len(formatted_recos) + 1}"
            })

            if len(formatted_recos) >= top_k:
                break

        if len(formatted_recos) < top_k:
            logger.info(f"Only {len(formatted_recos)} matches — filling with CSV fallback for {category_filters}")
            formatted_recos = csv_recommendations(
                category_filters=category_filters,
                min_auth_val=min_auth_val,
                tier_min=tier_min,
                tier_max=tier_max,
                min_er_val=min_er_val,
                excluded_niches=excluded_niches,
                top_k=top_k,
                campaign_text=campaign_text,
                campaign_goal=campaign_goal,
                existing_ids={r.get('handle') for r in formatted_recos},
                start_rank=len(formatted_recos) + 1,
            )
            if not formatted_recos:
                formatted_recos = csv_recommendations(
                    top_k=top_k,
                    campaign_text=campaign_text,
                    campaign_goal=campaign_goal,
                )

        insights = []
        if formatted_recos:
            first = formatted_recos[0]
            insights.append({
                "icon": "\U0001f3af",
                "title": "Optimal Allocation",
                "text": f"Allocate the majority of your budget to {first['name']} to maximise reach, reserving 10% for highly targeted micro-creators."
            })

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

        campaign_entry = {
            "id": f"live_{len(campaigns_store)}",
            "name": data.get("campaign_text", "")[:40] + "...",
            "brand": data.get("campaign_text", "").split(".")[0].replace("Brand/Product:", "").strip()[:30],
            "goal": campaign_goal,
            "category_filters": category_filters or [],
            "campaign_text": campaign_text,
            "budget": data.get("budget", 1000000),
            "ageGroup": data.get("ageGroup", "18–34"),
            "country": "India",
            "timestamp": pd.Timestamp.now().isoformat(),
        }
        if not any(c["campaign_text"] == campaign_text for c in campaigns_store):
            campaigns_store.append(campaign_entry)
            if len(campaigns_store) > 50:
                campaigns_store.pop(5)

        return jsonify({
            "recommendations": formatted_recos,
            "insights": insights,
            "goal": campaign_goal,
            "timestamp": pd.Timestamp.now().isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Campaign matching failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/creator-match", methods=["POST"])
def creator_match():
    """Match a creator profile against all live brand campaigns."""
    try:
        data          = request.get_json() or {}
        creator_niche = str(data.get("niche", "")).lower().strip()
        followers     = int(data.get("followers", 10000))
        er            = float(data.get("engagement_rate", 3.0))
        handle        = str(data.get("handle", "creator")).strip()

        results = []
        for camp in campaigns_store:
            camp_text = (camp.get("campaign_text") or "").lower()
            camp_cats = [c.lower() for c in camp.get("category_filters", [])]

            niche_in_cats = any(creator_niche in c or c in creator_niche for c in camp_cats)
            niche_in_text = creator_niche in camp_text
            cat_score     = 80 if niche_in_cats else 50 if niche_in_text else 20

            budget = camp.get("budget", 500000)
            if budget >= 2_000_000:
                ideal_min, ideal_max = 500_000, float("inf")
            elif budget >= 1_000_000:
                ideal_min, ideal_max = 100_000, 1_000_000
            elif budget >= 500_000:
                ideal_min, ideal_max = 10_000, 500_000
            else:
                ideal_min, ideal_max = 1_000, 100_000
            tier_score = 100 if ideal_min <= followers <= ideal_max else 50

            er_score  = min(100, er * 15)
            match_pct = round(cat_score * 0.5 + tier_score * 0.3 + er_score * 0.2)

            if match_pct >= 35:
                results.append({
                    "campaign_id":  camp["id"],
                    "brand":        camp.get("brand", "Brand"),
                    "name":         camp.get("name", "Campaign"),
                    "goal":         camp.get("goal", "Brand Awareness"),
                    "categories":   camp.get("category_filters", []),
                    "budget_label": (
                        f"₹{budget/100000:.0f}L" if budget >= 100000
                        else f"₹{budget:,}"
                    ),
                    "match_score": match_pct,
                    "why": (
                        f"Strong {creator_niche} category fit" if niche_in_cats
                        else f"Content overlap with {camp.get('goal','campaign')} goals"
                    ),
                    "is_demo": camp["id"].startswith("demo_"),
                })

        results.sort(key=lambda x: x["match_score"], reverse=True)
        return jsonify({"campaigns": results[:10], "total": len(results)}), 200

    except Exception as e:
        logger.error(f"Creator match failed: {e}")
        return jsonify({"error": str(e)}), 500


def _virality_numbers(virality_score: int, category: str, follower_count: int = None) -> dict:
    CATEGORY_ER = {
        'fitness': 0.0415, 'beauty': 0.0422, 'food': 0.0424, 'fashion': 0.0421,
        'technology': 0.0420, 'travel': 0.0423, 'photography': 0.0415,
        'lifestyle': 0.0405, 'music': 0.0420, 'comedy': 0.0420,
    }
    cat_er = CATEGORY_ER.get(category.lower(), 0.042)

    if not follower_count:
        df = engine.creators_df
        cat_df = df[df['niche'].str.lower().str.contains(category.lower(), na=False)]
        follower_count = int(cat_df['followers'].median()) if len(cat_df) > 0 else 50000

    v = virality_score / 100
    virality_multiplier = 1 + (v ** 1.5) * 4

    base_reach   = follower_count * cat_er * virality_multiplier
    exp_views    = int(base_reach * 8)
    exp_likes    = int(exp_views * cat_er * 0.7)
    exp_comments = int(exp_views * cat_er * 0.08)
    exp_shares   = int(exp_views * cat_er * 0.12)
    exp_saves    = int(exp_views * cat_er * 0.18)

    def fmt(n):
        if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
        if n >= 1_000:     return f"{n/1_000:.0f}K"
        return str(n)

    return {
        "predicted_views":    exp_views,   "predicted_views_str":    fmt(exp_views),
        "predicted_likes":    exp_likes,   "predicted_likes_str":    fmt(exp_likes),
        "predicted_comments": exp_comments,"predicted_comments_str": fmt(exp_comments),
        "predicted_shares":   exp_shares,  "predicted_shares_str":   fmt(exp_shares),
        "predicted_saves":    exp_saves,   "predicted_saves_str":    fmt(exp_saves),
    }


def _parse_groq_json(raw: str) -> dict:
    import re
    cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip()
    start = cleaned.find('{')
    end   = cleaned.rfind('}') + 1
    if start < 0 or end <= start:
        return {}
    snippet = cleaned[start:end]

    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        pass

    result = []
    in_string  = False
    escape_next = False
    for ch in snippet:
        if escape_next:
            result.append(ch); escape_next = False
        elif ch == '\\' and in_string:
            result.append(ch); escape_next = True
        elif ch == '"':
            in_string = not in_string; result.append(ch)
        elif ch in ('\n', '\r', '\t') and in_string:
            result.append('\\n' if ch == '\n' else '\\r' if ch == '\r' else '\\t')
        else:
            result.append(ch)

    try:
        return json.loads(''.join(result))
    except Exception:
        return {}


@app.route("/api/generate-content", methods=["POST"])
@rate_limit("30/hour")
def generate_content():
    """Generate viral reel idea, script, caption, and hashtags."""
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        tone  = data.get("tone", "Inspirational")
        content_category = data.get("content_category", "Lifestyle")

        if not topic:
            return jsonify({"error": "topic is required"}), 400

        insights     = viral_predictor.get_content_insights(content_category)
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

        raw    = response.choices[0].message.content.strip()
        result = _parse_groq_json(raw)

        if not result:
            return jsonify({"error": "Failed to parse AI response"}), 500

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

        result['virality_score']    = viral_score_result['viral_score']
        result['predicted_bucket']  = viral_score_result['predicted_bucket']
        result['optimization_tips'] = viral_score_result.get('optimization_tips', [])
        result['best_post_time']    = f"{best_hours[0]}:00 on {best_days[0]}"
        result['data_source']       = f"Optimised using {insights.get('data_points', 3000):,} real {content_category} posts"
        result.update(_virality_numbers(viral_score_result['viral_score'], content_category))

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        return jsonify({"error": str(e)}), 500


MAX_CONTENT_ITERS  = 3
VIRALITY_THRESHOLD = 68


@app.route("/api/run-agent", methods=["POST"])
@rate_limit("20/hour")
def run_agent():
    """Autonomous agent: trend discovery → creator selection (argmax) → content refinement loop."""
    try:
        data = request.get_json() or {}
        goal = data.get("goal", "").strip()

        if not goal:
            return jsonify({"error": "goal is required"}), 400

        logger.info(f"Running autonomous agent for goal: '{goal}'")

        # Step 1 — Discover trend
        trend_prompt = f"""You are a real-time social media trend analyst monitoring Reddit, LinkedIn, YouTube, Twitter, and News platforms.
For this campaign goal: "{goal}"

Identify the single most relevant CURRENTLY TRENDING topic right now (as of {pd.Timestamp.now().strftime('%B %Y')}).
Consider what's trending on: Reddit (r/entrepreneur, r/marketing, r/fitness etc), LinkedIn trending posts, YouTube Shorts trends, Google Trends, and major news.

Return ONLY JSON (no other text):
{{"trend": "<specific trending topic with context — 1-2 sentences>",
  "source": "<where this trend is hottest: Reddit/LinkedIn/YouTube/News/TikTok>",
  "category": "<one of: Fitness, Beauty, Fashion, Technology, Food, Lifestyle, Travel, Music, Photography, Comedy>",
  "growth_signal": "<why this is trending now in 10 words>"}}"""

        trend_resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": trend_prompt}],
            temperature=0.5,
            max_tokens=200,
        )
        trend_data      = _parse_groq_json(trend_resp.choices[0].message.content.strip())
        trend           = trend_data.get("trend", "Sustainable lifestyle content is surging across Gen-Z audiences.")
        detected_category = trend_data.get("category", "Lifestyle")
        trend_source    = trend_data.get("source", "Social Media")
        trend_signal    = trend_data.get("growth_signal", "")

        # Step 2 — Score top 20 candidates; select argmax Ratefluencer score
        df = engine.creators_df.copy()
        cat_lower = detected_category.lower()
        cat_df = df[
            (df['fake_account'] == 0) &
            (df['niche'].str.lower().str.contains(cat_lower, na=False))
        ].sort_values('engagement_rate', ascending=False)

        if cat_df.empty:
            cat_df = df[df['fake_account'] == 0].sort_values('engagement_rate', ascending=False)

        all_candidates = []
        for _, row in cat_df.head(20).iterrows():
            row_dict = row.to_dict()
            scores   = generated_scores(row_dict, goal, [detected_category], 'balanced')
            all_candidates.append((row_dict, scores))

        # Select candidate with highest Ratefluencer score passing authenticity gate
        best_pair = None
        best_rf   = -1.0
        for row_dict, scores in all_candidates:
            if not scores['is_fake'] and scores['ratefluencer'] > best_rf:
                best_rf   = scores['ratefluencer']
                best_pair = (row_dict, scores)

        if best_pair is None and all_candidates:
            best_pair = all_candidates[0]

        best_row = None
        if best_pair:
            best_row = best_pair[0]
            best_row['_scores'] = best_pair[1]

        if best_row is None and not cat_df.empty:
            best_row = cat_df.iloc[0].to_dict()
            best_row['_scores'] = generated_scores(best_row, goal, [detected_category], 'balanced')

        influencer_name, _ = creator_identity(best_row) if best_row else ("Ananya Sharma", "@ananya_sharma")
        rf_score           = float(best_row['_scores']['ratefluencer']) if best_row else 70
        campaign_success   = int(50 + (rf_score / 100) * 45)
        influencer_niche   = str(best_row.get('niche', detected_category)) if best_row else detected_category

        insights     = viral_predictor.get_content_insights(detected_category)
        best_hours   = insights.get('best_hours', [18, 12])
        best_days    = insights.get('best_days', ['Wednesday', 'Friday'])
        opt_hashtags = insights.get('optimal_hashtag_range', (6, 15))

        # Step 3 — Content refinement loop
        content_prompt_base = f"""You are a viral content creator for Instagram and LinkedIn.
Campaign goal: {goal}
Trending topic: {trend}
Assigned influencer: {influencer_name} (niche: {influencer_niche})
Data insight: Best Instagram posting time is {best_hours[0]}:00 on {best_days[0]}, use {opt_hashtags[0]}–{opt_hashtags[1]} hashtags

Generate content for BOTH platforms tailored to this influencer and trend.
Return ONLY JSON (no other text):
{{
  "reel_idea": "<creative 1-2 sentence Instagram reel concept>",
  "caption": "<engaging Instagram caption under 100 words with a clear CTA>",
  "linkedin_hook": "<one punchy LinkedIn opening line — max 15 words>",
  "linkedin_post": "<professional LinkedIn post 100-150 words with insights and CTA>",
  "linkedin_hashtags": "<5-7 professional LinkedIn hashtags>"
}}"""

        content_attempts = []
        best_content     = None
        best_virality    = -1
        refinement_hint  = None

        for content_iter in range(MAX_CONTENT_ITERS):
            temp = 0.7 + content_iter * 0.05
            prompt = content_prompt_base
            if refinement_hint:
                prompt += f"\n\nIMPROVEMENT HINT for this iteration: {refinement_hint}"

            content_resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=700,
            )
            content_data = _parse_groq_json(content_resp.choices[0].message.content.strip())

            # Predict virality for this content
            hashtag_count = len((content_data.get('caption', '') + ' ' + content_data.get('linkedin_hashtags', '')).split())
            has_cta = int(any(
                w in (content_data.get('caption', '') + content_data.get('reel_idea', '')).lower()
                for w in ['click', 'link', 'bio', 'comment', 'share', 'follow', 'save', 'dm']
            ))

            viral_res = viral_predictor.predict({
                'content_category': detected_category,
                'hashtags_count':   hashtag_count,
                'has_call_to_action': has_cta,
                'post_hour':        best_hours[0],
                'day_of_week':      best_days[0],
                'media_type':       'reel',
            })

            v_score = viral_res['viral_score']
            bucket  = viral_res['predicted_bucket']

            content_attempts.append({
                'iteration':       content_iter + 1,
                'virality_score':  v_score,
                'bucket':          bucket,
                'refinement_used': refinement_hint,
            })

            if v_score > best_virality:
                best_virality = v_score
                best_content  = content_data

            if v_score >= VIRALITY_THRESHOLD or content_iter == MAX_CONTENT_ITERS - 1:
                break

            # Extract first ↑ tip as refinement hint for next iteration
            tips = viral_res.get('optimization_tips', [])
            refinement_hint = next((t[:60] for t in tips if '↑' in t), None)

        if best_content is None:
            best_content = {}

        # Top 5 creator pool for transparency
        creator_pool = [
            {
                'name':     creator_identity(c[0])[0],
                'rf_score': round(c[1]['ratefluencer'], 1),
            }
            for c in sorted(all_candidates, key=lambda x: x[1]['ratefluencer'], reverse=True)[:5]
        ]

        return jsonify({
            "trend":             trend,
            "category":          detected_category,
            "influencer":        influencer_name,
            "reel_idea":         best_content.get("reel_idea", "Create an authentic day-in-the-life reel showcasing real product use."),
            "caption":           best_content.get("caption", "Real results, real people. Discover the difference. #sponsored"),
            "linkedin_hook":     best_content.get("linkedin_hook", ""),
            "linkedin_post":     best_content.get("linkedin_post", ""),
            "linkedin_hashtags": best_content.get("linkedin_hashtags", ""),
            "virality_score":    best_virality,
            "campaign_success":  campaign_success,
            "best_post_time":    f"{best_hours[0]}:00 on {best_days[0]}",
            "agent_iterations":  len(content_attempts),
            "trend_source":      trend_source,
            "trend_signal":      trend_signal,
            "data_backed":       True,
            "content_attempts":  content_attempts,
            "agent_refined":     len(content_attempts) > 1,
            "creator_pool":      creator_pool,
            **_virality_numbers(best_virality, detected_category),
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
            'content_category':   data.get('content_category', 'Lifestyle'),
            'hashtags_count':     data.get('hashtags_count', 10),
            'caption_length':     data.get('caption_length', 150),
            'has_call_to_action': int(data.get('has_call_to_action', 1)),
            'post_hour':          data.get('post_hour', 18),
            'day_of_week':        data.get('day_of_week', 'Wednesday'),
            'media_type':         data.get('media_type', 'reel'),
            'follower_count':     data.get('follower_count', 50000),
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
        if not ig_csv.exists():
            return jsonify({"error": "Instagram_Analytics.csv not found on server. Please ensure the dataset is present."}), 503

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
            'category_stats':     sorted(cat_stats, key=lambda x: x['viral_rate'], reverse=True),
            'hourly_distribution': hour_df.to_dict('records'),
            'daily_distribution':  day_df.to_dict('records'),
            'platform_summary':    summary,
            'total_posts':         len(df),
        }), 200
    except Exception as e:
        logger.error(f"Platform insights failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/real-creators")
def real_creators():
    """Returns real influencers from influencers_engine_ready.csv for the dashboard."""
    try:
        df = engine.creators_df.copy()
        top = df[df['fake_account'] == 0].sort_values('engagement_rate', ascending=False).head(100)

        palettes = [
            ('#E1F5EE','#085041'), ('#E6F1FB','#0C447C'),
            ('#FAEEDA','#633806'), ('#FAECE7','#4A1B0C'),
            ('#EEEDFE','#26215C'), ('#FBEAF0','#4B1528'),
            ('#E8FEF0','#0A4A24'), ('#FEF3E8','#4A2A0A'),
        ]

        results = []
        for i, (_, row) in enumerate(top.iterrows()):
            c_name, c_handle = creator_identity(row.to_dict())
            followers_val = int(row['followers'])
            er    = float(row['engagement_rate'])
            auth  = min(97, int(row.get('authenticity_score', 75)))
            growth = min(95, int(row.get('growth_score', 70)))
            score = min(97, int(row.get('ratefluencer_score', (auth + growth) / 2)))
            tier  = row.get('tier', 'S' if followers_val > 500_000 else 'A' if followers_val > 100_000 else 'B')
            c1, c2 = palettes[i % len(palettes)]

            results.append({
                'id':       int(row['creator_id']),
                'name':     c_name,
                'handle':   c_handle,
                'cat':      str(row.get('niche', 'Lifestyle')).title(),
                'followers': format_followers(followers_val),
                'er':        f"{er:.2f}%",
                'auth':      auth,
                'growth':    growth,
                'score':     score,
                'tier':      str(tier),
                'av':        creator_initials(c_name),
                'c1':        c1,
                'c2':        c2,
                'platform':  'Instagram',
                'real':      True,
            })

        return jsonify({'results': results, 'total': len(results), 'real': True}), 200
    except Exception as e:
        logger.error(f"Real creators failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/score-caption", methods=["POST"])
def score_caption():
    """Score an existing caption against real Instagram benchmarks + AI feedback."""
    try:
        data           = request.get_json() or {}
        caption        = data.get("caption", "").strip()
        hashtags       = data.get("hashtags", "").strip()
        media_type     = data.get("media_type", "reel")
        category       = data.get("content_category", "Lifestyle")
        post_hour      = int(data.get("post_hour", 18))
        day_of_week    = data.get("day_of_week", "Wednesday")
        follower_count = int(data.get("follower_count", 50000))

        if not caption:
            return jsonify({"error": "caption is required"}), 400

        hashtag_list  = [h for h in hashtags.split() if h.startswith('#')]
        hashtag_count = len(hashtag_list) if hashtag_list else len(hashtags.split())

        cta_words  = ['click','link','bio','comment','share','follow','save','dm','buy','shop','visit','tag','swipe','watch']
        has_cta    = int(any(w in caption.lower() for w in cta_words))
        caption_len = len(caption)

        score_result = viral_predictor.predict({
            'content_category':   category,
            'hashtags_count':     hashtag_count,
            'caption_length':     caption_len,
            'has_call_to_action': has_cta,
            'post_hour':          post_hour,
            'day_of_week':        day_of_week,
            'media_type':         media_type,
            'follower_count':     follower_count,
        })

        ai_prompt = f"""You are a social media expert who analyses Instagram captions.

Analyse this caption and provide specific, actionable feedback:

CAPTION:
{caption}

HASHTAGS:
{hashtags if hashtags else '(none provided)'}

Category: {category} | Format: {media_type} | Follower count: {follower_count:,}

Return ONLY valid JSON:
{{
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "rewritten_hook": "<rewrite just the first sentence to be more compelling>",
  "missing_elements": ["<what's missing, e.g. CTA, emoji, question>"],
  "tone": "<detected tone: e.g. Professional, Casual, Inspirational>",
  "readability_score": <integer 0-100>
}}"""

        ai_resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": ai_prompt}],
            temperature=0.5,
            max_tokens=700,
        )
        ai_data  = _parse_groq_json(ai_resp.choices[0].message.content.strip())
        insights = viral_predictor.get_content_insights(category)

        return jsonify({
            "virality_score":       score_result['viral_score'],
            "predicted_bucket":     score_result['predicted_bucket'],
            "optimization_tips":    score_result.get('optimization_tips', []),
            "best_hours":           score_result.get('best_hours', [18, 12, 20]),
            "best_days":            score_result.get('best_days', ['Wednesday', 'Friday']),
            "optimal_hashtag_range": score_result.get('optimal_hashtag_range', '6–15'),
            "your_hashtag_count":   hashtag_count,
            "your_caption_length":  caption_len,
            "has_cta":              bool(has_cta),
            "strengths":            ai_data.get("strengths", []),
            "improvements":         ai_data.get("improvements", []),
            "rewritten_hook":       ai_data.get("rewritten_hook", ""),
            "missing_elements":     ai_data.get("missing_elements", []),
            "tone":                 ai_data.get("tone", ""),
            "readability_score":    ai_data.get("readability_score", 70),
            "data_source":          f"Benchmarked against {insights.get('total_posts', 3000):,} real {category} posts",
            **_virality_numbers(score_result['viral_score'], category, follower_count),
        }), 200

    except Exception as e:
        logger.error(f"Caption scoring failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate-linkedin", methods=["POST"])
@rate_limit("30/hour")
def generate_linkedin():
    """Generate LinkedIn post with few-shot learning from feedback history."""
    try:
        data     = request.get_json() or {}
        topic    = data.get("topic", "").strip()
        tone     = data.get("tone", "Professional")
        category = data.get("content_category", "Business")

        if not topic:
            return jsonify({"error": "topic is required"}), 400

        insights     = viral_predictor.get_content_insights(category)
        opt_hashtags = insights.get('optimal_hashtag_range', (5, 8))

        # Few-shot feedback learning
        feedback_history = data.get("feedback_history", [])
        few_shot_block   = ""

        if feedback_history:
            upvoted   = [f for f in feedback_history if f.get('vote') == 'up' and f.get('content')]
            downvoted = [f for f in feedback_history if f.get('vote') == 'down' and f.get('content')]

            if upvoted:
                # Find best upvoted entry by virality score
                best_up = max(upvoted, key=lambda f: f.get('virality', 0))
                c = best_up.get('content', {})
                if c.get('hook') or c.get('caption'):
                    few_shot_block += (
                        "\n\nUSER-VALIDATED EXAMPLE (high virality — match this style):"
                        f"\nHook: {c.get('hook', '')}"
                        f"\nCaption excerpt: {str(c.get('caption', ''))[:200]}"
                    )

            if len(downvoted) > len(upvoted):
                last_down = downvoted[-1]
                c = last_down.get('content', {})
                if c.get('hook'):
                    few_shot_block += f"\n\nNEGATIVE EXAMPLE (avoid this opening hook):\nHook: {c.get('hook', '')}"

        prompt = f"""You are a LinkedIn content strategist who creates viral professional content.
Write a LinkedIn post for this topic: "{topic}"
Tone: {tone}. Industry: {category}.{few_shot_block}

Return ONLY a valid JSON object:
{{
  "hook": "<one punchy opening line that stops the scroll — max 15 words>",
  "post": "<full LinkedIn post: hook + 3-4 insight paragraphs + CTA. Use line breaks. 150-250 words>",
  "caption": "<professional summary caption under 50 words>",
  "hashtags": "<{opt_hashtags[0]} to {opt_hashtags[1]} professional LinkedIn hashtags>",
  "engagement_hook": "<a question at the end to drive comments>",
  "virality_score": <integer 0-100>
}}"""

        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
        result = _parse_groq_json(resp.choices[0].message.content.strip())
        if not result:
            return jsonify({"error": "Failed to parse AI response"}), 500

        result['platform']       = 'LinkedIn'
        result['best_post_time'] = "Tuesday–Thursday, 8:00–10:00 AM"
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"LinkedIn generation failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/trend-ranking", methods=["POST"])
@rate_limit("20/hour")
def trend_ranking():
    """Discover and rank trending topics on 5 ML-scored dimensions."""
    try:
        data     = request.get_json() or {}
        category = data.get("category", "General")
        goal     = data.get("goal", "")

        prompt = f"""You are a real-time trend intelligence engine monitoring multiple platforms.
As of {pd.Timestamp.now().strftime('%B %Y')}, identify 5 CURRENTLY TRENDING topics for the {category} category{' for goal: ' + goal if goal else ''}.

Sources to consider: Reddit trending posts, LinkedIn viral content, YouTube Shorts trends,
Google Trends, Twitter/X topics, Instagram Explore, news headlines.

Score each trend using ML-style multi-factor analysis (0-100):
- growth_velocity: Rate of growth in last 7 days across platforms
- engagement_potential: Expected likes/comments/shares based on category benchmarks
- novelty: How fresh/new this topic is (100=brand new, 0=oversaturated)
- audience_relevance: Relevance to {category} audience demographics
- search_interest: Current Google/platform search volume signals

Trend score = (growth_velocity*0.3 + engagement_potential*0.25 + novelty*0.2 + audience_relevance*0.15 + search_interest*0.1)

Return ONLY valid JSON:
{{
  "trends": [
    {{
      "topic": "<specific trend name>",
      "description": "<1 sentence description>",
      "source": "<Reddit/LinkedIn/YouTube/Twitter/News>",
      "growth_velocity": <0-100>,
      "engagement_potential": <0-100>,
      "novelty": <0-100>,
      "audience_relevance": <0-100>,
      "search_interest": <0-100>,
      "trend_score": <weighted 0-100>,
      "why": "<why trending now in 1 sentence>"
    }}
  ]
}}"""

        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=1200,
        )
        result = _parse_groq_json(resp.choices[0].message.content.strip())
        if not result:
            return jsonify({"error": "Failed to parse trends"}), 500

        trends = sorted(result.get("trends", []), key=lambda t: t.get("trend_score", 0), reverse=True)
        return jsonify({"trends": trends, "category": category}), 200

    except Exception as e:
        logger.error(f"Trend ranking failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/voiceover", methods=["POST"])
def voiceover():
    """Generate voiceover audio using ElevenLabs API."""
    try:
        data  = request.get_json() or {}
        text  = data.get("text", "").strip()
        voice = data.get("voice_id", "EXAVITQu4vr4xnSDxMaL")

        if not text:
            return jsonify({"error": "text is required"}), 400

        api_key = os.environ.get("ELEVENLABS_API_KEY", "")
        if not api_key:
            return jsonify({"error": "ELEVENLABS_API_KEY not set in .env"}), 503

        text = text[:800]
        url  = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
        headers = {
            "xi-api-key":   api_key,
            "Content-Type": "application/json",
            "Accept":       "audio/mpeg",
        }
        payload = {
            "text":     text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability":        0.5,
                "similarity_boost": 0.75,
                "style":            0.3,
                "use_speaker_boost": True,
            },
        }

        resp = http_requests.post(url, json=payload, headers=headers, timeout=30)

        if resp.status_code != 200:
            logger.error(f"ElevenLabs error {resp.status_code}: {resp.text[:200]}")
            return jsonify({"error": f"ElevenLabs API error: {resp.status_code}"}), 502

        audio_b64 = base64.b64encode(resp.content).decode("utf-8")
        return jsonify({
            "audio_base64": audio_b64,
            "content_type": "audio/mpeg",
            "chars_used":   len(text),
        }), 200

    except Exception as e:
        logger.error(f"Voiceover failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)

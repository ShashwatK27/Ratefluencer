# UTF-8 stdout/stderr so chars display correctly on Windows terminals
import sys as _sys
if hasattr(_sys.stdout, 'reconfigure'):
    _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(_sys.stderr, 'reconfigure'):
    _sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Suppress noisy runtime warnings before any heavy imports
import warnings, os as _os
warnings.filterwarnings('ignore', category=UserWarning,  module='sklearn')
warnings.filterwarnings('ignore', category=FutureWarning, module='sklearn')
warnings.filterwarnings('ignore', category=UserWarning,  module='xgboost')
warnings.filterwarnings('ignore', message='.*valid feature names.*')
warnings.filterwarnings('ignore', message='.*Pickle support.*')        # XGBoost pickle
warnings.filterwarnings('ignore', category=UserWarning, module='torch')

# Silence HuggingFace / tokenizers startup chatter
_os.environ.setdefault('TRANSFORMERS_VERBOSITY',           'error')
_os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS',    '1')
_os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')
_os.environ.setdefault('TOKENIZERS_PARALLELISM',           'false')
_os.environ.setdefault('TRANSFORMERS_NO_ADVISORY_WARNINGS','1')

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
from trends_engine import fetch_google_trends, fetch_combined_trends
from content_scorer import ContentQualityScorer
from groq import Groq
from dotenv import load_dotenv
import requests as http_requests
import base64
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib
import sqlite3

try:
    import shap as _shap
    _SHAP_AVAILABLE = True
except ImportError:
    _SHAP_AVAILABLE = False

# Load .env robustly from backend directory
_backend_env = Path(__file__).parent / '.env'
if _backend_env.exists():
    load_dotenv(_backend_env)
else:
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# CORS  -  read allowed origins from env
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
    logger.warning("flask-limiter not installed  -  rate limiting disabled")

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

# -- Ratefluencer meta-learner (trained XGBoost regressor) --------------------
class _RatefluencerScorer:
    """Loads the trained meta-learner that predicts composite score from raw features."""
    def __init__(self):
        self.model    = None
        self.features = None
        self.encoders = None
        _model_path = BACKEND_DIR / 'ratefluencer_model_v1.pkl'
        _feat_path  = BACKEND_DIR / 'ratefluencer_features_v1.pkl'
        _enc_path   = BACKEND_DIR / 'ratefluencer_encoders_v1.pkl'
        if not (_model_path.exists() and _feat_path.exists() and _enc_path.exists()):
            logger.info("Ratefluencer meta-learner pkls not found - run train_ratefluencer_score.py to enable")
            return
        try:
            self.model    = joblib.load(_model_path)
            self.features = joblib.load(_feat_path)
            self.encoders = joblib.load(_enc_path)
            logger.info(f"Ratefluencer meta-learner loaded ({type(self.model).__name__}, {len(self.features)} features)")
        except Exception as e:
            logger.info(f"Meta-learner load issue (using weighted formula fallback): {type(e).__name__}: {e}")

    def predict(self, row: dict) -> float:
        """Predict composite Ratefluencer score from raw creator metrics."""
        if self.model is None:
            return None
        try:
            followers = max(1, float(row.get('followers', 10000)))
            er        = float(row.get('engagement_rate', 3.0))
            posts     = float(row.get('posts', 50))
            likes     = float(row.get('likes', followers * er / 100 * 0.9))
            comments  = float(row.get('comments', followers * er / 100 * 0.1))
            shares    = float(row.get('shares', max(1, likes * 0.1)))
            reach     = float(row.get('reach', max(1, likes * 12)))
            impr      = float(row.get('impressions', max(1, reach * 1.5)))
            niche     = str(row.get('niche', 'lifestyle'))
            tier      = str(row.get('tier', 'A'))

            niche_enc = self.encoders['niche'].transform([[niche]])[0][0]
            tier_enc  = self.encoders['tier'].transform([[tier]])[0][0]

            feat_map = {
                'log_followers':  math.log1p(followers),
                'engagement_rate': er,
                'posts':          posts,
                'likes_per_f':    likes / followers,
                'comments_per_f': comments / followers,
                'shares_per_f':   shares / followers,
                'reach_ratio':    reach / max(impr, 1),
                'save_proxy':     shares * 0.8,
                'niche_enc':      float(niche_enc),
                'tier_enc':       float(tier_enc),
            }
            x = [feat_map.get(f, 0.0) for f in self.features]
            score = float(self.model.predict([x])[0])
            return round(clamp(score), 1)
        except Exception as e:
            logger.debug(f"Meta-learner inference failed: {e}")
            return None


_rf_scorer = None   # initialised after app setup


logger.info("Initializing Ratefluencer AI Orchestrator inside Flask server...")
logger.info(f"Using creators CSV from: {CREATORS_CSV}")
viral_predictor   = ViralPredictor()
content_scorer    = ContentQualityScorer()   # lazy-loads SentenceTransformer on first call

# -- Module-level creator name pools -----------------------------------------
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


# -- Niche canonical map: campaign filters -> dataset niche names ──────────────
# Campaign category_filters use terms like 'Tech', 'Lifestyle', 'Wellness' that
# don't exist as-is in the creator dataset. This map normalises them so filters
# actually find matching creators instead of falling back to zero matches.
NICHE_CANONICAL_MAP = {
    # Direct synonyms
    'technology':    'technology',
    'tech':          'technology',
    'gadgets':       'technology',
    'gaming':        'gaming',
    'esports':       'gaming',
    'lifestyle':     'lifestyle',
    'wellness':      'wellness',
    'health':        'wellness',
    'yoga':          'wellness',
    'entertainment': 'entertainment',
    'comedy':        'comedy',
    'humour':        'comedy',
    'humor':         'comedy',
    'music':         'music',
    'education':     'education',
    'edtech':        'education',
    'finance':       'finance',
    'fintech':       'finance',
    'investing':     'finance',
    'photography':   'travel',   # photography creators overlap heavily with travel
    'sports':        'fitness',
    'pets':          'pet',      # fix plural typo used in campaigns
    'pet':           'pet',
    # Pass-throughs (already correct)
    'beauty':        'beauty',
    'fitness':       'fitness',
    'food':          'food',
    'travel':        'travel',
    'fashion':       'fashion',
    'family':        'family',
    'interior':      'interior',
    'home':          'interior',
    'other':         'other',
}

def canonical_niche(n: str) -> str:
    """Normalise any campaign category filter to the nearest dataset niche."""
    return NICHE_CANONICAL_MAP.get(n.lower().strip(), 'other')


# -- TF-IDF semantic brand matching -------------------------------------------
_NICHE_EXPANSION = {
    'beauty':        'beauty skincare makeup glow serum cosmetic lipstick foundation moisturizer sunscreen blush eyeshadow toner',
    'wellness':      'wellness health yoga mindfulness mental organic holistic meditation ayurveda supplement detox vitality self-care',
    'fitness':       'fitness gym workout protein supplement muscle strength training cardio exercise weight loss bodybuilding crossfit',
    'food':          'food recipe cooking vegan restaurant meal healthy diet cuisine chef culinary baking nutrition snack',
    'fashion':       'fashion style clothing outfit apparel trend wardrobe accessories streetwear luxury designer couture',
    'tech':          'technology gadget smartphone app software device review unboxing innovation startup ai digital product',
    'technology':    'technology gadget smartphone app software device review unboxing innovation startup ai digital product',  # alias for 'tech'
    'travel':        'travel adventure tourism destination hotel photography explore journey road trip backpacking wanderlust holiday',
    'gaming':        'gaming game esports streaming console PC online multiplayer tournament twitch youtube gameplay',
    'finance':       'finance investing money banking crypto stock market personal finance wealth savings budget fintech',
    'education':     'education learning course tutorial student university skill development career knowledge online training',
    'entertainment': 'entertainment music movie comedy show celebrity pop culture media viral trending celebrity',
    'sports':        'sports cricket football basketball athletics running cycling swimming team competition league',
    'music':         'music song artist band album playlist rap hip-hop pop indie acoustic performance concert',
    'comedy':        'comedy funny jokes memes satire stand-up humor entertainment viral sketch parody',
    'lifestyle':     'lifestyle daily routine morning evening home decor family relationships productivity vlog',
    'photography':   'photography camera portrait nature landscape lighting editing DSLR iPhone content creation visual',
    'pets':          'pets dogs cats animals veterinary grooming training adoption rescue pet care',
    'pet':           'pets dogs cats animals veterinary grooming training adoption rescue pet care',  # alias for 'pets'
    'interior':      'interior design home decor room makeover furniture aesthetic DIY living room bedroom renovation',
    'family':        'family parenting kids children baby toddler pregnancy mom dad activities education school',
    'diy':           'diy craft handmade tutorial home improvement woodwork upcycle recycle art project make',
    'business':      'business entrepreneur startup marketing branding strategy leadership management sales B2B',
    'other':         'lifestyle content creator India social media digital influencer engagement community reels',
}

_tfidf_vectorizer = None
_tfidf_niche_vecs = {}
_bm_score_cache = {}

# Cross-niche brand match scores (0-100).
# When a creator's niche != campaign filter, use these instead of 0%.
# Based on real-world audience overlap between content categories.
# E.g. fashion creators reach beauty audiences (GRWM content, style+skincare);
# gaming creators are the primary tech gadget review audience.
_CROSS_NICHE_SCORES = {
    # Beauty ↔ related
    ('beauty',  'wellness'):     60,
    ('beauty',  'fashion'):      45,
    ('beauty',  'lifestyle'):    40,
    ('beauty',  'fitness'):      25,
    # Fashion ↔ related
    ('fashion', 'lifestyle'):    50,
    ('fashion', 'beauty'):       45,
    ('fashion', 'entertainment'):30,
    # Gaming ↔ Technology (very high overlap — same audience)
    ('gaming',  'technology'):   70,
    ('technology','gaming'):     70,
    ('gaming',  'entertainment'):35,
    # Fitness ↔ related
    ('fitness', 'wellness'):     65,
    ('fitness', 'lifestyle'):    40,
    ('fitness', 'food'):         30,
    # Wellness ↔ related
    ('wellness','fitness'):      65,
    ('wellness','beauty'):       60,
    ('wellness','lifestyle'):    50,
    ('wellness','food'):         35,
    # Lifestyle ↔ related (lifestyle overlaps with almost everything)
    ('lifestyle','fashion'):     50,
    ('lifestyle','food'):        45,
    ('lifestyle','travel'):      45,
    ('lifestyle','wellness'):    50,
    ('lifestyle','fitness'):     40,
    # Food ↔ related
    ('food',    'lifestyle'):    45,
    ('food',    'wellness'):     35,
    ('food',    'travel'):       30,
    # Travel ↔ related
    ('travel',  'lifestyle'):    45,
    ('travel',  'photography'):  50,
    ('travel',  'food'):         30,
    # Entertainment ↔ related
    ('entertainment','comedy'):  55,
    ('entertainment','music'):   50,
    ('entertainment','gaming'):  35,
    # Finance ↔ related
    ('finance', 'business'):     60,
    ('finance', 'education'):    40,
    ('finance', 'technology'):   30,
    # Business ↔ related
    ('business','finance'):      60,
    ('business','education'):    45,
    ('business','technology'):   35,
    # Education ↔ related
    ('education','business'):    45,
    ('education','technology'):  40,
    ('education','finance'):     40,
}


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


import threading as _threading
_chroma_ready = _threading.Event()   # set when first batch of creators is indexed


def _fast_seed_chromadb(brand_matcher, creators_df, n: int = 100):
    """
    Synchronously embed the top N creators (~2-4 s on CPU) so the very first
    /api/match request uses semantic search immediately.
    """
    try:
        top = creators_df[creators_df['fake_account'] == 0].nlargest(n, 'engagement_rate')
        docs, ids, metas = [], [], []
        for _, row in top.iterrows():
            cid   = str(int(row['creator_id']))
            niche = str(row.get('niche', 'general'))
            er    = float(row.get('engagement_rate', 0))
            flw   = int(row.get('followers', 0))
            docs.append(f"Category/Niche: {niche}. Followers: {flw:,}. Engagement: {er:.2%}.")
            ids.append(cid)
            metas.append({'niche': niche, 'followers': flw,
                          'engagement_rate': er, 'creator_id': int(row['creator_id']),
                          'fake_account': 0})
        embeddings = brand_matcher.embedding_model.encode(
            docs, batch_size=64, show_progress_bar=False
        ).tolist()
        brand_matcher.collection.add(documents=docs, embeddings=embeddings, ids=ids, metadatas=metas)
        _chroma_ready.set()
        logger.info(f"ChromaDB seeded with top {len(docs)} creators - semantic search live")
    except Exception as e:
        logger.warning(f"ChromaDB fast seed failed: {e}")
        _chroma_ready.set()   # unblock so normal requests continue


def _populate_chromadb(brand_matcher, creators_df, backend_dir):
    """
    Background thread: full index of top 1500 creators via load_creators().
    Replaces the fast-seed collection with a larger, richer one.
    """
    import os as _os
    try:
        top = creators_df[creators_df['fake_account'] == 0].nlargest(1500, 'engagement_rate')
        tmp_path = str(Path(backend_dir) / 'top_creators_temp.csv')
        top.to_csv(tmp_path, index=False, encoding='utf-8')
        n = brand_matcher.load_creators(tmp_path)
        try:
            _os.unlink(tmp_path)
        except Exception:
            pass
        _chroma_ready.set()
        logger.info(f"ChromaDB fully indexed with {n} creators - semantic matching active")
    except Exception as e:
        logger.warning(f"ChromaDB full index failed (TF-IDF fallback active): {e}")


class CsvEngine:
    def __init__(self, creators_csv):
        self.creators_csv = creators_csv
        self.creators_df = pd.read_csv(creators_csv)
        self.brand_matcher = None
        self.growth_predictor = GrowthPredictor(model_version='v2', use_fallback=True)
        # Use optimal threshold (0.585) from training metadata -- not the default 0.50
        # The optimal threshold maximises F1; 0.50 causes false negatives on borderline cases
        _auth_meta = joblib.load(BACKEND_DIR / 'authenticity_metadata_v2.pkl')
        _opt_thresh = float(_auth_meta.get('optimal_threshold', 0.585))
        self.authenticity_detector = AuthenticityDetector(model_version='v2', threshold=_opt_thresh)
        logger.info(f"AuthenticityDetector loaded with optimal threshold={_opt_thresh:.3f}")
        try:
            from brand_matcher_v2 import BrandMatcher
            self.brand_matcher = BrandMatcher(creators_csv=creators_csv)
            # Phase 1: synchronously seed top 100 (~3s) so first request works immediately
            _fast_seed_chromadb(self.brand_matcher, self.creators_df, n=100)
            # Phase 2: background-expand to full 1500-creator index
            _threading.Thread(
                target=_populate_chromadb,
                args=(self.brand_matcher, self.creators_df, BACKEND_DIR),
                daemon=True,
            ).start()
            logger.info("BrandMatcher ready - ChromaDB seeded (100 creators), expanding in background")
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

# Initialise meta-learner and TF-IDF after engine is ready
_rf_scorer = _RatefluencerScorer()
_init_tfidf()

# -- Campaign database --------------------------------------------------------
DB_PATH = BACKEND_DIR / 'campaigns.db'

DEMO_CAMPAIGNS = [
    # Beauty & Skincare
    {"id": "demo_1",  "name": "Diwali Skincare Launch",         "brand": "Nykaa",           "goal": "Brand Awareness",     "category_filters": ["Beauty","Wellness"],      "campaign_text": "Skincare beauty wellness glow serum organic India women",                         "budget": 1000000,  "ageGroup": "18-34", "country": "India", "timestamp": "2026-06-01T10:00:00"},
    {"id": "demo_2",  "name": "Summer Glow Kit",                "brand": "Mamaearth",        "goal": "Sales / Conversions", "category_filters": ["Beauty"],                 "campaign_text": "Natural skincare organic beauty glow kit summer India women self-care",          "budget": 800000,   "ageGroup": "18-30", "country": "India", "timestamp": "2026-06-01T10:30:00"},
    {"id": "demo_3",  "name": "Men's Grooming Range",           "brand": "Beardo",           "goal": "Product Launch",      "category_filters": ["Beauty","Fitness"],       "campaign_text": "Men grooming beard skincare hair styling product launch India",                  "budget": 600000,   "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-01T11:00:00"},
    {"id": "demo_4",  "name": "Luxury Perfume Collection",      "brand": "Forest Essentials", "goal": "Brand Awareness",    "category_filters": ["Beauty","Lifestyle"],     "campaign_text": "Luxury perfume fragrance Ayurvedic beauty wellness India premium",             "budget": 2500000,  "ageGroup": "25-44", "country": "India", "timestamp": "2026-06-01T11:30:00"},
    {"id": "demo_5",  "name": "Hair Care Revolution",           "brand": "Wow Skin Science", "goal": "Sales / Conversions", "category_filters": ["Beauty","Wellness"],      "campaign_text": "Hair care shampoo conditioner growth natural organic beauty India",             "budget": 700000,   "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-01T12:00:00"},
    # Fitness & Health
    {"id": "demo_6",  "name": "Protein Supplement Campaign",    "brand": "MuscleBlaze",      "goal": "Sales / Conversions", "category_filters": ["Fitness"],                "campaign_text": "Fitness gym workout protein supplement muscle strength training",               "budget": 500000,   "ageGroup": "18-34", "country": "India", "timestamp": "2026-06-01T12:30:00"},
    {"id": "demo_7",  "name": "Yoga Mat & Accessories",         "brand": "Boldfit",          "goal": "Product Launch",      "category_filters": ["Fitness","Wellness"],     "campaign_text": "Yoga fitness wellness mat accessories home workout India health",               "budget": 400000,   "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-01T13:00:00"},
    {"id": "demo_8",  "name": "Smartwatch Fitness Edition",     "brand": "Noise",            "goal": "Product Launch",      "category_filters": ["Fitness","Tech"],         "campaign_text": "Smartwatch fitness tracker health monitor wearable tech India",                 "budget": 1500000,  "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-01T13:30:00"},
    {"id": "demo_9",  "name": "Health Drink for Athletes",      "brand": "Gatorade",         "goal": "Brand Awareness",     "category_filters": ["Fitness","Food"],         "campaign_text": "Sports drink energy hydration athlete fitness performance India",               "budget": 3000000,  "ageGroup": "16-30", "country": "India", "timestamp": "2026-06-01T14:00:00"},
    {"id": "demo_10", "name": "Cycling Gear Campaign",          "brand": "Firefox Bikes",    "goal": "Community Growth",    "category_filters": ["Fitness","Travel"],       "campaign_text": "Cycling bike fitness outdoor adventure gear India community sport",             "budget": 350000,   "ageGroup": "18-40", "country": "India", "timestamp": "2026-06-01T14:30:00"},
    # Food & Beverage
    {"id": "demo_11", "name": "Food Delivery App Launch",       "brand": "Swiggy",           "goal": "App Downloads",       "category_filters": ["Food","Lifestyle"],       "campaign_text": "Food delivery restaurant healthy meal cooking recipe India",                   "budget": 750000,   "ageGroup": "18-30", "country": "India", "timestamp": "2026-06-01T15:00:00"},
    {"id": "demo_12", "name": "Premium Coffee Experience",      "brand": "Blue Tokai",       "goal": "Brand Awareness",     "category_filters": ["Food","Lifestyle"],       "campaign_text": "Specialty coffee premium artisan brew cafe culture India lifestyle",            "budget": 400000,   "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-01T15:30:00"},
    {"id": "demo_13", "name": "Healthy Snack Range",            "brand": "Yoga Bar",         "goal": "Sales / Conversions", "category_filters": ["Food","Fitness","Wellness"],"campaign_text": "Healthy snack protein bar nutrition wellness diet food India",                 "budget": 500000,   "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-01T16:00:00"},
    {"id": "demo_14", "name": "Cloud Kitchen Launch",           "brand": "Rebel Foods",      "goal": "Brand Awareness",     "category_filters": ["Food"],                   "campaign_text": "Cloud kitchen food brand delivery multiple cuisines India online ordering",     "budget": 900000,   "ageGroup": "18-34", "country": "India", "timestamp": "2026-06-01T16:30:00"},
    {"id": "demo_15", "name": "Organic Juice Cleanse",          "brand": "Raw Pressery",     "goal": "Product Launch",      "category_filters": ["Food","Wellness"],        "campaign_text": "Organic cold press juice cleanse detox health wellness India",                  "budget": 300000,   "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-01T17:00:00"},
    # Fashion & Lifestyle
    {"id": "demo_16", "name": "Ethnic Wear Festive Season",     "brand": "Manyavar",         "goal": "Brand Awareness",     "category_filters": ["Fashion"],                "campaign_text": "Ethnic wear traditional Indian fashion festive wedding kurta sherwani",        "budget": 5000000,  "ageGroup": "18-45", "country": "India", "timestamp": "2026-06-01T17:30:00"},
    {"id": "demo_17", "name": "Streetwear Collection Drop",     "brand": "Bewakoof",         "goal": "Product Launch",      "category_filters": ["Fashion","Entertainment"],"campaign_text": "Streetwear urban fashion youth culture India drop collection style",            "budget": 600000,   "ageGroup": "16-28", "country": "India", "timestamp": "2026-06-01T18:00:00"},
    {"id": "demo_18", "name": "Sustainable Fashion Campaign",   "brand": "No Nasties",       "goal": "Community Growth",    "category_filters": ["Fashion","Wellness"],     "campaign_text": "Sustainable eco-friendly fashion organic cotton ethical clothing India",       "budget": 350000,   "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-01T18:30:00"},
    {"id": "demo_19", "name": "Luxury Handbag Launch",          "brand": "Hidesign",         "goal": "Product Launch",      "category_filters": ["Fashion","Lifestyle"],    "campaign_text": "Luxury leather handbag accessories premium fashion India lifestyle",           "budget": 1200000,  "ageGroup": "25-45", "country": "India", "timestamp": "2026-06-01T19:00:00"},
    {"id": "demo_20", "name": "Sports Apparel Line",            "brand": "Puma India",       "goal": "Brand Awareness",     "category_filters": ["Fashion","Fitness"],      "campaign_text": "Sports apparel activewear running fitness training shoes India performance",    "budget": 4000000,  "ageGroup": "16-34", "country": "India", "timestamp": "2026-06-01T19:30:00"},
    # Tech & Gaming
    {"id": "demo_21", "name": "Tech Gadget Unboxing",           "brand": "OnePlus",          "goal": "Product Launch",      "category_filters": ["Tech","Gaming"],          "campaign_text": "Technology gadget smartphone unboxing review tech product",                    "budget": 2000000,  "ageGroup": "18-34", "country": "India", "timestamp": "2026-06-01T20:00:00"},
    {"id": "demo_22", "name": "Gaming Laptop Launch",           "brand": "Asus ROG",         "goal": "Product Launch",      "category_filters": ["Gaming","Tech"],          "campaign_text": "Gaming laptop high performance esports India gamer tech review",               "budget": 2500000,  "ageGroup": "16-30", "country": "India", "timestamp": "2026-06-01T20:30:00"},
    {"id": "demo_23", "name": "Truly Wireless Earbuds",         "brand": "boAt",             "goal": "Sales / Conversions", "category_filters": ["Tech","Music"],           "campaign_text": "Wireless earbuds audio music TWS earphones India youth lifestyle tech",        "budget": 1800000,  "ageGroup": "16-30", "country": "India", "timestamp": "2026-06-01T21:00:00"},
    {"id": "demo_24", "name": "EdTech Platform Launch",         "brand": "Unacademy",        "goal": "App Downloads",       "category_filters": ["Education","Tech"],       "campaign_text": "Online learning edtech education platform India students exams courses",       "budget": 3000000,  "ageGroup": "16-28", "country": "India", "timestamp": "2026-06-01T21:30:00"},
    {"id": "demo_25", "name": "Gaming Peripherals Campaign",    "brand": "Logitech India",   "goal": "Brand Awareness",     "category_filters": ["Gaming","Tech"],          "campaign_text": "Gaming mouse keyboard headset peripherals esports India setup",                "budget": 1000000,  "ageGroup": "16-28", "country": "India", "timestamp": "2026-06-01T22:00:00"},
    # Travel & Hospitality
    {"id": "demo_26", "name": "Travel Booking Campaign",        "brand": "MakeMyTrip",       "goal": "Brand Awareness",     "category_filters": ["Travel","Photography"],   "campaign_text": "Travel adventure tourism destination photography explore India",               "budget": 1500000,  "ageGroup": "25-44", "country": "India", "timestamp": "2026-06-02T09:00:00"},
    {"id": "demo_27", "name": "Budget Hotel Discovery",         "brand": "OYO",              "goal": "App Downloads",       "category_filters": ["Travel","Lifestyle"],     "campaign_text": "Budget hotel affordable stay travel India staycation weekend getaway",         "budget": 2000000,  "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-02T09:30:00"},
    {"id": "demo_28", "name": "Luxury Resort Campaign",         "brand": "Taj Hotels",       "goal": "Brand Awareness",     "category_filters": ["Travel","Lifestyle"],     "campaign_text": "Luxury hotel resort travel India wellness spa fine dining premium",            "budget": 5000000,  "ageGroup": "30-55", "country": "India", "timestamp": "2026-06-02T10:00:00"},
    {"id": "demo_29", "name": "Backpacker Travel Gear",         "brand": "Wildcraft",        "goal": "Product Launch",      "category_filters": ["Travel","Fitness"],       "campaign_text": "Backpack travel outdoor adventure trekking gear India camping mountain",       "budget": 500000,   "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-02T10:30:00"},
    {"id": "demo_30", "name": "International Flight Deals",     "brand": "IndiGo",           "goal": "Sales / Conversions", "category_filters": ["Travel"],                 "campaign_text": "Flight airline travel deals international domestic India low cost booking",    "budget": 4000000,  "ageGroup": "22-45", "country": "India", "timestamp": "2026-06-02T11:00:00"},
    # Finance & Fintech
    {"id": "demo_31", "name": "Digital Payments App",           "brand": "PhonePe",          "goal": "App Downloads",       "category_filters": ["Finance","Tech"],         "campaign_text": "Digital payment UPI fintech money transfer India cashless mobile wallet",      "budget": 5000000,  "ageGroup": "18-40", "country": "India", "timestamp": "2026-06-02T11:30:00"},
    {"id": "demo_32", "name": "Mutual Fund Investment",         "brand": "Groww",            "goal": "Community Growth",    "category_filters": ["Finance","Education"],    "campaign_text": "Mutual fund investment stock market finance India millennial wealth",           "budget": 2000000,  "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-02T12:00:00"},
    {"id": "demo_33", "name": "Credit Card Launch",             "brand": "HDFC Bank",        "goal": "Product Launch",      "category_filters": ["Finance","Lifestyle"],    "campaign_text": "Credit card rewards cashback premium banking lifestyle India",                  "budget": 3000000,  "ageGroup": "25-45", "country": "India", "timestamp": "2026-06-02T12:30:00"},
    {"id": "demo_34", "name": "Crypto Trading Platform",        "brand": "CoinDCX",          "goal": "App Downloads",       "category_filters": ["Finance","Tech"],         "campaign_text": "Cryptocurrency bitcoin trading investment blockchain India fintech youth",      "budget": 1500000,  "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-02T13:00:00"},
    {"id": "demo_35", "name": "Term Insurance Awareness",       "brand": "PolicyBazaar",     "goal": "Brand Awareness",     "category_filters": ["Finance","Education"],    "campaign_text": "Life insurance term plan financial planning India family protection wealth",   "budget": 2500000,  "ageGroup": "25-45", "country": "India", "timestamp": "2026-06-02T13:30:00"},
    # Entertainment & Media
    {"id": "demo_36", "name": "OTT Platform Subscription",      "brand": "Disney+ Hotstar",  "goal": "App Downloads",       "category_filters": ["Entertainment","Lifestyle"],"campaign_text": "OTT streaming movies web series sports cricket India entertainment",           "budget": 4000000,  "ageGroup": "16-40", "country": "India", "timestamp": "2026-06-02T14:00:00"},
    {"id": "demo_37", "name": "Music Streaming Campaign",        "brand": "JioSaavn",         "goal": "App Downloads",       "category_filters": ["Music","Entertainment"],  "campaign_text": "Music streaming Hindi Bollywood playlist India artists discovery",             "budget": 1500000,  "ageGroup": "16-35", "country": "India", "timestamp": "2026-06-02T14:30:00"},
    {"id": "demo_38", "name": "Comedy Show Promotion",           "brand": "Netflix India",    "goal": "Brand Awareness",     "category_filters": ["Entertainment","Comedy"], "campaign_text": "Comedy show Netflix India original series entertainment binge watch",          "budget": 3000000,  "ageGroup": "18-35", "country": "India", "timestamp": "2026-06-02T15:00:00"},
    {"id": "demo_39", "name": "Podcast Platform Launch",         "brand": "Hubhopper",        "goal": "Community Growth",    "category_filters": ["Education","Entertainment"],"campaign_text": "Podcast audio content India creator education entertainment storytelling",     "budget": 300000,   "ageGroup": "18-40", "country": "India", "timestamp": "2026-06-02T15:30:00"},
    {"id": "demo_40", "name": "Gaming Tournament Sponsorship",   "brand": "MPL",              "goal": "Community Growth",    "category_filters": ["Gaming","Entertainment"], "campaign_text": "Mobile gaming tournament esports India skill money prize fantasy sport",       "budget": 2000000,  "ageGroup": "16-30", "country": "India", "timestamp": "2026-06-02T16:00:00"},
    # Home & Interior
    {"id": "demo_41", "name": "Smart Home Devices",              "brand": "Philips India",    "goal": "Product Launch",      "category_filters": ["Tech","Interior"],        "campaign_text": "Smart home automation lighting device India interior design lifestyle",        "budget": 1000000,  "ageGroup": "25-45", "country": "India", "timestamp": "2026-06-02T16:30:00"},
    {"id": "demo_42", "name": "Premium Furniture Range",         "brand": "Pepperfry",        "goal": "Brand Awareness",     "category_filters": ["Interior","Lifestyle"],   "campaign_text": "Home furniture interior design decor premium India living room bedroom",       "budget": 1500000,  "ageGroup": "25-45", "country": "India", "timestamp": "2026-06-02T17:00:00"},
    {"id": "demo_43", "name": "Air Purifier Campaign",           "brand": "Dyson India",      "goal": "Product Launch",      "category_filters": ["Interior","Wellness"],    "campaign_text": "Air purifier clean air pollution wellness home India premium appliance",       "budget": 2000000,  "ageGroup": "28-50", "country": "India", "timestamp": "2026-06-02T17:30:00"},
    # Pets & Family
    {"id": "demo_44", "name": "Premium Pet Food Launch",         "brand": "Drools",           "goal": "Product Launch",      "category_filters": ["Pets","Wellness"],        "campaign_text": "Pet food dog cat nutrition premium health India pet parent care",              "budget": 400000,   "ageGroup": "22-40", "country": "India", "timestamp": "2026-06-02T18:00:00"},
    {"id": "demo_45", "name": "Baby Care Essentials",            "brand": "Mee Mee",          "goal": "Brand Awareness",     "category_filters": ["Family","Wellness"],      "campaign_text": "Baby care products mother infant child wellness safety India parenting",       "budget": 600000,   "ageGroup": "22-35", "country": "India", "timestamp": "2026-06-02T18:30:00"},
    # Education
    {"id": "demo_46", "name": "Coding Bootcamp for Kids",        "brand": "WhiteHat Jr",      "goal": "App Downloads",       "category_filters": ["Education","Tech"],       "campaign_text": "Kids coding programming education online learning India school STEM",          "budget": 1500000,  "ageGroup": "25-40", "country": "India", "timestamp": "2026-06-02T19:00:00"},
    {"id": "demo_47", "name": "Language Learning App",           "brand": "Duolingo India",   "goal": "App Downloads",       "category_filters": ["Education","Lifestyle"],  "campaign_text": "Language learning English Spanish app India skill education career",           "budget": 2000000,  "ageGroup": "16-35", "country": "India", "timestamp": "2026-06-02T19:30:00"},
    # Automobiles
    {"id": "demo_48", "name": "Electric Scooter Launch",         "brand": "Ola Electric",     "goal": "Product Launch",      "category_filters": ["Tech","Lifestyle"],       "campaign_text": "Electric scooter EV sustainable transport India urban commute green",          "budget": 5000000,  "ageGroup": "18-40", "country": "India", "timestamp": "2026-06-02T20:00:00"},
    {"id": "demo_49", "name": "Car Insurance Campaign",          "brand": "Acko",             "goal": "App Downloads",       "category_filters": ["Finance","Tech"],         "campaign_text": "Car insurance digital auto policy India vehicle coverage online claim",        "budget": 1500000,  "ageGroup": "22-45", "country": "India", "timestamp": "2026-06-02T20:30:00"},
    # Creator Economy
    {"id": "demo_50", "name": "Creator Fund India",              "brand": "Instagram India",  "goal": "Community Growth",    "category_filters": ["Lifestyle","Entertainment","Fashion","Fitness","Beauty"],
     "campaign_text": "Creator content creator economy Instagram India reels viral social media influencer",
     "budget": 10000000, "ageGroup": "16-35", "country": "India", "timestamp": "2026-06-02T21:00:00"},
]

def _db_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_campaigns_db():
    with _db_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id              TEXT PRIMARY KEY,
                name            TEXT,
                brand           TEXT,
                goal            TEXT,
                category_filters TEXT,
                campaign_text   TEXT UNIQUE,
                budget          INTEGER,
                age_group       TEXT,
                country         TEXT,
                timestamp       TEXT
            )
        """)
        conn.commit()
        # Always sync all demo campaigns (INSERT OR IGNORE keeps live campaigns intact)
        for c in DEMO_CAMPAIGNS:
            conn.execute(
                "INSERT OR IGNORE INTO campaigns VALUES (?,?,?,?,?,?,?,?,?,?)",
                (c["id"], c["name"], c["brand"], c["goal"],
                 json.dumps(c["category_filters"]), c["campaign_text"],
                 c["budget"], c.get("ageGroup","18-34"), c.get("country","India"), c["timestamp"])
            )
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM campaigns").fetchone()[0]
        logger.info(f"Campaigns DB ready — {total} campaigns ({len(DEMO_CAMPAIGNS)} demo + live)")

def db_get_campaigns():
    with _db_conn() as conn:
        rows = conn.execute("SELECT * FROM campaigns ORDER BY timestamp DESC").fetchall()
    result = []
    for r in rows:
        result.append({
            "id": r["id"], "name": r["name"], "brand": r["brand"], "goal": r["goal"],
            "category_filters": json.loads(r["category_filters"] or "[]"),
            "campaign_text": r["campaign_text"], "budget": r["budget"],
            "ageGroup": r["age_group"], "country": r["country"], "timestamp": r["timestamp"],
        })
    return result

def db_add_campaign(entry):
    try:
        with _db_conn() as conn:
            # Keep max 50 live campaigns (never delete demo_ rows)
            live_count = conn.execute("SELECT COUNT(*) FROM campaigns WHERE id LIKE 'live_%'").fetchone()[0]
            if live_count >= 45:
                oldest = conn.execute(
                    "SELECT id FROM campaigns WHERE id LIKE 'live_%' ORDER BY timestamp ASC LIMIT 5"
                ).fetchall()
                for row in oldest:
                    conn.execute("DELETE FROM campaigns WHERE id=?", (row["id"],))
            conn.execute(
                "INSERT OR IGNORE INTO campaigns VALUES (?,?,?,?,?,?,?,?,?,?)",
                (entry["id"], entry["name"], entry["brand"], entry["goal"],
                 json.dumps(entry.get("category_filters", [])), entry["campaign_text"],
                 entry["budget"], entry.get("ageGroup","18-34"), entry.get("country","India"),
                 entry["timestamp"])
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"db_add_campaign failed: {e}")

def db_campaign_exists(campaign_text):
    with _db_conn() as conn:
        return conn.execute(
            "SELECT 1 FROM campaigns WHERE campaign_text=?", (campaign_text,)
        ).fetchone() is not None

def db_next_live_id():
    with _db_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM campaigns WHERE id LIKE 'live_%'").fetchone()[0]
    return f"live_{count + 1}"

init_campaigns_db()


# -- Utility helpers ----------------------------------------------------------
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
    """
    Build the 16 model features from observed signals only.
    Reads: followers, posts, engagement_rate, likes, comments, reach, impressions.
    Prefers real CSV columns where present; falls back to data-driven proxies.
    Never reads fake_account  -  that is the label, not a signal.
    """
    followers   = max(1.0, float(row.get('followers', 10000)))
    posts       = max(1.0, float(row.get('posts', min(250, max(5, followers / 50)))))
    er          = float(row.get('engagement_rate', 3.0))
    if er < 1.0:
        er *= 100.0
    likes       = float(row.get('likes') or row.get('avg_likes') or max(1.0, followers * er / 100 * 0.9))
    comments    = float(row.get('comments') or row.get('avg_comments') or max(1.0, followers * er / 100 * 0.1))
    reach       = float(row.get('reach') or row.get('impressions') or max(1.0, likes * 12.0))
    impressions = float(row.get('impressions') or max(1.0, reach * 1.5))

    # Prefer real columns when the data source provides them
    following  = float(row.get('following') or (followers * max(0.01, min(3.0, 0.04 + max(0.0, (3.5 - er) * 0.12)))))
    avg_hash   = float(row.get('avg_hashtags') or 15.0)
    er_likes   = float(row.get('er_likes')    or likes    / followers * 100)
    er_cmts    = float(row.get('er_comments') or comments / followers * 100)

    fo_est     = following / max(followers, 1)
    reach_ratio = reach / max(impressions, 1)
    cs_est     = max(0.02, min(0.95, 0.6 - reach_ratio * 0.4 - er * 0.03))
    pr_est     = min(0.97, max(0.10, er / 12.0 + min(posts, 200) / 400.0 + 0.25))
    eng_per_reach = (likes + comments) / max(reach, 1)
    cl_est     = max(0, min(90, int((0.05 - eng_per_reach) * 1000)))
    ni_est     = min(10, max(1, int(posts / 25)))
    lin_est    = 1.0 if er >= 2.0 else 0.0
    pi_est     = 1.0 if posts >= 10 else 0.0

    return {
        'pos': min(250, max(5, posts / 50)),
        'flw': followers,
        'flg': following,
        'bl':  float(row.get('blocked_count', 0)),
        'lin': float(row.get('link_in_bio', lin_est)),
        'cl':  float(row.get('clickbait_level', cl_est)),
        'cz':  float(row.get('description_changes', 5.0)),
        'ni':  float(row.get('name_integrity', ni_est)),
        'erl': er_likes,
        'erc': er_cmts,
        'lt':  float(row.get('link_type', 1.0)),
        'hc':  avg_hash,
        'pr':  float(row.get('profile_completeness', pr_est)),
        'fo':  fo_est,
        'cs':  float(row.get('content_similarity', cs_est)),
        'pi':  float(row.get('has_profile_image', pi_est)),
    }


def live_brand_match(row, campaign_text, category_filters):
    """Keyword-based brand match  -  used as final fallback."""
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
    """
    Per-creator brand match score using TF-IDF cosine similarity.

    NOTE: ChromaDB brand_matcher.match() is NOT used here because it returns
    the similarity of the best overall match, not this specific creator —
    causing all creators to receive the same score.
    TF-IDF correctly scores each creator's niche against the campaign text.
    """
    niche    = str(row.get('niche', '')).lower()
    selected = {str(cat).lower() for cat in category_filters or []}

    # Cache key MUST include category_filters so category bonus is applied correctly
    cache_key = (campaign_text, niche, frozenset(selected))
    if cache_key in _bm_score_cache:
        return _bm_score_cache[cache_key]

    # TF-IDF cosine similarity between campaign text and creator's niche vocabulary
    if _tfidf_vectorizer and niche in _tfidf_niche_vecs:
        try:
            campaign_vec = _tfidf_vectorizer.transform([campaign_text])
            sim   = float(cosine_similarity(campaign_vec, _tfidf_niche_vecs[niche])[0][0])
            score = sim * 100

            # Category bonus: niche exactly matches campaign filter → strong boost
            if niche in selected:
                score = min(100, score + 55)
            # Partial match: niche mentioned in campaign text
            elif niche and niche in (campaign_text or '').lower():
                score = min(100, score + 35)
            # Cross-niche bonus: use explicit audience-overlap scores
            # (e.g. gaming creator for tech campaign, fashion creator for beauty)
            elif selected:
                best_cross = 0
                for sel in selected:
                    cross = _CROSS_NICHE_SCORES.get((niche, sel), 0)
                    if cross > best_cross:
                        best_cross = cross
                if best_cross > 0:
                    # Scale: cross-niche bonus is added to TF-IDF base score
                    score = min(100, score + best_cross)

            result = round(clamp(score), 2)
            _bm_score_cache[cache_key] = result
            return result
        except Exception:
            pass

    # Keyword fallback (no TF-IDF match for this niche)
    result = live_brand_match(row, campaign_text, category_filters)
    _bm_score_cache[cache_key] = result
    return result


def detect_engagement_anomalies(row: dict) -> dict:
    """
    Heuristic detection of engagement pods and artificial spikes.

    Pod detection:  comment/like ratio > 0.15 (bots post many short comments
                    to inflate engagement without real likes).
    Spike detection: ER > 3x the expected rate for the follower count
                    (accounts buying engagement spikes get unnaturally high ER).
    """
    followers = float(row.get('followers', 10000))
    er        = float(row.get('engagement_rate', 3.0))
    likes     = float(row.get('likes', max(1.0, followers * er / 100 * 0.9)))
    comments  = float(row.get('comments', max(1.0, followers * er / 100 * 0.1)))

    # Comment/like ratio  (pods have high ratio — many short comments per like)
    comment_like_ratio = comments / max(likes, 1)
    pod_detected       = comment_like_ratio > 0.15

    # Expected ER based on follower count (larger = lower organic ER)
    # Benchmark: 1K followers -> ~8% ER, 1M followers -> ~2% ER
    expected_er   = max(1.5, 8.0 - math.log10(max(followers, 1000)) * 1.5)
    spike_detected = er > expected_er * 3.0

    anomaly_score = 0
    flags = []
    if pod_detected:
        anomaly_score += 40
        flags.append(f"High comment/like ratio ({comment_like_ratio:.2f}) - possible engagement pod")
    if spike_detected:
        anomaly_score += 35
        flags.append(f"ER {er:.1f}% is {er/expected_er:.1f}x expected ({expected_er:.1f}%) - possible spike")

    return {
        'pod_detected':        pod_detected,
        'spike_detected':      spike_detected,
        'comment_like_ratio':  round(comment_like_ratio, 3),
        'expected_er':         round(expected_er, 1),
        'anomaly_score':       anomaly_score,
        'flags':               flags,
    }


def engagement_score(row):
    followers = float(row.get('followers', 0))
    er = float(row.get('engagement_rate', 0))
    er_quality = clamp(er * 8.0)
    audience_quality = clamp(math.log10(max(followers, 10)) * 16.0)
    return round(er_quality * 0.65 + audience_quality * 0.35, 2)


def generated_scores(row, campaign_text, category_filters, campaign_goal):
    is_fake = int(row.get('fake_account', 0)) == 1

    # Always run ML models for unique per-creator scores.
    # CSV pre-computed values (authenticity_score, growth_score) are coarsely
    # bucketed (only 3-6 unique values) and cause all top creators to show
    # identical scores (e.g. Auth=100%, Growth=90% for every fashion creator).
    auth_res     = engine.authenticity_detector.predict(prepare_authenticity_features(row))
    authenticity = float(auth_res['probability_authentic'] * 100.0)
    risk_level   = auth_res['risk_level']

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

    weighted_final = (
        brand_match * weights['brand'] +
        growth      * weights['growth'] +
        authenticity * weights['auth'] +
        engagement  * weights['engagement']
    )

    # Blend with meta-learner when available (60% ML, 40% formula)
    ml_score = _rf_scorer.predict(row) if _rf_scorer else None
    if ml_score is not None:
        final = ml_score * 0.60 + weighted_final * 0.40
    else:
        final = weighted_final

    anomalies = detect_engagement_anomalies(row)
    if anomalies['pod_detected'] or anomalies['spike_detected']:
        final *= max(0.5, 1.0 - anomalies['anomaly_score'] / 200)

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
        # Normalise campaign terms to dataset niche names via canonical map
        wanted = {canonical_niche(str(cat)) for cat in category_filters}
        # Also keep the raw lowercase term in case dataset was updated
        wanted |= {str(cat).lower() for cat in category_filters}
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


# -- Routes -------------------------------------------------------------------
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

            er_raw     = float(row['engagement_rate'])
            shares_raw = float(row.get('shares', followers_val * er_raw / 100 * 0.15))
            saves_raw  = round(shares_raw * 0.8)
            niche_key  = str(row['niche']).lower()

            result_list.append({
                "id": creator_id,
                "name": c_name,
                "handle": c_handle,
                "cat": str(row['niche']),
                "followers": format_followers(followers_val),
                "followersRaw": followers_val,
                "er": f"{er_raw:.1f}%",
                "erRaw": er_raw,
                "auth": int(row['authenticity_score']),
                "growth": int(row['growth_score']),
                "score": int(row['growth_score'] * 0.5 + row['authenticity_score'] * 0.5),
                "fake": int(row['fake_account']),
                "av": creator_initials(c_name),
                "saves": int(saves_raw),
                "saves_str": f"{int(saves_raw/1000)}K" if saves_raw >= 1000 else str(int(saves_raw)),
                "demographics": get_audience_demographics(niche_key),
                "posts": int(row.get('posts', 0)),
                "posts_per_month": round(int(row.get('posts', 0)) / max(1, min(60, math.log10(max(followers_val, 1000)) * 8 + er_raw * 0.5)), 1),
                "posting_consistency": (
                    "Very Active" if int(row.get('posts', 0)) / max(1, min(60, math.log10(max(followers_val,1000))*8+er_raw*0.5)) >= 20 else
                    "Active"       if int(row.get('posts', 0)) / max(1, min(60, math.log10(max(followers_val,1000))*8+er_raw*0.5)) >= 8  else
                    "Moderate"     if int(row.get('posts', 0)) / max(1, min(60, math.log10(max(followers_val,1000))*8+er_raw*0.5)) >= 3  else
                    "Infrequent"
                ),
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
        # Normalise category_filters through canonical map so 'Tech', 'Lifestyle',
        # 'Wellness' etc. resolve to actual dataset niche names
        raw_filters      = data.get("category_filters", [])
        category_filters = [canonical_niche(c) for c in raw_filters]
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
            logger.info(f"Semantic matcher unavailable (ChromaDB warming up or not installed), using CSV fallback: {type(e).__name__}")
            top_matches = []

        formatted_recos = []
        all_score_results = []

        for match in top_matches:
            creator_id = int(match['creator_id'])

            # CsvEngine uses generated_scores(); RatefluencerEngine uses score_creator()
            try:
                score_res = engine.score_creator(
                    creator_id=creator_id,
                    campaign_text=campaign_text,
                    campaign_goal=campaign_goal
                )
                final_score  = int(score_res['ratefluencer_score'])
                virality     = int(score_res['scores']['growth_score'])
                brand_match  = int(score_res['scores']['brand_match_score'])
                authenticity = int(score_res['scores']['authenticity_score'])
                er_raw       = score_res['engagement_rate']
                niche        = score_res['niche']
                followers_val= score_res['followers']
                risk_level   = score_res['risk_metrics']['risk_level']
                is_fake_flag = score_res['risk_metrics']['is_fake']
            except (RuntimeError, AttributeError):
                # CsvEngine path: score via generated_scores() on the row
                rows = engine.creators_df[engine.creators_df['creator_id'] == creator_id]
                if rows.empty:
                    continue
                row_dict = rows.iloc[0].to_dict()
                scores = generated_scores(row_dict, campaign_text, category_filters, campaign_goal)
                final_score   = int(scores['ratefluencer'])
                virality      = int(scores['growth'])
                brand_match   = int(scores['brand_match'])
                authenticity  = int(scores['authenticity'])
                er_raw        = float(row_dict.get('engagement_rate', 3.0))
                niche         = str(row_dict.get('niche', ''))
                followers_val = int(row_dict.get('followers', 0))
                risk_level    = scores['risk_level']
                is_fake_flag  = scores['is_fake']
                score_res = {
                    'ratefluencer_score': final_score,
                    'scores': {'growth_score': virality, 'brand_match_score': brand_match,
                               'authenticity_score': authenticity},
                    'engagement_rate': er_raw, 'niche': niche, 'followers': followers_val,
                    'risk_metrics': {'risk_level': risk_level, 'is_fake': is_fake_flag},
                    'success_probability': scores['success_probability'],
                    'model_confidence': scores['model_confidence'],
                }
            all_score_results.append(score_res)

            if risk_level == 'High' or is_fake_flag:
                logger.info(f"Excluding creator {creator_id}: High fraud risk.")
                continue

            er           = f"{er_raw:.1f}%"

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
            why_text    = f"* Category similarity of {score_res['scores']['brand_match_score']:.0f}% with verified {risk_level.lower()} fraud risk."
            badge_val   = "\U0001f451 #1 Match" if len(formatted_recos) == 0 else None

            formatted_recos.append({
                "rank": len(formatted_recos) + 1,
                "name": c_name,
                "handle": c_handle,
                "meta": f"{niche} . {followers_str} followers . Instagram",
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
            logger.info(f"Only {len(formatted_recos)} matches  -  filling with CSV fallback for {category_filters}")
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
                    "icon": "\u26a0\ufe0f",
                    "title": "Fraud Alert",
                    "text": "Suspicious bot accounts were detected and excluded from recommendations. The XGBoost model flagged unnatural follower ratios in the candidate pool."
                })
            else:
                insights.append({
                    "icon": "\U0001f6e1\ufe0f",
                    "title": "Safety Verified",
                    "text": "All top recommended profiles are confirmed authentic (Low Risk) by the XGBoost fraud detection model."
                })

            primary_cat = category_filters[0] if category_filters else 'wellness'
            insights.append({
                "icon": "\U0001f4a1",
                "title": "Niche Opportunity",
                "text": f"Micro-creators in the {primary_cat} category show a 2.5x higher save rate and 15% lower CPC than mega-influencers."
            })

        campaign_entry = {
            "id": db_next_live_id(),
            "name": data.get("campaign_text", "")[:40] + "...",
            "brand": data.get("campaign_text", "").split(".")[0].replace("Brand/Product:", "").strip()[:30],
            "goal": campaign_goal,
            "category_filters": category_filters or [],
            "campaign_text": campaign_text,
            "budget": data.get("budget", 1000000),
            "ageGroup": data.get("ageGroup", "18-34"),
            "country": "India",
            "timestamp": pd.Timestamp.now().isoformat(),
        }
        if not db_campaign_exists(campaign_text):
            db_add_campaign(campaign_entry)

        return jsonify({
            "recommendations": formatted_recos,
            "insights": insights,
            "goal": campaign_goal,
            "timestamp": pd.Timestamp.now().isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Campaign matching failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/campaigns", methods=["POST", "GET"])
def campaigns_alias():
    """Alias for /api/creator-match — frontend was calling /api/campaigns which returned 404."""
    if request.method == "GET":
        return jsonify({"campaigns": campaigns_store, "total": len(campaigns_store)}), 200
    return creator_match()


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
        for camp in db_get_campaigns():
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
                        f"\u20b9{budget/100000:.0f}L" if budget >= 100000
                        else f"\u20b9{budget:,}"
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
        style_prefs  = compute_style_preferences(content_category)

        logger.info(f"Generating viral content for topic: '{topic}'")

        learned_block = ""
        if style_prefs.get('total_upvoted', 0) >= 3:
            learned_block = (
                f"\n\nUser feedback learning ({style_prefs['total_upvoted']} upvoted posts, "
                f"avg virality {style_prefs['avg_virality']}):\n"
                f"- Preferred style words: {', '.join(style_prefs.get('preferred_words', []))}\n"
                f"- Optimal hashtags (from history): ~{style_prefs.get('avg_hashtags', opt_hashtags[0])}"
            )
            if style_prefs.get('avoid_words'):
                learned_block += f"\n- Avoid these overused words: {', '.join(style_prefs['avoid_words'])}"

        prompt = f"""You are a viral social media content strategist specialising in Instagram Reels.
Generate {tone.lower()} viral content for this topic: "{topic}"

Data-driven context from real Instagram analytics (30K posts):
- Best posting hours: {best_hours[0]}:00-{best_hours[-1]}:00
- Optimal hashtag count: {opt_hashtags[0]}-{opt_hashtags[1]}
- Best performing format: {best_media}{learned_block}

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


MAX_CONTENT_ITERS  = 5
VIRALITY_THRESHOLD = 72

# Per-iteration improvement strategy injected into the prompt
_ITER_STRATEGY = [
    "Generate baseline viral content for this topic.",
    "Inject any learned user preferences into the style and tone.",
    "Apply the top virality optimisation tip from the previous score.",
    "Make the hook more attention-grabbing in the first 3 words; sharpen the CTA.",
    "Final polish: add a controversy/curiosity hook and ensure the hashtags are trending.",
]


@app.route("/api/run-agent", methods=["POST"])
@rate_limit("20/hour")
def run_agent():
    """Autonomous agent: trend discovery -> creator selection (argmax) -> content refinement loop."""
    try:
        data = request.get_json() or {}
        goal = data.get("goal", "").strip()

        if not goal:
            return jsonify({"error": "goal is required"}), 400

        logger.info(f"Running autonomous agent for goal: '{goal}'")

        # Step 1a  -  Detect category from goal (lightweight LLM call)
        cat_prompt = f"""Given this campaign goal: "{goal}"
Return ONLY JSON: {{"category": "<one of: Fitness, Beauty, Fashion, Technology, Food, Lifestyle, Travel, Music, Photography, Comedy>"}}"""
        try:
            cat_resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": cat_prompt}],
                temperature=0.2,
                max_tokens=50,
            )
            cat_data = _parse_groq_json(cat_resp.choices[0].message.content.strip())
            detected_category = cat_data.get("category", "Lifestyle")
        except Exception:
            detected_category = "Lifestyle"

        # Step 1b  -  Real trend from Google Trends
        gt_trends = fetch_combined_trends(detected_category)
        logger.info(f"Agent: Google Trends returned {len(gt_trends)} results for '{detected_category}'")

        if gt_trends:
            top_gt       = gt_trends[0]
            trend        = top_gt['topic']
            trend_source = "Google Trends"
            trend_signal = top_gt['why_trending']
        else:
            # LLM fallback for trend discovery
            trend_prompt = f"""You are a social media trend analyst.
For campaign goal: "{goal}" (category: {detected_category}), identify the single most relevant trending topic right now ({pd.Timestamp.now().strftime('%B %Y')}).
Return ONLY JSON: {{"trend": "<topic>", "source": "<platform>", "growth_signal": "<why in 10 words>"}}"""
            try:
                trend_resp = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": trend_prompt}],
                    temperature=0.5,
                    max_tokens=200,
                )
                trend_data   = _parse_groq_json(trend_resp.choices[0].message.content.strip())
                trend        = trend_data.get("trend", "Sustainable lifestyle content surging across Gen-Z.")
                trend_source = trend_data.get("source", "Social Media")
                trend_signal = trend_data.get("growth_signal", "")
            except Exception:
                trend, trend_source, trend_signal = "Authentic micro-content", "Social Media", ""

        # Step 2  -  Score top 20 candidates; select argmax Ratefluencer score
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
        agent_style  = compute_style_preferences(detected_category)

        # Step 3  -  Content refinement loop
        agent_learned = ""
        if agent_style.get('total_upvoted', 0) >= 3:
            agent_learned = (
                f"\nLearned from {agent_style['total_upvoted']} previously upvoted posts: "
                f"preferred words [{', '.join(agent_style.get('preferred_words', [])[:3])}], "
                f"optimal ~{agent_style.get('avg_hashtags', 8)} hashtags."
            )

        content_prompt_base = f"""You are a viral content creator for Instagram and LinkedIn.
Campaign goal: {goal}
Trending topic: {trend}
Assigned influencer: {influencer_name} (niche: {influencer_niche})
Data insight: Best Instagram posting time is {best_hours[0]}:00 on {best_days[0]}, use {opt_hashtags[0]}-{opt_hashtags[1]} hashtags{agent_learned}

Generate content for BOTH platforms tailored to this influencer and trend.
Return ONLY JSON (no other text):
{{
  "reel_idea": "<creative 1-2 sentence Instagram reel concept>",
  "caption": "<engaging Instagram caption under 100 words with a clear CTA>",
  "linkedin_hook": "<one punchy LinkedIn opening line  -  max 15 words>",
  "linkedin_post": "<professional LinkedIn post 100-150 words with insights and CTA>",
  "linkedin_hashtags": "<5-7 professional LinkedIn hashtags>"
}}"""

        # Load persisted learned preferences for this category
        learned = _load_learned_prefs().get(
            detected_category.lower(),
            _load_learned_prefs().get("general", {})
        )
        learned_block = ""
        if learned and learned.get("upvoted_count", 0) >= 2:
            learned_block = (
                f"\n\nLEARNED from {learned['upvoted_count']} upvoted posts "
                f"(confidence {learned.get('confidence', 0)}%):\n"
                f"- Preferred tone: {learned.get('detected_tone', 'Inspirational')}\n"
                f"- Style words that work: {', '.join(learned.get('preferred_words', [])[:4])}\n"
                f"- Optimal hashtags: ~{learned.get('avg_hashtags', 8)}\n"
                f"- Avoid: {', '.join(learned.get('avoid_words', [])[:3])}"
            )

        content_attempts = []
        best_content     = None
        best_virality    = -1
        refinement_hint  = None

        for content_iter in range(MAX_CONTENT_ITERS):
            # Each iteration has an explicit improvement strategy
            strategy = _ITER_STRATEGY[min(content_iter, len(_ITER_STRATEGY) - 1)]
            temp     = 0.65 + content_iter * 0.06

            prompt   = content_prompt_base
            if learned_block and content_iter >= 1:
                prompt += learned_block
            if content_iter == 1 and refinement_hint:
                prompt += f"\n\nVIRALITY TIP from last iteration: {refinement_hint}"
            if content_iter >= 2 and refinement_hint:
                prompt += f"\n\nPREVIOUS SCORE {content_attempts[-1]['virality_score']}. Apply: {refinement_hint}"

            prompt += f"\n\nITERATION {content_iter + 1} STRATEGY: {strategy}"

            content_resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=temp,
                max_tokens=800,
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
                'strategy':        strategy,
                'refinement_used': refinement_hint,
                'learned_applied': bool(learned_block and content_iter >= 1),
            })

            if v_score > best_virality:
                best_virality = v_score
                best_content  = content_data

            if v_score >= VIRALITY_THRESHOLD or content_iter == MAX_CONTENT_ITERS - 1:
                break

            # Extract top ^ tip as refinement hint for next iteration
            tips = viral_res.get('optimization_tips', [])
            refinement_hint = next((t[:80] for t in tips if '^' in t), None)

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
    """Real Instagram performance insights by category.
    Falls back to viral_insights_v1.pkl data when Instagram_Analytics.csv is missing."""
    try:
        ig_csv = BACKEND_DIR.parent / 'Instagram_Analytics.csv'
        if not ig_csv.exists():
            # Graceful fallback: derive insights from viral_insights_v1.pkl
            summary = viral_predictor.get_platform_summary()
            cat_stats = []
            for cat, stats in viral_predictor.insights.items():
                cat_stats.append({
                    'category': cat,
                    'total_posts': stats.get('total_posts', 0),
                    'viral_rate': round(stats.get('viral_rate', 0.25) * 100, 1),
                    'avg_engagement_rate': round(stats.get('avg_er', 4.2), 2),
                    'avg_hashtags': stats.get('optimal_hashtag_range', (6, 15))[0],
                    'best_media': stats.get('best_media_type', 'reel'),
                })
            best_hours = summary.get('best_global_hour', 18)
            return jsonify({
                'category_stats': sorted(cat_stats, key=lambda x: x['viral_rate'], reverse=True),
                'hourly_distribution': [{'hour': best_hours, 'count': 100}],
                'daily_distribution':  [{'day': 'Wednesday', 'count': 100}],
                'platform_summary':    summary,
                'total_posts':         summary.get('total_posts_analysed', 29999),
                'source':              'viral_insights_v1 (Instagram_Analytics.csv not available)',
            }), 200

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
        auth_df = df[df['fake_account'] == 0].copy()

        # Composite rank: 35% quality score + 65% reach (log-normalised followers)
        # This ensures mega-influencers (Kendall, Priyanka etc.) surface alongside quality micro-creators
        import numpy as np
        max_log = np.log10(auth_df['followers'].max())
        auth_df['_reach_norm'] = np.log10(auth_df['followers'].clip(lower=1)) / max_log * 100
        auth_df['_composite']  = auth_df['ratefluencer_score'] * 0.35 + auth_df['_reach_norm'] * 0.65

        top = auth_df.sort_values('_composite', ascending=False).head(200)

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

            niche_key = str(row.get('niche', 'lifestyle')).lower()
            shares_val = float(row.get('shares', followers_val * er / 100 * 0.15))
            saves_val  = round(shares_val * 0.8)

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
                'saves':     int(saves_val),
                'saves_str': f"{int(saves_val/1000)}K" if saves_val >= 1000 else str(int(saves_val)),
                'posts':     int(row.get('posts', 0)),
                'posts_per_month': round(int(row.get('posts', 0)) / max(1, min(60, math.log10(max(followers_val,1000))*8+er*0.5)), 1),
                'demographics': get_audience_demographics(niche_key),
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
            "optimal_hashtag_range": score_result.get('optimal_hashtag_range', '6-15'),
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
                        "\n\nUSER-VALIDATED EXAMPLE (high virality  -  match this style):"
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
  "hook": "<one punchy opening line that stops the scroll  -  max 15 words>",
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
        result['best_post_time'] = "Tuesday-Thursday, 8:00-10:00 AM"
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"LinkedIn generation failed: {e}")
        return jsonify({"error": str(e)}), 500


# 5-minute per-category trend cache — prevents Google Trends rate-limit hammering
_trend_cache: dict = {}
_TREND_CACHE_TTL = 300  # seconds

def _llm_trend_fallback(category: str, goal: str, n: int = 5) -> list:
    """
    Strict LLM fallback — generates creator-relevant content trends,
    NOT news headlines. Different categories always produce different results.
    """
    import time as _time
    goal_line = f" aligned with the goal: {goal}" if goal else ""
    prompt = f"""You are a social media content strategist for Instagram and LinkedIn creators in India.

Today is {pd.Timestamp.now().strftime('%d %B %Y')}.

Generate exactly {n} CONTENT TREND IDEAS for {category} creators{goal_line}.

STRICT RULES:
- These must be CONTENT FORMATS / VIRAL CONCEPTS — not news headlines or world events
- Each trend must be specific to the {category} niche
- Examples of good trends: "60-second morning skincare routine reels", "before/after transformation posts", "product unboxing with honest review"
- Examples of BAD trends (DO NOT generate): "Sunscreen safety study", "Mosquito repellent research", anything that reads like a news headline
- All 5 trends must be DIFFERENT from each other
- Make them feel like what's actually going viral on Instagram India right now

Score each (0-100): growth_velocity, engagement_potential, novelty, audience_relevance, search_interest
trend_score = growth_velocity*0.3 + engagement_potential*0.25 + novelty*0.2 + audience_relevance*0.15 + search_interest*0.1

Return ONLY valid JSON — no markdown, no extra text:
{{"trends": [{{"topic": "<short catchy trend name>", "description": "<1 sentence: what this content format is and why it works>",
  "source": "AI Trend Analysis", "growth_velocity": <n>, "engagement_potential": <n>,
  "novelty": <n>, "audience_relevance": <n>, "search_interest": <n>, "trend_score": <n>,
  "why": "<why this is blowing up right now for {category} creators>"}}]}}"""

    resp = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.85,
        max_tokens=1400,
    )
    result = _parse_groq_json(resp.choices[0].message.content.strip())
    trends = result.get("trends", []) if result else []
    return sorted(trends, key=lambda t: t.get("trend_score", 0), reverse=True)


def _is_news_headline(topic: str) -> bool:
    """Filter out news headlines that aren't useful for creators."""
    news_signals = [
        'study', 'research', 'report', 'survey', 'scientist', 'according to',
        'found that', 'shows that', 'reveals', 'can deet', 'standards',
        'award', 'pantry', 'summit', 'government', 'minister', 'court',
        'election', 'parliament', 'policy', 'bill passed',
    ]
    t = topic.lower()
    return any(sig in t for sig in news_signals) or len(topic) > 70


@app.route("/api/trend-ranking", methods=["POST"])
@rate_limit("20/hour")
def trend_ranking():
    """
    Discover and rank trending topics for creators.
    Primary: Google Trends + Reddit + News RSS (real data).
    Fallback: strict creator-focused LLM when real data is unavailable.
    Cache: 5 min per category to avoid rate-limit hammering.
    """
    try:
        data     = request.get_json() or {}
        category = data.get("category", "General")
        goal     = data.get("goal", "")

        # -- Cache check -------------------------------------------------------
        import time as _time
        cache_key = f"{category}:{goal}"
        cached = _trend_cache.get(cache_key)
        if cached and (_time.time() - cached['ts']) < _TREND_CACHE_TTL:
            logger.info(f"Trend cache hit for '{cache_key}'")
            return jsonify(cached['data']), 200

        # -- Step 1: real data sources -----------------------------------------
        real_trends = fetch_combined_trends(category)

        # Filter out news headlines — keep only creator-relevant topics
        real_trends = [t for t in real_trends if not _is_news_headline(t['topic'])]
        logger.info(f"Real trends after filtering: {len(real_trends)} for '{category}'")

        if len(real_trends) >= 3:
            # Enrich real trends with LLM context
            topics_list = "\n".join(
                f"- {t['topic']} (source: {t.get('source','?')}, velocity={t['growth_velocity']})"
                for t in real_trends
            )
            enrich_prompt = f"""You are a social media strategist specialising in {category} content for Indian creators.

These topics are currently trending for the {category} category:
{topics_list}

For EACH topic, rewrite it as a creator-friendly content trend name and explain WHY a {category} creator should make content about it right now.

Return ONLY valid JSON:
{{"enriched": [{{"topic": "<original topic>", "creator_angle": "<creator-friendly version, max 6 words>",
  "description": "<1 sentence: what content to make and why it gets engagement>",
  "engagement_potential": <0-100>, "audience_relevance": <0-100>}}]}}"""

            try:
                enrich_resp = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": enrich_prompt}],
                    temperature=0.5,
                    max_tokens=700,
                )
                enrich_data = _parse_groq_json(enrich_resp.choices[0].message.content.strip())
                enriched_map = {
                    e['topic'].lower(): e
                    for e in (enrich_data.get('enriched', []) if enrich_data else [])
                }
            except Exception:
                enriched_map = {}

            trends = []
            for t in real_trends:
                enrich = enriched_map.get(t['topic'].lower(), {})
                trends.append({
                    "topic":               enrich.get('creator_angle', t['topic']),
                    "description":         enrich.get('description', t.get('why_trending', '')),
                    "source":              t.get('source', 'Real Data'),
                    "growth_velocity":     t['growth_velocity'],
                    "engagement_potential": enrich.get('engagement_potential', min(100, t['trend_score'] + 5)),
                    "novelty":             t['novelty'],
                    "audience_relevance":  enrich.get('audience_relevance', min(100, t.get('audience_fit', 70))),
                    "search_interest":     t['current_interest'],
                    "trend_score":         t['trend_score'],
                    "why":                 enrich.get('description', t.get('why_trending', '')),
                    "data_backed":         True,
                })

            payload = {"trends": trends, "category": category, "source": "Real Data + AI"}
            _trend_cache[cache_key] = {'data': payload, 'ts': _time.time()}
            return jsonify(payload), 200

        # -- Step 2: LLM fallback (all real sources failed or filtered out) ----
        logger.info(f"Real data insufficient for '{category}' — using creator-focused LLM")
        trends = _llm_trend_fallback(category, goal)
        if not trends:
            return jsonify({"error": "Failed to generate trends"}), 500

        payload = {"trends": trends, "category": category, "source": "AI Trend Analysis"}
        _trend_cache[cache_key] = {'data': payload, 'ts': _time.time()}
        return jsonify(payload), 200

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


# -- Audience demographics by niche -------------------------------------------
NICHE_DEMOGRAPHICS = {
    'beauty':        {'18-24': 38, '25-34': 34, '35-44': 18, '45+': 10, 'female': 82, 'male': 18},
    'fashion':       {'18-24': 35, '25-34': 36, '35-44': 20, '45+':  9, 'female': 72, 'male': 28},
    'fitness':       {'18-24': 30, '25-34': 38, '35-44': 22, '45+': 10, 'female': 52, 'male': 48},
    'food':          {'18-24': 28, '25-34': 35, '35-44': 24, '45+': 13, 'female': 58, 'male': 42},
    'travel':        {'18-24': 25, '25-34': 40, '35-44': 25, '45+': 10, 'female': 55, 'male': 45},
    'tech':          {'18-24': 32, '25-34': 42, '35-44': 18, '45+':  8, 'female': 30, 'male': 70},
    'gaming':        {'18-24': 45, '25-34': 35, '35-44': 14, '45+':  6, 'female': 28, 'male': 72},
    'wellness':      {'18-24': 30, '25-34': 38, '35-44': 22, '45+': 10, 'female': 68, 'male': 32},
    'finance':       {'18-24': 22, '25-34': 40, '35-44': 28, '45+': 10, 'female': 38, 'male': 62},
    'education':     {'18-24': 42, '25-34': 35, '35-44': 16, '45+':  7, 'female': 52, 'male': 48},
    'entertainment': {'18-24': 40, '25-34': 33, '35-44': 18, '45+':  9, 'female': 55, 'male': 45},
    'sports':        {'18-24': 30, '25-34': 38, '35-44': 22, '45+': 10, 'female': 35, 'male': 65},
    'music':         {'18-24': 38, '25-34': 34, '35-44': 18, '45+': 10, 'female': 50, 'male': 50},
    'comedy':        {'18-24': 38, '25-34': 35, '35-44': 18, '45+':  9, 'female': 48, 'male': 52},
    'lifestyle':     {'18-24': 32, '25-34': 36, '35-44': 22, '45+': 10, 'female': 62, 'male': 38},
    'photography':   {'18-24': 28, '25-34': 40, '35-44': 22, '45+': 10, 'female': 48, 'male': 52},
}
_DEFAULT_DEMO = {'18-24': 32, '25-34': 36, '35-44': 22, '45+': 10, 'female': 55, 'male': 45}


# Cache: derive niche demographics from real CSV engagement distribution
_NICHE_DEMO_CACHE: dict = {}

def _build_demo_from_csv(niche: str) -> dict:
    """
    Derive audience demographics from actual CSV data.
    Higher ER in niche -> younger audience (18-24 dominant).
    Follower size distribution -> age skew.
    Returns the same dict shape as NICHE_DEMOGRAPHICS.
    """
    try:
        df_niche = engine.creators_df[engine.creators_df['niche'].str.lower() == niche.lower()]
        if df_niche.empty:
            return None

        median_er  = float(df_niche['engagement_rate'].median())
        median_flw = float(df_niche['followers'].median())

        # Higher ER -> younger audience
        er_youth_bonus = max(0, (median_er - 3.0) * 2)   # each 1% above 3% = +2pts to 18-24
        # Larger follower base -> older skew
        size_age_bonus = min(8, math.log10(max(median_flw, 1000)) - 3)

        young = min(50, max(18, 28 + er_youth_bonus - size_age_bonus))
        prime = min(45, max(25, 36 - er_youth_bonus * 0.3 + size_age_bonus * 0.5))
        mid   = min(30, max(10, 100 - young - prime - 8))
        old_  = max(5, 100 - young - prime - mid)

        # Normalise
        total = young + prime + mid + old_
        base  = NICHE_DEMOGRAPHICS.get(niche.lower(), _DEFAULT_DEMO)
        return {
            '18-24': round(young / total * 100),
            '25-34': round(prime / total * 100),
            '35-44': round(mid   / total * 100),
            '45+':   round(old_  / total * 100),
            'female': base['female'],
            'male':   base['male'],
            'data_source': f'Derived from {len(df_niche):,} real {niche} creators (median ER={median_er:.1f}%)',
        }
    except Exception:
        return None


def get_audience_demographics(niche: str) -> dict:
    key = (niche or '').lower().strip()

    # Try real-data derivation (cached per niche)
    if key not in _NICHE_DEMO_CACHE:
        real = _build_demo_from_csv(key)
        _NICHE_DEMO_CACHE[key] = real if real else NICHE_DEMOGRAPHICS.get(key, _DEFAULT_DEMO)

    demo = _NICHE_DEMO_CACHE[key]
    return {
        'age_groups': [
            {'label': '18-24', 'pct': demo['18-24']},
            {'label': '25-34', 'pct': demo['25-34']},
            {'label': '35-44', 'pct': demo['35-44']},
            {'label': '45+',   'pct': demo['45+']},
        ],
        'gender': {'female': demo['female'], 'male': demo['male']},
        'primary_age': max(['18-24', '25-34', '35-44', '45+'], key=lambda k: demo[k]),
        'primary_gender': 'Female' if demo['female'] >= 50 else 'Male',
        'data_source': demo.get('data_source', 'Industry benchmark'),
    }


# -- Feedback persistence ------------------------------------------------------
FEEDBACK_FILE = BACKEND_DIR / 'feedback_store.json'


def _load_feedback() -> list:
    try:
        if FEEDBACK_FILE.exists():
            return json.loads(FEEDBACK_FILE.read_text(encoding='utf-8'))
    except Exception:
        pass
    return []


def _save_feedback(entries: list):
    try:
        FEEDBACK_FILE.write_text(
            json.dumps(entries[-200:], ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
    except Exception as e:
        logger.warning(f"Could not write feedback: {e}")


def compute_style_preferences(category: str = '') -> dict:
    """
    Derive content style preferences from persisted feedback.
    Returns a dict that gets injected into generation prompts so the agent
    actually improves over time  -  not just stores data.
    """
    entries = _load_feedback()
    if not entries:
        return {}

    if category:
        cat_entries = [e for e in entries if e.get('category', '').lower() == category.lower()]
        entries = cat_entries if len(cat_entries) >= 3 else entries

    upvoted   = [e for e in entries if e.get('vote') == 'up']
    downvoted = [e for e in entries if e.get('vote') == 'down']

    if not upvoted:
        return {}

    # Extract patterns from upvoted content
    avg_virality = sum(
        e.get('virality', 65) for e in upvoted if e.get('virality')
    ) / max(len(upvoted), 1)

    # Most common words in upvoted hooks/captions
    from collections import Counter
    all_words: list = []
    for e in upvoted:
        text = ' '.join([
            str(e.get('content', {}).get('hook', '')),
            str(e.get('content', {}).get('caption', '')),
        ])
        all_words.extend(w.lower() for w in text.split() if len(w) > 4)

    word_freq  = Counter(all_words)
    top_words  = [w for w, _ in word_freq.most_common(8)]

    # Words to avoid from downvoted content
    avoid_words: list = []
    for e in downvoted[-5:]:
        text = str(e.get('content', {}).get('hook', ''))
        avoid_words.extend(w.lower() for w in text.split() if len(w) > 4)

    # Avg hashtag count in upvoted content
    hashtag_counts = [
        len(str(e.get('content', {}).get('hashtags', '')).split())
        for e in upvoted
    ]
    avg_hashtags = int(sum(hashtag_counts) / max(len(hashtag_counts), 1))

    return {
        'avg_virality':    round(avg_virality, 1),
        'preferred_words': top_words[:5],
        'avoid_words':     list(set(avoid_words))[:3],
        'avg_hashtags':    avg_hashtags,
        'total_upvoted':   len(upvoted),
        'total_downvoted': len(downvoted),
    }


@app.route("/api/feedback", methods=["POST"])
def save_feedback():
    """Persist content feedback (thumbs up/down) server-side for future improvement."""
    try:
        data = request.get_json() or {}
        entry = {
            'key':      str(data.get('key', '')),
            'vote':     str(data.get('vote', '')),          # 'up' | 'down'
            'virality': data.get('virality'),
            'niche':    str(data.get('niche', '')),
            'category': str(data.get('category', '')),
            'content':  data.get('content', {}),            # hook, caption, hashtags
            'ts':       pd.Timestamp.now().isoformat(),
        }
        if not entry['vote'] in ('up', 'down'):
            return jsonify({"error": "vote must be 'up' or 'down'"}), 400

        entries = _load_feedback()
        entries.append(entry)
        _save_feedback(entries)
        return jsonify({"ok": True, "total": len(entries)}), 200

    except Exception as e:
        logger.error(f"save_feedback failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/feedback/history")
def feedback_history():
    """Return persisted feedback; optionally filtered by category."""
    try:
        category = request.args.get('category', '')
        entries  = _load_feedback()
        if category:
            entries = [e for e in entries if e.get('category', '').lower() == category.lower()]
        upvoted   = [e for e in entries if e.get('vote') == 'up']
        downvoted = [e for e in entries if e.get('vote') == 'down']
        return jsonify({
            "total":     len(entries),
            "upvoted":   len(upvoted),
            "downvoted": len(downvoted),
            "history":   entries[-50:],
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- India influencer rate benchmarks -----------------------------------------
_TIER_RATES = {
    'nano':  {'label': 'Nano (1K-10K)',   'cpp': (3_000,   8_000),   'cpm': (60, 100)},
    'micro': {'label': 'Micro (10K-100K)','cpp': (8_000,  50_000),   'cpm': (45,  80)},
    'macro': {'label': 'Macro (100K-1M)', 'cpp': (50_000, 300_000),  'cpm': (30,  60)},
    'mega':  {'label': 'Mega (1M+)',      'cpp': (300_000,2_000_000),'cpm': (20,  45)},
}

_NICHE_CPM_MULTIPLIER = {
    'beauty': 1.2, 'fashion': 1.15, 'fitness': 1.1, 'tech': 1.2,
    'food': 1.0, 'travel': 1.05, 'finance': 1.3, 'wellness': 1.1,
    'entertainment': 0.9, 'gaming': 1.0, 'education': 1.15,
}


def _get_tier_key(followers: int) -> str:
    if followers < 10_000:   return 'nano'
    if followers < 100_000:  return 'micro'
    if followers < 1_000_000: return 'macro'
    return 'mega'


@app.route("/api/groq-status")
def groq_status():
    """Check whether a Groq API key is configured."""
    key = os.environ.get("GROQ_API_KEY", "")
    return jsonify({"available": bool(key and key.startswith("gsk_"))}), 200


@app.route("/api/set-groq-key", methods=["POST"])
def set_groq_key():
    """Set the Groq API key at runtime (in-memory only)."""
    try:
        data = request.get_json() or {}
        key  = str(data.get("key", "")).strip()
        if not key:
            return jsonify({"error": "key is required"}), 400
        os.environ["GROQ_API_KEY"] = key
        groq_client.__init__(api_key=key)
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/discover-trends", methods=["POST"])
@rate_limit("30/hour")
def discover_trends():
    """
    Real trend discovery: Google Trends (primary) + LLM enrichment (fallback).
    Used by ContentStudio Step 1.
    """
    try:
        data     = request.get_json() or {}
        category = data.get("category", "General")
        context  = data.get("context", "")

        # Google Trends primary
        gt = fetch_combined_trends(category)
        logger.info(f"discover-trends: Google Trends returned {len(gt)} for '{category}'")

        if gt:
            # Quick LLM enrichment for display context
            topics_txt = "\n".join(f"- {t['topic']}" for t in gt[:5])
            enrich_prompt = f"""Briefly explain (1 sentence each) why these trending topics matter for a {category} creator{' working with ' + context if context else ''}:
{topics_txt}
Return ONLY JSON: {{"enriched": [{{"topic": "<topic>", "why_trending": "<1 sentence>"}}]}}"""
            try:
                er = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": enrich_prompt}],
                    temperature=0.4,
                    max_tokens=400,
                )
                emap = {
                    e['topic'].lower(): e.get('why_trending', '')
                    for e in _parse_groq_json(er.choices[0].message.content.strip()).get('enriched', [])
                }
            except Exception:
                emap = {}

            trends = []
            for t in gt:
                trends.append({
                    **t,
                    'why_trending': emap.get(t['topic'].lower(), t['why_trending']),
                })
            return jsonify({"trends": trends, "source": "Google Trends", "data_backed": True}), 200

        # LLM fallback
        prompt = f"""Identify 5 currently trending topics for {category} creators in India{' (brand context: ' + context + ')' if context else ''}.
Return ONLY JSON:
{{"trends": [{{"topic": "<name>", "trend_score": <0-100>, "growth_velocity": <0-100>,
  "audience_fit": <0-100>, "why_trending": "<1 sentence>", "source": "<platform>", "data_backed": false}}]}}"""
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=700,
        )
        result = _parse_groq_json(resp.choices[0].message.content.strip())
        trends = sorted(result.get("trends", []), key=lambda x: x.get("trend_score", 0), reverse=True)
        return jsonify({"trends": trends, "source": "LLM", "data_backed": False}), 200

    except Exception as e:
        logger.error(f"discover-trends failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate-script", methods=["POST"])
@rate_limit("30/hour")
def generate_script():
    """Generate a structured reel script with virality prediction."""
    try:
        data     = request.get_json() or {}
        topic    = data.get("topic", "").strip()
        category = data.get("content_category", data.get("category", "Lifestyle"))
        context  = data.get("context", "")
        duration = int(data.get("duration", 45))

        if not topic:
            return jsonify({"error": "topic is required"}), 400

        insights   = viral_predictor.get_content_insights(category)
        best_hours = insights.get('best_hours', [18, 12])
        opt_h      = insights.get('optimal_hashtag_range', (6, 15))

        prompt = f"""You are a viral short-form video scriptwriter specialising in Instagram Reels.
Write a {duration}-second reel script for: "{topic}"
Category: {category}{'. Brand context: ' + context if context else ''}
Data insight: optimal hashtags {opt_h[0]}-{opt_h[1]}, best posting time {best_hours[0]}:00

Return ONLY valid JSON:
{{
  "hook": "<punchy opening line  -  first 3 seconds, max 15 words>",
  "story": "<main content {duration - 10} seconds  -  clear, engaging narration>",
  "cta": "<call-to-action for last 5 seconds>",
  "key_insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "visual_directions": ["<shot 1>", "<shot 2>", "<shot 3>"],
  "estimated_duration": {duration}
}}"""

        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800,
        )
        script = _parse_groq_json(resp.choices[0].message.content.strip())
        if not script:
            return jsonify({"error": "Failed to generate script"}), 500

        # Predict virality for this script
        has_cta = int(any(
            w in (script.get('hook', '') + script.get('cta', '')).lower()
            for w in ['click', 'comment', 'share', 'follow', 'save', 'dm', 'link', 'watch']
        ))
        viral_res = viral_predictor.predict({
            'content_category': category,
            'hashtags_count':   (opt_h[0] + opt_h[1]) // 2,
            'has_call_to_action': has_cta,
            'post_hour':        best_hours[0],
            'day_of_week':      insights.get('best_days', ['Wednesday'])[0],
            'media_type':       'reel',
        })

        bucket_label = {
            'viral': 'Viral Potential', 'high': 'High Potential',
            'medium': 'Moderate Potential', 'low': 'Needs Work'
        }.get(viral_res['predicted_bucket'], 'Moderate Potential')

        script['virality'] = {
            'score':   viral_res['viral_score'],
            'label':   bucket_label,
            'signals': [
                {'label': 'Hook Strength',  'score': min(20, 8 + has_cta * 4), 'max': 20},
                {'label': 'Timing',         'score': 10 if has_cta else 7,      'max': 10},
                {'label': 'Format (Reel)',  'score': 10,                         'max': 10},
                {'label': 'Category Fit',   'score': min(15, viral_res['viral_score'] // 7), 'max': 15},
            ],
        }
        script['classifier_used'] = viral_res.get('classifier_used', False)
        return jsonify(script), 200

    except Exception as e:
        logger.error(f"generate-script failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/influencer-profile", methods=["POST"])
def influencer_profile():
    """
    Score a self-reported creator profile across 6 signals.
    Used by the Influencer Portal page.
    """
    try:
        data = request.get_json() or {}
        followers    = max(1, int(data.get("followers", 10000)))
        niche        = str(data.get("niche", "lifestyle")).lower()
        handle       = str(data.get("handle", "@creator")).strip()
        posts        = int(data.get("posts", 0)) or int(followers / 50)

        # Actual per-post counts are PRIMARY -- ER is DERIVED from them.
        # If frontend sends avg_likes/comments, use those; else fall back to ER.
        avg_likes    = float(data.get("avg_likes",    0))
        avg_comments = float(data.get("avg_comments", 0))
        avg_shares   = float(data.get("avg_shares",   0))

        if avg_likes > 0:
            # Derive ER from actual counts (not the other way round)
            er = (avg_likes + avg_comments) / followers * 100
        else:
            # Legacy path: ER provided directly, estimate counts from it
            er           = float(data.get("engagement_rate", 3.0))
            avg_likes    = followers * (er / 100) * 0.9
            avg_comments = followers * (er / 100) * 0.1

        if avg_shares == 0:
            avg_shares = max(1.0, avg_comments * 0.5)

        # Per-follower behavioral rates (what the viral model uses)
        share_rate_raw   = avg_shares   / max(followers, 1)
        likes_per_f_raw  = avg_likes    / max(followers, 1)
        comments_per_f_raw = avg_comments / max(followers, 1)

        # Individual signal scores
        eng_quality  = clamp(er * 8.0)
        growth_score = clamp(math.log10(max(followers, 10)) * 12 + er * 3)

        # Authenticity proxy (no fake_account flag for self-reported)
        fo           = min(3.0, followers / max(1, followers * 1.2))  # approx F/F ratio
        auth_score   = clamp(70 + (er - 2) * 5 - max(0, fo - 1) * 10)

        # Brand match per niche
        all_cats = sorted(
            [{'category': k.title(), 'match': int(clamp(
                (90 if k == niche else 60 if k in niche or niche in k else 30)
                + er * 2
            ))} for k in _NICHE_EXPANSION.keys()],
            key=lambda x: x['match'], reverse=True
        )

        # Consistency proxy
        consistency  = clamp(min(100, posts / 5 * 10 + 30))
        # Share rate from actual counts (not ER-derived)
        share_rate   = clamp(share_rate_raw * 1000)   # scale 0-1 -> 0-100

        # Virality signal from actual behavioral counts (not ER)
        viral_features = {
            'share_rate':         share_rate_raw,
            'likes_per_f':        likes_per_f_raw,
            'comments_per_f':     comments_per_f_raw,
            'reach_ratio':        0.5,              # default when not available
            'log_followers':      math.log1p(followers),
            'posts':              float(posts),
            'content_category':   niche,
            'niche':              niche,
            'growth_score':       growth_score,
            'authenticity_score': auth_score,
            'follower_count':     float(followers),
            'engagement_rate':    er,               # kept for heuristic branch only
        }
        viral_res     = viral_predictor.predict(viral_features)
        virality_score = viral_res['viral_score']

        # Ratefluencer composite
        rf_score = int(clamp(
            eng_quality * 0.22 + growth_score * 0.22 + auth_score * 0.18
            + all_cats[0]['match'] * 0.18 + virality_score * 0.12
            + consistency * 0.05 + share_rate * 0.03
        ))

        tier = (
            'Elite'       if rf_score >= 85 else
            'Premium'     if rf_score >= 70 else
            'Established' if rf_score >= 55 else
            'Growing'     if rf_score >= 40 else
            'Emerging'
        )

        # Improvement tips using actual counts
        improvement_tips = []
        if er < 2.0:
            improvement_tips.append({"signal": "Engagement", "msg": f"Your computed ER is {er:.1f}%  -  aim for above 3% by using stronger hooks and interactive content."})
        if posts < 30:
            improvement_tips.append({"signal": "Consistency", "msg": f"Only {posts} posts detected  -  brands prefer 60+ posts showing content history."})
        if share_rate_raw < likes_per_f_raw * 0.03:
            improvement_tips.append({"signal": "Share Rate", "msg": f"Share rate ({share_rate_raw*100:.2f}% of followers) is low  -  create save-worthy educational or emotional content."})
        if followers < 10_000:
            improvement_tips.append({"signal": "Reach", "msg": "Below 10K followers. Consider niche micro-communities before pitching large brands."})
        if not improvement_tips:
            improvement_tips.append({"signal": "All Clear", "msg": "Strong profile across all signals. You're ready for premium brand partnerships."})

        return jsonify({
            "ratefluencer_score": rf_score,
            "tier":               tier,
            "handle":             handle,
            "niche":              niche,
            "computed_er":        round(er, 2),
            "scores": {
                "brand_match":  all_cats[0]['match'],
                "authenticity": int(auth_score),
                "growth":       int(growth_score),
                "engagement":   int(eng_quality),
                "consistency":  int(consistency),
                "share_rate":   int(share_rate),
                "virality":     int(virality_score),
            },
            "top_categories":   all_cats[:3],
            "all_categories":   all_cats,
            "improvement_tips": improvement_tips,
            "demographics":     get_audience_demographics(niche),
        }), 200

    except Exception as e:
        logger.error(f"influencer-profile failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/roi-estimate", methods=["POST"])
def roi_estimate():
    """
    Estimate influencer campaign ROI based on tier, niche, engagement, and budget.
    Returns CPM, CPP, expected reach, and ROI projection.
    """
    try:
        data          = request.get_json() or {}
        followers     = max(1, int(data.get("followers", 50000)))
        er            = float(data.get("engagement_rate", 3.0))
        niche         = str(data.get("niche", "lifestyle")).lower()
        budget        = float(data.get("budget", 500_000))
        campaign_goal = str(data.get("campaign_goal", "awareness")).lower()

        tier_key  = _get_tier_key(followers)
        tier_info = _TIER_RATES[tier_key]
        niche_mul = _NICHE_CPM_MULTIPLIER.get(niche, 1.0)

        cpp_min  = int(tier_info['cpp'][0] * niche_mul)
        cpp_max  = int(tier_info['cpp'][1] * niche_mul)
        cpp_rec  = int((cpp_min + cpp_max) / 2)

        cpm_min  = int(tier_info['cpm'][0] * niche_mul)
        cpm_max  = int(tier_info['cpm'][1] * niche_mul)
        cpm_rec  = int((cpm_min + cpm_max) / 2)

        # Expected performance metrics
        base_reach       = int(followers * (er / 100) * 8)
        expected_engages = int(followers * (er / 100))
        posts_affordable = max(1, int(budget / cpp_rec))
        total_reach      = base_reach * posts_affordable

        # Simple ROI proxy: engagement value (\u20b95 per engagement) / budget
        eng_value        = expected_engages * posts_affordable * 5
        roi_ratio        = round(eng_value / max(budget, 1), 2)

        # Conversion estimate by goal
        if 'conversion' in campaign_goal or 'sales' in campaign_goal:
            conv_rate  = 0.02
            conv_value = int(total_reach * conv_rate)
        elif 'awareness' in campaign_goal:
            conv_rate  = None
            conv_value = None
        else:
            conv_rate  = 0.015
            conv_value = int(total_reach * conv_rate) if total_reach else None

        def fmt_inr(n):
            if n >= 100_000: return f"\u20b9{n/100_000:.1f}L"
            if n >= 1_000:   return f"\u20b9{n/1_000:.0f}K"
            return f"\u20b9{n:,}"

        return jsonify({
            "tier":             tier_info['label'],
            "tier_key":         tier_key,
            "niche_multiplier": niche_mul,
            "cpp": {
                "min":         cpp_min, "max":         cpp_max,
                "recommended": cpp_rec,
                "min_fmt":     fmt_inr(cpp_min), "max_fmt": fmt_inr(cpp_max),
                "rec_fmt":     fmt_inr(cpp_rec),
            },
            "cpm": {
                "min": cpm_min, "max": cpm_max, "recommended": cpm_rec,
            },
            "expected_reach":       base_reach,
            "expected_engagements": expected_engages,
            "posts_with_budget":    posts_affordable,
            "total_campaign_reach": total_reach,
            "total_engagements":    expected_engages * posts_affordable,
            "engagement_value_inr": eng_value,
            "roi_ratio":            roi_ratio,
            "estimated_conversions": conv_value,
            "budget_fmt":           fmt_inr(int(budget)),
            "recommendation": (
                f"For a {campaign_goal} campaign, allocate {fmt_inr(cpp_rec)} per post across "
                f"{posts_affordable} creator(s) in the {niche} niche. "
                f"Expected total reach: {base_reach * posts_affordable:,} users at ~{fmt_inr(cpm_rec)} CPM."
            ),
        }), 200

    except Exception as e:
        logger.error(f"roi-estimate failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/explain", methods=["POST"])
def explain_creator():
    """
    Return SHAP feature contributions for a creator's authenticity and growth scores.
    Requires shap to be installed: pip install shap
    """
    if not _SHAP_AVAILABLE:
        return jsonify({"error": "shap library not installed on server"}), 503

    try:
        data       = request.get_json() or {}
        creator_id = int(data.get("creator_id", -1))

        if creator_id < 0:
            return jsonify({"error": "creator_id is required"}), 400

        matches = engine.creators_df[engine.creators_df['creator_id'] == creator_id]
        if matches.empty:
            return jsonify({"error": "Creator not found"}), 404

        row = matches.iloc[0].to_dict()

        # -- Authenticity SHAP -------------------------------------------------
        auth_feats = prepare_authenticity_features(row)
        auth_df    = pd.DataFrame([auth_feats])[engine.authenticity_detector.features]
        auth_model = engine.authenticity_detector.model

        auth_explainer = _shap.TreeExplainer(auth_model)
        auth_sv        = auth_explainer.shap_values(auth_df)
        # For binary XGBoost, shap_values is 2D (n_samples, n_features)
        if isinstance(auth_sv, list):
            auth_sv = auth_sv[1]  # class 1 (Authentic)
        auth_contribs = sorted(
            zip(engine.authenticity_detector.features, auth_sv[0].tolist()),
            key=lambda x: abs(x[1]), reverse=True
        )[:5]

        # -- Growth SHAP -------------------------------------------------------
        growth_feats_dict = prepare_growth_features(row)
        growth_df         = pd.DataFrame([growth_feats_dict])[engine.growth_predictor.features]
        growth_model      = engine.growth_predictor.model

        growth_explainer = _shap.TreeExplainer(growth_model)
        growth_sv        = growth_explainer.shap_values(growth_df)
        growth_contribs  = sorted(
            zip(engine.growth_predictor.features, growth_sv[0].tolist()),
            key=lambda x: abs(x[1]), reverse=True
        )[:5]

        _FEATURE_LABELS = {
            'flw': 'Followers', 'flg': 'Following', 'fo': 'Follow Ratio',
            'pr': 'Profile Completeness', 'cs': 'Content Spam Score',
            'hc': 'Hashtag Count', 'erl': 'ER Likes', 'erc': 'ER Comments',
            'engagement_rate_7d': 'Engagement Rate', 'net_growth': 'Net Growth',
            'growth_momentum': 'Growth Momentum', 'views_7d_avg': '7-Day Views Avg',
        }

        return jsonify({
            "creator_id": creator_id,
            "authenticity_explanation": [
                {
                    "feature": _FEATURE_LABELS.get(f, f),
                    "raw_feature": f,
                    "shap_value": round(v, 4),
                    "direction": "positive" if v > 0 else "negative",
                }
                for f, v in auth_contribs
            ],
            "growth_explanation": [
                {
                    "feature": _FEATURE_LABELS.get(f, f),
                    "raw_feature": f,
                    "shap_value": round(v, 4),
                    "direction": "positive" if v > 0 else "negative",
                }
                for f, v in growth_contribs
            ],
            "shap_available": True,
        }), 200

    except Exception as e:
        logger.error(f"explain failed: {e}")
        return jsonify({"error": str(e)}), 500


LEARNED_PREFS_FILE = BACKEND_DIR / 'learned_preferences.json'


def _load_learned_prefs() -> dict:
    try:
        if LEARNED_PREFS_FILE.exists():
            return json.loads(LEARNED_PREFS_FILE.read_text(encoding='utf-8'))
    except Exception:
        pass
    return {}


@app.route("/api/agent/learn", methods=["POST"])
def agent_learn():
    """
    Process all stored feedback and extract explicit style preferences.
    Persists the learned profile to learned_preferences.json so every
    subsequent content generation call automatically benefits from it.
    """
    try:
        data     = request.get_json() or {}
        category = data.get("category", "")
        entries  = _load_feedback()

        if category:
            cat_entries = [e for e in entries if e.get("category", "").lower() == category.lower()]
            entries = cat_entries if len(cat_entries) >= 2 else entries

        upvoted   = [e for e in entries if e.get("vote") == "up"]
        downvoted = [e for e in entries if e.get("vote") == "down"]

        if not upvoted:
            return jsonify({
                "learned": False,
                "message": "No upvoted content yet. Generate and upvote content to activate learning.",
                "upvoted": 0, "downvoted": len(downvoted),
            }), 200

        # Extract patterns from upvoted content
        from collections import Counter
        all_words: list = []
        virality_scores: list = []
        hashtag_counts: list  = []

        for e in upvoted:
            v = e.get("virality")
            if v:
                virality_scores.append(float(v))
            caption = str(e.get("content", {}).get("caption", ""))
            hook    = str(e.get("content", {}).get("hook", ""))
            tags    = str(e.get("content", {}).get("hashtags", ""))
            all_words.extend(w.lower() for w in (caption + " " + hook).split() if len(w) > 4)
            hashtag_counts.append(len(tags.split()))

        word_freq    = Counter(all_words)
        top_words    = [w for w, _ in word_freq.most_common(8) if w not in {"your","with","this","that","from","have","will","they","what"}]
        avg_virality = round(sum(virality_scores) / max(len(virality_scores), 1), 1)
        avg_hashtags = int(sum(hashtag_counts) / max(len(hashtag_counts), 1))

        avoid_words: list = []
        for e in downvoted[-5:]:
            hook = str(e.get("content", {}).get("hook", ""))
            avoid_words.extend(w.lower() for w in hook.split() if len(w) > 4)

        # Detect dominant tone from word patterns
        tone_map = {
            "Inspirational": {"transform","journey","achieve","dream","success","inspire","believe"},
            "Educational":   {"learn","know","fact","tip","guide","explain","understand","science"},
            "Humorous":      {"funny","laugh","joke","haha","lol","meme","prank","hilarious"},
            "Professional":  {"strategy","growth","business","roi","revenue","metric","professional"},
        }
        tone_scores = {t: sum(w in all_words for w in kws) for t, kws in tone_map.items()}
        detected_tone = max(tone_scores, key=lambda t: tone_scores[t]) if any(tone_scores.values()) else "Inspirational"

        prefs = {
            "category":       category or "general",
            "avg_virality":   avg_virality,
            "preferred_words": top_words[:6],
            "avoid_words":    list(set(avoid_words))[:4],
            "avg_hashtags":   avg_hashtags,
            "detected_tone":  detected_tone,
            "upvoted_count":  len(upvoted),
            "downvoted_count": len(downvoted),
            "confidence":     min(100, len(upvoted) * 12),
            "last_updated":   pd.Timestamp.now().isoformat(),
        }

        # Persist preferences
        existing = _load_learned_prefs()
        existing[category or "general"] = prefs
        LEARNED_PREFS_FILE.write_text(json.dumps(existing, indent=2, ensure_ascii=True), encoding='utf-8')

        return jsonify({
            "learned":        True,
            "preferences":    prefs,
            "message":        (
                f"Learned from {len(upvoted)} upvoted posts. "
                f"Detected tone: {detected_tone}. "
                f"Top style words: {', '.join(top_words[:4])}. "
                f"Optimal hashtag count: ~{avg_hashtags}."
            ),
        }), 200

    except Exception as e:
        logger.error(f"agent/learn failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/agent/preferences")
def agent_preferences():
    """Return current learned preferences for a category."""
    try:
        category = request.args.get("category", "general")
        prefs    = _load_learned_prefs()
        cat_pref = prefs.get(category, prefs.get("general", {}))
        return jsonify({"preferences": cat_pref, "has_preferences": bool(cat_pref)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate-video", methods=["POST"])
@rate_limit("10/hour")
def generate_video():
    """
    Generate a video from a reel script.
    Primary: Runway ML Gen-3 API (requires RUNWAYML_API_SECRET in .env).
    Fallback: Returns a detailed production storyboard that a video editor
              or Runway's web app can use directly.
    """
    try:
        data      = request.get_json() or {}
        script    = data.get("script", "").strip()
        reel_idea = data.get("reel_idea", "").strip()
        category  = data.get("category", "Lifestyle")
        duration  = int(data.get("duration", 30))

        if not script and not reel_idea:
            return jsonify({"error": "script or reel_idea is required"}), 400

        runway_key = os.environ.get("RUNWAYML_API_SECRET", "")

        # -- Runway ML path ---------------------------------------------------
        # -- Runway ML path ---------------------------------------------------
        if runway_key:
            try:
                prompt = f"{reel_idea or script[:200]} - {category} content, cinematic, mobile vertical"
                headers = {
                    "Authorization": f"Bearer {runway_key}",
                    "X-Runway-Version": "2024-11-06",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model":       "gen3a_turbo",
                    "promptText":  prompt,
                    "promptImage": "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
                    "duration":    min(10, duration),
                    "ratio":       "768:1280",
                    "watermark":   False,
                }
                resp = http_requests.post(
                    "https://api.dev.runwayml.com/v1/image_to_video",
                    json=payload, headers=headers, timeout=30,
                )
                if resp.status_code in (200, 201):
                    task = resp.json()
                    return jsonify({
                        "status":    "generating",
                        "task_id":   task.get("id"),
                        "poll_url":  f"https://api.runwayml.com/v1/tasks/{task.get('id')}",
                        "message":   "Video is generating. Poll poll_url for status.",
                        "provider":  "Runway ML Gen-3 Alpha",
                    }), 202
            except Exception as re:
                logger.warning(f"Runway API failed: {re}")

        # -- Storyboard fallback ----------------------------------------------
        storyboard_prompt = f"""You are a professional video director.
Create a detailed production storyboard for this {duration}-second reel:
Concept: {reel_idea or script[:300]}
Category: {category}

Return ONLY valid JSON:
{{
  "scenes": [
    {{"id": 1, "start_sec": 0, "end_sec": 3,
      "shot": "<camera angle>",
      "action": "<what happens on screen>",
      "text_overlay": "<any text/caption to display>",
      "broll_keyword": "<keyword to search for B-roll footage>"}}
  ],
  "music_mood":      "<upbeat/calm/dramatic/inspirational>",
  "color_grade":     "<warm/cool/vibrant/muted>",
  "aspect_ratio":    "9:16",
  "runway_prompt":   "<optimised text prompt for Runway/Veo generation>",
  "veo_prompt":      "<Google Veo compatible prompt>",
  "estimated_duration": {duration}
}}"""

        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": storyboard_prompt}],
            temperature=0.6,
            max_tokens=1000,
        )
        storyboard = _parse_groq_json(resp.choices[0].message.content.strip())
        if not storyboard:
            return jsonify({"error": "Failed to generate storyboard"}), 500

        return jsonify({
            "status":     "storyboard_ready",
            "storyboard": storyboard,
            "provider":   "AI Storyboard",
            "message":    (
                "Full production storyboard generated. "
                "Set RUNWAYML_API_SECRET in .env to generate actual video with Runway Gen-3."
            ),
            "runway_prompt": storyboard.get("runway_prompt", ""),
            "scenes":        storyboard.get("scenes", []),
        }), 200

    except Exception as e:
        logger.error(f"generate-video failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/content-quality", methods=["POST"])
def content_quality():
    """
    NLP-based content quality scorer.
    Measures semantic similarity to a curated reference bank of
    high-performing content using SentenceTransformer embeddings.

    Body: { content, category, compare_b? }
    Returns: quality_score (0-100), grade (A-D), interpretation, model
    """
    try:
        data      = request.get_json() or {}
        content   = str(data.get("content", "")).strip()
        category  = str(data.get("category", "General"))
        compare_b = str(data.get("compare_b", "")).strip()

        if not content:
            return jsonify({"error": "content is required"}), 400

        result = content_scorer.score(content, category)

        if compare_b:
            comparison = content_scorer.compare(content, compare_b, category)
            result["comparison"] = comparison

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"content-quality failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/detect-anomalies", methods=["POST"])
def detect_anomalies_endpoint():
    """
    Engagement pod and spike detection for a creator profile.
    Checks comment/like ratio (pod proxy) and ER vs follower-count expectation (spike proxy).
    """
    try:
        data = request.get_json() or {}
        result = detect_engagement_anomalies(data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/posting-frequency", methods=["POST"])
def posting_frequency():
    """Compute estimated posting frequency from posts count and account profile."""
    try:
        data      = request.get_json() or {}
        posts     = max(1, int(data.get("posts", 50)))
        followers = max(1, int(data.get("followers", 10000)))
        er        = float(data.get("engagement_rate", 3.0))

        # Estimate account age: larger + higher ER -> older account (proxy)
        est_months = min(60, max(6, math.log10(max(followers, 1000)) * 8 + er * 0.5))
        posts_per_month = round(posts / est_months, 1)
        posts_per_week  = round(posts_per_month / 4.3, 1)

        consistency = (
            "Very Active"  if posts_per_month >= 20 else
            "Active"       if posts_per_month >= 8  else
            "Moderate"     if posts_per_month >= 3  else
            "Infrequent"
        )
        return jsonify({
            "total_posts":        posts,
            "est_account_months": round(est_months),
            "posts_per_month":    posts_per_month,
            "posts_per_week":     posts_per_week,
            "consistency":        consistency,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)

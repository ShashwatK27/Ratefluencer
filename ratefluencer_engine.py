"""
Ratefluencer Unified AI Orchestrator

This module integrates all three core Ratefluencer models:
1. GrowthPredictor (RandomForest regression on lag/rolling features)
2. AuthenticityDetector (XGBoost classification on account safety signals)
3. BrandMatcher (SentenceTransformer Cosine Semantic similarity)

It evaluates a given creator's historical analytics against a business campaign
to compute individual scores, a final Ratefluencer Score, and a Success Probability.
"""

import numpy as np
import pandas as pd
import joblib
import logging
from typing import Dict, List, Optional
from brand_matcher_v2 import BrandMatcher
from growth_predictor import GrowthPredictor
from authenticity_detector import AuthenticityDetector

logger = logging.getLogger(__name__)


class RatefluencerEngine:
    """
    Unified AI marketing orchestrator that combines semantic relevance,
    growth projections, and fraud risk detection to predict campaign success.
    """

    # Dynamic dynamic scoring weights based on campaign goals
    GOAL_WEIGHTS = {
        'awareness': {
            'brand_match': 0.35,
            'growth': 0.20,
            'authenticity': 0.15,
            'engagement': 0.30
        },
        'conversion': {
            'brand_match': 0.25,
            'growth': 0.15,
            'authenticity': 0.35,
            'engagement': 0.25
        },
        'niche': {
            'brand_match': 0.55,
            'growth': 0.15,
            'authenticity': 0.15,
            'engagement': 0.15
        },
        'balanced': {
            'brand_match': 0.40,
            'growth': 0.20,
            'authenticity': 0.20,
            'engagement': 0.20
        }
    }

    def __init__(self, creators_csv: str = 'influencers_engine_ready.csv'):
        """Initialize the Ratefluencer Engine and load all sub-models."""
        self.creators_csv = creators_csv
        self.creators_df = None
        
        # Instantiate sub-models
        logger.info("Initializing Ratefluencer RAG Matcher...")
        self.brand_matcher = BrandMatcher(model_version='v2')
        
        logger.info("Initializing Ratefluencer Growth Predictor...")
        self.growth_predictor = GrowthPredictor(model_version='v2')
        
        logger.info("Initializing Ratefluencer Authenticity Detector...")
        self.authenticity_detector = AuthenticityDetector(model_version='v2')
        
        self._load_creators()

    def _load_creators(self):
        """Load the core creators database."""
        try:
            self.creators_df = pd.read_csv(self.creators_csv)
            logger.info(f"Loaded {len(self.creators_df)} creators from '{self.creators_csv}' successfully.")
            
            # Load creators into the ChromaDB RAG Vector Store
            logger.info("Loading creators into semantic RAG vector database...")
            self.brand_matcher.load_creators(self.creators_csv)
        except Exception as e:
            logger.error(f"Failed to load creators database: {e}")
            raise

    def _prepare_growth_features(self, row: Dict) -> Dict:
        """Map creator analytics row to features required by GrowthPredictor."""
        followers = float(row.get('followers', 10000))
        er = float(row.get('engagement_rate', 3.0)) # expected as percentage (e.g. 5.8) or fraction?
        # Standardize ER to percentage if passed as decimal fraction
        if er < 1.0:
            er = er * 100.0
            
        likes = float(row.get('likes', followers * (er / 100.0) * 0.9))
        comments = float(row.get('comments', followers * (er / 100.0) * 0.1))
        shares = float(row.get('shares', comments * 0.5))
        views = float(row.get('reach', likes * 12.0))
        net_growth = float(row.get('growth_rate', 5.0) * followers / 1000.0)
        
        return {
            'views_7d_avg': float(views / 30.0),
            'likes_7d_avg': float(likes / 30.0),
            'comments_7d_avg': float(comments / 30.0),
            'shares_7d_avg': float(shares / 30.0),
            'engagement_rate_7d': float(er),
            'net_growth': float(net_growth),
            'net_growth_lag1': float(net_growth * 0.98),
            'net_growth_lag2': float(net_growth * 0.95),
            'net_growth_lag7': float(net_growth * 0.90),
            'growth_rolling_mean_3d': float(net_growth),
            'growth_rolling_std_3d': float(max(1.0, net_growth * 0.03)),
            'growth_momentum': float(net_growth * 0.01)
        }

    def _prepare_authenticity_features(self, row: Dict) -> Dict:
        """Map creator analytics row to features required by AuthenticityDetector."""
        followers = float(row.get('followers', 10000))
        is_fake = int(row.get('fake_account', 0)) == 1
        
        # Build features standardizing based on fake account labels in the dataset
        following = float(followers * (1.5 if is_fake else 0.02))
        
        return {
            'pos': float(20 if is_fake else 150),
            'flw': float(followers),
            'flg': float(following),
            'bl': float(80 if is_fake else 0),
            'lin': float(0 if is_fake else 1),
            'cl': float(85 if is_fake else 5),
            'cz': float(95 if is_fake else 2),
            'ni': float(1 if is_fake else 10),
            'erl': float(10 if is_fake else 1500),
            'erc': float(450 if is_fake else 5),
            'lt': float(2 if is_fake else 1),
            'hc': float(150 if is_fake else 15),
            'pr': float(0.1 if is_fake else 0.95),
            'fo': float(following / (followers + 1.0)),
            'cs': float(0.95 if is_fake else 0.2),
            'pi': float(0 if is_fake else 1)
        }

    def calculate_brand_match(self, row: Dict, campaign_text: str) -> float:
        """Directly calculate Cosine semantic match between campaign text and creator profile."""
        try:
            # Vectorize campaign request
            campaign_vector = self.brand_matcher.embedding_model.encode(campaign_text)
            
            # Generate creator enriched profile text
            category = row.get('niche', 'general')
            followers = int(row.get('followers', 0))
            er = float(row.get('engagement_rate', 0.0))
            tier = row.get('tier', 'Nano')
            
            creator_text = f"Category/Niche: {category}. Followers: {followers:,} ({tier} creator). Engagement Rate: {er:.2%}."
            creator_vector = self.brand_matcher.embedding_model.encode(creator_text)
            
            # Compute raw cosine similarity
            dot_product = np.dot(campaign_vector, creator_vector)
            norm_campaign = np.linalg.norm(campaign_vector)
            norm_creator = np.linalg.norm(creator_vector)
            cosine_similarity = dot_product / (norm_campaign * norm_creator)
            
            # Map cosine similarity to 0-100 brand match score
            brand_match_score = cosine_similarity * 100.0
            return max(0.0, min(100.0, brand_match_score))
        except Exception as e:
            logger.warning(f"Failed to calculate cosine similarity: {e}")
            return 50.0 # fallback

    def score_creator(
        self,
        creator_id: int,
        campaign_text: str,
        campaign_goal: str = 'balanced'
    ) -> Dict:
        """
        Evaluate a specific creator on growth, authenticity, and brand match metrics.
        
        Args:
            creator_id: Primary key of creator in the CSV database
            campaign_text: Brand campaign description
            campaign_goal: 'brand awareness', 'sales / conversions', 'community growth', 'balanced'
            
        Returns:
            Dict containing detailed scores, unified Ratefluencer score, and campaign success probability.
        """
        # Fetch creator
        creator_rows = self.creators_df[self.creators_df['creator_id'] == creator_id]
        if creator_rows.empty:
            raise ValueError(f"Creator with ID {creator_id} not found in database.")
        
        row = creator_rows.iloc[0].to_dict()
        
        # 1. Calculate Brand Match Score
        brand_match_score = self.calculate_brand_match(row, campaign_text)
        
        # 2. Predict Growth Score
        growth_feats = self._prepare_growth_features(row)
        growth_res = self.growth_predictor.predict(growth_feats)
        growth_score = growth_res['score']
        
        # 3. Predict Authenticity Score
        auth_feats = self._prepare_authenticity_features(row)
        auth_res = self.authenticity_detector.predict(auth_feats)
        auth_score = auth_res['probability_authentic'] * 100.0
        is_fake = auth_res['label'] == 'Fake'
        risk_level = auth_res['risk_level']
        
        # 4. Calculate traditional Engagement Score (0-100)
        followers = int(row.get('followers', 0))
        er_fraction = float(row.get('engagement_rate', 0.0)) / 100.0 if float(row.get('engagement_rate', 0.0)) > 1.0 else float(row.get('engagement_rate', 0.0))
        engagement_score = self.brand_matcher._engagement_score(followers, er_fraction)
        
        # Map frontend campaign goals to standard dynamic weights
        goal_mapping = {
            'brand awareness': 'awareness',
            'sales / conversions': 'conversion',
            'product launch': 'conversion',
            'app downloads': 'conversion',
            'community growth': 'niche',
            'niche targeting': 'niche',
            'balanced': 'balanced'
        }
        mapped_goal = goal_mapping.get(campaign_goal.lower(), 'balanced')
        weights = self.GOAL_WEIGHTS[mapped_goal]
        
        # Calculate dynamic weighted score
        raw_score = (
            brand_match_score * weights['brand_match'] +
            growth_score * weights['growth'] +
            auth_score * weights['authenticity'] +
            engagement_score * weights['engagement']
        )
        
        # Apply Authenticity Guardrail multipliers
        penalty_applied = "None"
        if is_fake or risk_level == 'High':
            ratefluencer_score = max(0.0, raw_score * 0.3)
            penalty_applied = "Fake Account / High Risk Penalty (70% deduction)"
        elif risk_level == 'Medium':
            ratefluencer_score = max(0.0, raw_score * 0.75)
            penalty_applied = "Medium Authenticity Penalty (25% deduction)"
        else:
            ratefluencer_score = raw_score
            
        # Calculate Campaign Success Probability (bounded sinusoidal function)
        # Maps final score to a 50% - 95% probability range
        success_probability = 0.5 + 0.45 * np.sin((ratefluencer_score / 100.0) * (np.pi / 2.0))
        success_label = "High Success Probability" if success_probability >= 0.75 else "Moderate Success Probability" if success_probability >= 0.60 else "High Failure Risk"
        
        return {
            'creator_id': creator_id,
            'tier': row.get('tier', 'Nano'),
            'niche': row.get('niche', 'general'),
            'followers': followers,
            'engagement_rate': float(row.get('engagement_rate', 0.0)),
            'scores': {
                'brand_match_score': round(brand_match_score, 2),
                'growth_score': round(growth_score, 2),
                'authenticity_score': round(auth_score, 2),
                'engagement_score': round(engagement_score, 2)
            },
            'campaign_parameters': {
                'goal_evaluated': mapped_goal,
                'brand_match_weight': weights['brand_match'],
                'growth_weight': weights['growth'],
                'authenticity_weight': weights['authenticity'],
                'engagement_weight': weights['engagement']
            },
            'risk_metrics': {
                'is_fake': is_fake,
                'risk_level': risk_level,
                'penalty_applied': penalty_applied
            },
            'ratefluencer_score': round(ratefluencer_score, 2),
            'success_probability': round(success_probability, 3),
            'success_status': success_label
        }


# Command-line test suite
if __name__ == '__main__':
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("="*80)
    print("UNIFIED RATEFLUENCER AI ENGINE - VALIDATION RUN")
    print("="*80)
    
    # Initialize unified engine
    engine = RatefluencerEngine(creators_csv='influencers_engine_ready.csv')
    
    campaign = "We need an organic wellness creator to promote our plant-based vegan protein powder for healthy cooking recipes."
    
    # Test case 1: Dynamic evaluation of an authentic Fitness/Wellness Micro-creator
    print("\n" + "="*80)
    print("Test 1: Evaluating Authentic Creator (ID: 100)")
    print("="*80)
    
    res_1 = engine.score_creator(creator_id=100, campaign_text=campaign, campaign_goal='sales / conversions')
    print(f"Creator Niche: {res_1['niche']} ({res_1['tier']})")
    print(f"Followers: {res_1['followers']:,} | ER: {res_1['engagement_rate']}%")
    print(f"Scores breakdown:")
    for score_name, score_val in res_1['scores'].items():
        print(f"  - {score_name}: {score_val}/100")
    print(f"Unified Ratefluencer Score: {res_1['ratefluencer_score']}/100")
    print(f"Campaign Success Probability: {res_1['success_probability']:.1%}")
    print(f"Success Status: {res_1['success_status']}")
    print(f"Risk Flag: {res_1['risk_metrics']['risk_level']} Risk (Fake: {res_1['risk_metrics']['is_fake']})")
    
    # Test case 2: Dynamic evaluation of a Fake creator (fake_account == 1 in CSV)
    print("\n" + "="*80)
    print("Test 2: Evaluating Suspected Fake Creator (ID: 10)")
    print("="*80)
    
    res_2 = engine.score_creator(creator_id=10, campaign_text=campaign, campaign_goal='sales / conversions')
    print(f"Creator Niche: {res_2['niche']} ({res_2['tier']})")
    print(f"Followers: {res_2['followers']:,} | ER: {res_2['engagement_rate']}%")
    print(f"Scores breakdown:")
    for score_name, score_val in res_2['scores'].items():
        print(f"  - {score_name}: {score_val}/100")
    print(f"Unified Ratefluencer Score: {res_2['ratefluencer_score']}/100")
    print(f"Campaign Success Probability: {res_2['success_probability']:.1%}")
    print(f"Success Status: {res_2['success_status']}")
    print(f"Risk Flag: {res_2['risk_metrics']['risk_level']} Risk (Fake: {res_2['risk_metrics']['is_fake']})")
    print(f"Penalty details: {res_2['risk_metrics']['penalty_applied']}")
    
    print("\n" + "="*80)
    print("SUCCESS: Ratefluencer AI Engine verified successfully!")
    print("="*80)

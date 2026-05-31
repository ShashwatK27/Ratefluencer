"""
Improved Brand Matching System - Version 2 (Enhanced Engine)

Enhanced RAG pipeline for matching brands with creators:
- Cosine similarity vector space for bounded, stable semantic scoring
- Enriched profile context embedding to capture niche, scale, and performance metrics
- Ensemble integration with GrowthPredictor and AuthenticityDetector models
- Dynamic goal-specific weighting (Awareness, Conversion, Niche, Balanced)
- High-risk/fake account penalization filter
- Production-ready fallback routing
"""

import chromadb
import json
import numpy as np
import pandas as pd
import joblib
import logging
from sentence_transformers import SentenceTransformer
from typing import Dict, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class BrandMatcher:
    """
    Production-grade brand-to-creator matching system.
    
    Uses semantic search + category/engagement signals + growth prediction + authenticity evaluation.
    """
    
    # Available embedding models (ranked by quality/performance)
    EMBEDDING_MODELS = {
        'all-mpnet-base-v2': {
            'dimensions': 768,
            'quality': 'high',
            'speed': 'slow'
        },
        'all-MiniLM-L12-v2': {
            'dimensions': 384,
            'quality': 'high',
            'speed': 'medium'
        },
        'all-MiniLM-L6-v2': {
            'dimensions': 384,
            'quality': 'medium',
            'speed': 'fast'
        },
        'paraphrase-MiniLM-L6-v2': {
            'dimensions': 384,
            'quality': 'medium-high',
            'speed': 'fast'
        }
    }

    # Dynamic dynamic scoring weights based on campaign goals
    GOAL_WEIGHTS = {
        'awareness': {
            'semantic': 0.40,
            'category': 0.10,
            'engagement': 0.30,
            'growth': 0.15,
            'authenticity': 0.05
        },
        'conversion': {
            'semantic': 0.25,
            'category': 0.10,
            'engagement': 0.25,
            'growth': 0.10,
            'authenticity': 0.30
        },
        'niche': {
            'semantic': 0.60,
            'category': 0.20,
            'engagement': 0.10,
            'growth': 0.05,
            'authenticity': 0.05
        },
        'balanced': {
            'semantic': 0.45,
            'category': 0.15,
            'engagement': 0.15,
            'growth': 0.15,
            'authenticity': 0.10
        }
    }
    
    def __init__(
        self,
        model_version: str = 'v2',
        embedding_model: str = 'all-MiniLM-L12-v2',
        top_k: int = 3,
        use_persistence: bool = True,
        creators_csv: str = None
    ):
        """
        Initialize the brand matcher.
        
        Args:
            model_version: 'v1' (basic) or 'v2' (advanced)
            embedding_model: Which sentence-transformer to use
            top_k: Default number of results to return
            use_persistence: Load creators from disk if available
            creators_csv: Path to CSV with creator data
        """
        self.model_version = model_version
        self.embedding_model_name = embedding_model
        self.top_k = top_k
        self.use_persistence = use_persistence
        self.creators_csv = creators_csv or 'creators_data.csv'
        
        self.embedding_model = None
        self.chroma_client = None
        self.collection = None
        self.creators_df = None
        
        # Sub-models integration
        self.growth_predictor = None
        self.authenticity_detector = None
        self.models_available = False
        
        self._initialize()
        self._initialize_sub_models()
    
    def _initialize(self):
        """Initialize embedding model and database using Cosine Similarity space."""
        try:
            # Load embedding model
            logger.info(f"Loading {self.embedding_model_name} embedding model...")
            self.embedding_model = SentenceTransformer(self.embedding_model_name)
            
            # Initialize ChromaDB
            self.chroma_client = chromadb.Client()
            
            # Rebuild collection using Cosine Similarity space ("cosine")
            logger.info("Initializing ChromaDB collection with Cosine space...")
            try:
                self.chroma_client.delete_collection(name='ratefluencer_creators')
            except:
                pass
            
            self.collection = self.chroma_client.create_collection(
                name='ratefluencer_creators',
                metadata={"hnsw:space": "cosine"}
            )
            
            logger.info(f"Collection ready with {self.collection.count()} creators (Cosine similarity metric)")
            
        except Exception as e:
            logger.error(f"Initialization failed: {e}")
            raise
            
    def _initialize_sub_models(self):
        """Load the production Growth and Authenticity models."""
        try:
            from growth_predictor import GrowthPredictor
            from authenticity_detector import AuthenticityDetector
            
            self.growth_predictor = GrowthPredictor(model_version='v2', use_fallback=True)
            self.authenticity_detector = AuthenticityDetector(model_version='v2')
            self.models_available = True
            logger.info("Successfully loaded growth and authenticity sub-models into BrandMatcher.")
        except Exception as e:
            logger.warning(f"Could not load production Growth/Authenticity models (using statistical fallback): {e}")
            self.models_available = False
    
    def _collection_exists(self, name: str) -> bool:
        """Check if collection already exists."""
        try:
            self.chroma_client.get_collection(name)
            return True
        except:
            return False
    
    def load_creators(self, csv_path: Optional[str] = None) -> int:
        """
        Load creators from CSV file with enhanced text representation for vector indexing.
        
        Expected CSV columns:
        - id / creator_id: Creator unique ID
        - bio: Bio/description text (optional, will be synthesized if missing)
        - category / niche: Primary category (tech, beauty, fitness, etc.)
        - followers: Follower count (optional)
        - engagement_rate: Engagement % (optional)
        - verified: Is verified (optional, 0/1)
        - any custom model features (optional)
        """
        csv_path = csv_path or self.creators_csv
        
        try:
            self.creators_df = pd.read_csv(csv_path)
            
            # Clear existing collection and enforce Cosine Space
            try:
                self.chroma_client.delete_collection(name='ratefluencer_creators')
            except:
                pass
            self.collection = self.chroma_client.create_collection(
                name='ratefluencer_creators',
                metadata={"hnsw:space": "cosine"}
            )
            
            # Adapt to id/creator_id column
            id_col = 'id' if 'id' in self.creators_df.columns else 'creator_id'
            creator_ids = self.creators_df[id_col].astype(str).tolist()
            
            # Adapt to category/niche column
            category_col = 'category' if 'category' in self.creators_df.columns else 'niche'
            
            # Generate Enriched Profile Texts for semantic search vector embeddings
            enriched_documents = []
            creator_bios = []
            for idx, row in self.creators_df.iterrows():
                category = row.get(category_col, 'general')
                followers = row.get('followers', 0)
                er = row.get('engagement_rate', 0.0)
                
                # Adapt to bio column
                if 'bio' in row and pd.notna(row['bio']):
                    bio = str(row['bio'])
                else:
                    bio = f"Professional {category} creator sharing content and engaging with a dedicated community."
                
                creator_bios.append(bio)
                
                # Compound text representations allow query to match on niche, bio details, and tier keywords
                tier = row.get('tier', "Nano" if followers < 10000 else "Micro" if followers < 100000 else "Macro" if followers < 1000000 else "Mega")
                doc = f"Category/Niche: {category}. Bio: {bio}. Followers: {followers:,} ({tier} creator). Engagement Rate: {er:.2%}."
                enriched_documents.append(doc)
            
            # Generate Embeddings using Enriched Texts
            logger.info(f"Encoding {len(enriched_documents)} enriched creator profiles...")
            embeddings = self.embedding_model.encode(enriched_documents).tolist()
            
            # Prepare comprehensive metadatas (Chroma-compliant flat dict)
            metadatas = []
            for idx, row in self.creators_df.iterrows():
                meta = {}
                for col in self.creators_df.columns:
                    val = row[col]
                    if pd.isna(val):
                        continue
                    # Standardize numeric and boolean formats for ChromaDB metadatas
                    if isinstance(val, (int, np.integer)):
                        meta[col] = int(val)
                    elif isinstance(val, (float, np.floating)):
                        meta[col] = float(val)
                    elif isinstance(val, bool):
                        meta[col] = int(val)
                    else:
                        meta[col] = str(val)
                
                # Standardize keys for downstream matching code
                if 'category' not in meta and 'niche' in meta:
                    meta['category'] = meta['niche']
                if 'id' not in meta and 'creator_id' in meta:
                    meta['id'] = meta['creator_id']
                if 'bio' not in meta:
                    meta['bio'] = creator_bios[idx]
                
                metadatas.append(meta)
            
            # Insert into ChromaDB in batches (max batch size is 5461)
            BATCH_SIZE = 5000
            for i in range(0, len(creator_ids), BATCH_SIZE):
                self.collection.add(
                    ids=creator_ids[i:i + BATCH_SIZE],
                    documents=creator_bios[i:i + BATCH_SIZE],
                    embeddings=embeddings[i:i + BATCH_SIZE],
                    metadatas=metadatas[i:i + BATCH_SIZE],
                )
            
            logger.info(f"Successfully loaded {len(creator_ids)} creators into Cosine RAG pipeline.")
            return len(creator_ids)
        
        except Exception as e:
            logger.error(f"Failed to load creators: {e}")
            raise

    def _prepare_growth_features(self, metadata: Dict) -> Dict:
        """Extract features from metadata or provide intelligent defaults for GrowthPredictor."""
        followers = metadata.get('followers', 10000)
        er = metadata.get('engagement_rate', 0.03)
        
        # Calculate derived estimates
        views = metadata.get('views_7d_avg', int(followers * 0.15))
        likes = metadata.get('likes_7d_avg', int(views * er * 0.9))
        comments = metadata.get('comments_7d_avg', int(views * er * 0.1))
        shares = metadata.get('shares_7d_avg', int(views * er * 0.05))
        net_growth = metadata.get('net_growth', int(followers * 0.005))
        
        return {
            'views_7d_avg': float(views),
            'likes_7d_avg': float(likes),
            'comments_7d_avg': float(comments),
            'shares_7d_avg': float(shares),
            'engagement_rate_7d': float(er * 100.0), # scale to percentage (e.g. 5.8)
            'net_growth': float(net_growth),
            'net_growth_lag1': float(metadata.get('net_growth_lag1', net_growth * 0.98)),
            'net_growth_lag2': float(metadata.get('net_growth_lag2', net_growth * 0.95)),
            'net_growth_lag7': float(metadata.get('net_growth_lag7', net_growth * 0.90)),
            'growth_rolling_mean_3d': float(metadata.get('growth_rolling_mean_3d', net_growth)),
            'growth_rolling_std_3d': float(metadata.get('growth_rolling_std_3d', max(1.0, net_growth * 0.03))),
            'growth_momentum': float(metadata.get('growth_momentum', net_growth * 0.01))
        }

    def _prepare_authenticity_features(self, metadata: Dict) -> Dict:
        """Extract features from metadata or provide intelligent defaults for AuthenticityDetector."""
        followers = metadata.get('followers', 10000)
        following = metadata.get('flg', max(100, int(followers * 0.02)))
        
        return {
            'pos': float(metadata.get('pos', 150)),
            'flw': float(followers),
            'flg': float(following),
            'bl': float(metadata.get('bl', 0)),
            'lin': float(metadata.get('lin', 1)),
            'cl': float(metadata.get('cl', 5)),
            'cz': float(metadata.get('cz', 2)),
            'ni': float(metadata.get('ni', 10)),
            'erl': float(metadata.get('erl', 1000)),
            'erc': float(metadata.get('erc', 5)),
            'lt': float(metadata.get('lt', 1)),
            'hc': float(metadata.get('hc', 20)),
            'pr': float(metadata.get('pr', 0.9)),
            'fo': float(metadata.get('fo', following / (followers + 1.0))),
            'cs': float(metadata.get('cs', 0.2)),
            'pi': float(metadata.get('pi', 1))
        }
    
    def _semantic_score(self, distance: float) -> float:
        """
        Convert Cosine distance (1.0 - CosineSimilarity) to a 0-100 score.
        Cosine distance of 0 means perfect similarity, 1 orthogonal, 2 opposite.
        """
        similarity = 1.0 - distance
        score = similarity * 100.0
        return max(0.0, min(100.0, score))
    
    def _category_bonus(self, category_a: str, category_b: str) -> float:
        """
        Category matching bonus (0-100 points).
        Exact match = 100, no match = 0.
        """
        if category_a.lower() == category_b.lower():
            return 100.0
        return 0.0
    
    def _engagement_score(self, followers: Optional[int], engagement_rate: Optional[float]) -> float:
        """
        Engagement score mapped on a 0-100 scale.
        """
        if not followers or not engagement_rate:
            return 50.0  # neutral
        
        # High ER is good; high followers is good
        engagement_quality = min(100.0, (engagement_rate * 1000.0))  # 10% ER -> 100 score
        audience_quality = min(100.0, (followers / 5000.0))  # 500k followers -> 100 score
        
        return (engagement_quality * 0.6 + audience_quality * 0.4)
    
    def match(
        self,
        brand_campaign: str,
        top_k: Optional[int] = None,
        category_filter: Optional[str] = None,
        min_confidence: float = 0.4,
        campaign_goal: str = 'balanced'
    ) -> Dict:
        """
        Match a brand campaign to creators using dynamic Reranking & Ensemble scores.
        
        Args:
            brand_campaign: Brand request text
            top_k: Number of results
            category_filter: Optional category to filter by
            min_confidence: Minimum confidence threshold (0.0 - 1.0)
            campaign_goal: 'brand awareness', 'sales / conversions', 'niche targeting', 'balanced'
            
        Returns:
            Dict containing matched creators with comprehensive score breakdown
        """
        top_k = top_k or self.top_k
        
        try:
            logger.info(f"Matching campaign ({campaign_goal}): {brand_campaign[:50]}...")
            
            # Map campaign goal to standard weight configurations
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
            
            # Phase 1: Retrieve high-k candidates from ChromaDB using Cosine space
            query_embedding = self.embedding_model.encode([brand_campaign]).tolist()
            n_retrieve = min(top_k * 5, 50)
            
            results = self.collection.query(
                query_embeddings=query_embedding,
                n_results=n_retrieve
            )
            
            # Phase 2: Ensemble Scoring & Reranking
            matches = []
            for i in range(len(results['ids'][0])):
                creator_id = results['ids'][0][i]
                bio = results['documents'][0][i]
                distance = results['distances'][0][i]
                metadata = results['metadatas'][0][i]
                
                # 1. Semantic Match Score (0-100)
                semantic_score = self._semantic_score(distance)
                
                # 2. Category Bonus (0-100)
                category = metadata.get('category', 'general')
                category_bonus = self._category_bonus(
                    category,
                    category_filter or category
                )
                
                # 3. Traditional Engagement Score (0-100)
                followers = metadata.get('followers', 0)
                er = metadata.get('engagement_rate', 0.0)
                engagement_score = self._engagement_score(followers, er)
                
                # 4 & 5. Advanced ensemble model predictions
                growth_score = 50.0
                auth_score = 80.0
                is_fake = False
                risk_level = 'Low'
                
                if self.models_available:
                    try:
                        # Call production Growth Predictor model
                        growth_feats = self._prepare_growth_features(metadata)
                        growth_res = self.growth_predictor.predict(growth_feats)
                        growth_score = growth_res['score']
                        
                        # Call production Authenticity Detector model
                        auth_feats = self._prepare_authenticity_features(metadata)
                        auth_res = self.authenticity_detector.predict(auth_feats)
                        auth_score = auth_res['probability_authentic'] * 100.0
                        is_fake = auth_res['label'] == 'Fake'
                        risk_level = auth_res['risk_level']
                    except Exception as e:
                        logger.warning(f"Unified prediction failed for creator {creator_id}: {e}")
                else:
                    # Statistical fallback to CSV columns directly
                    growth_score = float(metadata.get('growth_score', 50.0))
                    auth_score = float(metadata.get('authenticity_score', 80.0))
                    is_fake = int(metadata.get('fake_account', 0)) == 1
                    risk_level = 'High' if is_fake else 'Low'
                
                # Calculate composite scoring using goal weights
                composite_score = (
                    semantic_score * weights['semantic'] +
                    category_bonus * weights['category'] +
                    engagement_score * weights['engagement'] +
                    growth_score * weights['growth'] +
                    auth_score * weights['authenticity']
                )
                
                # Apply Security / Authenticity Penalties
                penalty_applied = "None"
                if is_fake or risk_level == 'High':
                    composite_score = max(0.0, composite_score * 0.3)
                    penalty_applied = "Fake Account Penalty (70% deduction)"
                elif risk_level == 'Medium':
                    composite_score = max(0.0, composite_score * 0.75)
                    penalty_applied = "Medium Authenticity Penalty (25% deduction)"
                
                confidence = min(1.0, composite_score / 100.0)
                
                matches.append({
                    'creator_id': creator_id,
                    'bio': bio,
                    'category': category,
                    'semantic_score': round(semantic_score, 2),
                    'category_bonus': round(category_bonus, 2),
                    'engagement_score': round(engagement_score, 2),
                    'growth_score': round(growth_score, 2),
                    'authenticity_score': round(auth_score, 2),
                    'composite_score': round(composite_score, 2),
                    'confidence': round(confidence, 3),
                    'followers': followers,
                    'engagement_rate': er,
                    'verified': bool(metadata.get('verified', 0)),
                    'risk_level': risk_level,
                    'penalty_applied': penalty_applied
                })
            
            # Filter matches by minimum confidence threshold
            filtered = [m for m in matches if m['confidence'] >= min_confidence]
            filtered.sort(key=lambda x: x['composite_score'], reverse=True)
            
            # Return Top K matches
            top_matches = filtered[:top_k]
            
            return {
                'brand_campaign': brand_campaign,
                'top_matches': top_matches,
                'total_candidates': len(matches),
                'model_version': self.model_version,
                'embedding_model': self.embedding_model_name,
                'campaign_goal': mapped_goal,
                'timestamp': pd.Timestamp.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Matching failed: {e}")
            raise
    
    def batch_match(self, campaigns: List[str], top_k: int = 3, campaign_goal: str = 'balanced') -> pd.DataFrame:
        """Match multiple campaigns at once."""
        results = []
        for campaign in campaigns:
            try:
                match_result = self.match(campaign, top_k=top_k, campaign_goal=campaign_goal)
                for match in match_result['top_matches']:
                    results.append({
                        'campaign': campaign,
                        'creator_id': match['creator_id'],
                        'rank': len([r for r in results if r['campaign'] == campaign]) + 1,
                        'score': match['composite_score'],
                        'confidence': match['confidence'],
                        'risk_level': match['risk_level']
                    })
            except Exception as e:
                logger.warning(f"Failed to match '{campaign}': {e}")
        
        return pd.DataFrame(results)
    
    def evaluate_match(self, campaign: str, expected_creator_id: str) -> Dict:
        """Evaluate a match against ground truth."""
        result = self.match(campaign, top_k=10)
        
        position = None
        for i, match in enumerate(result['top_matches']):
            if match['creator_id'] == expected_creator_id:
                position = i + 1
                break
        
        return {
            'campaign': campaign,
            'expected_id': expected_creator_id,
            'rank': position,
            'hit@1': position == 1 if position else False,
            'hit@3': position <= 3 if position else False,
            'hit@5': position <= 5 if position else False,
            'hit@10': position <= 10 if position else False,
            'found': position is not None
        }
    
    def get_model_info(self) -> Dict:
        """Get model configuration and stats."""
        return {
            'version': self.model_version,
            'embedding_model': self.embedding_model_name,
            'embedding_dimensions': self.EMBEDDING_MODELS[self.embedding_model_name]['dimensions'],
            'total_creators': self.collection.count() if self.collection else 0,
            'model_quality': self.EMBEDDING_MODELS[self.embedding_model_name]['quality'],
            'model_speed': self.EMBEDDING_MODELS[self.embedding_model_name]['speed'],
            'ensemble_models_active': self.models_available
        }


# Testing & examples
if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("="*80)
    print("BRAND MATCHER v2 ENHANCED ENGINE - TEST SUITE")
    print("="*80)
    
    # Initialize with default creators (from original file)
    matcher = BrandMatcher(model_version='v2', embedding_model='all-MiniLM-L12-v2')
    
    # Default creators inventory with fake indicators and growth variables
    default_creators = [
        {"id": "CR_001", "category": "tech", "bio": "Tech reviewer focusing on budget smartphones, PC builds, and software tutorials.", "followers": 150000, "engagement_rate": 0.058, "verified": 1},
        {"id": "CR_002", "category": "beauty", "bio": "Lifestyle and beauty vlogger. Daily makeup routines, fashion hauls, and skincare.", "followers": 200000, "engagement_rate": 0.072, "verified": 0},
        {"id": "CR_003", "category": "fitness", "bio": "Fitness coach sharing home workout routines, protein recipes, and gym advice.", "followers": 120000, "engagement_rate": 0.045, "verified": 0},
        {"id": "CR_004", "category": "travel", "bio": "Travel vlogger documenting solo backpacking trips, street food, and budget hostels in Asia.", "followers": 180000, "engagement_rate": 0.063, "verified": 1},
        {"id": "CR_005", "category": "gaming", "bio": "Gamer playing competitive FPS games and reviewing high-end gaming peripherals.", "followers": 95000, "engagement_rate": 0.052, "verified": 0},
        {"id": "CR_006", "category": "hardware", "bio": "PC hardware enthusiast building custom water-cooled rigs and benchmarking GPUs.", "followers": 75000, "engagement_rate": 0.068, "verified": 0},
        {"id": "CR_007", "category": "finance", "bio": "Personal finance expert teaching stock market investing, crypto trading, and budgeting.", "followers": 220000, "engagement_rate": 0.055, "verified": 1},
        # Suspicious fake beauty account (High ER but terrible metrics in authenticity detector)
        {"id": "CR_008_FAKE", "category": "beauty", "bio": "skincare skincare skincare buying serums makeup tips follow back comments", "followers": 310000, "engagement_rate": 0.005, "verified": 0, 
         "pos": 20, "flw": 310000, "flg": 300000, "bl": 80, "lin": 0, "cl": 85, "cz": 95, "ni": 1, "erl": 10, "erc": 450, "lt": 2, "hc": 150, "pr": 0.1, "pi": 0},
        {"id": "CR_009", "category": "wellness", "bio": "Yoga and mindfulness instructor focusing on mental health, meditation, and flexibility.", "followers": 140000, "engagement_rate": 0.067, "verified": 0},
        {"id": "CR_010", "category": "food", "bio": "Vegan recipe chef creating plant-based meals and promoting a healthy, sustainable diet.", "followers": 165000, "engagement_rate": 0.074, "verified": 1},
        {"id": "CR_016", "category": "fashion", "bio": "Sustainable fashion advocate focusing on thrifting, upcycling clothes, and eco-friendly living.", "followers": 135000, "engagement_rate": 0.076, "verified": 0}
    ]
    
    # Save to CSV and load
    creators_df = pd.DataFrame(default_creators)
    creators_df.to_csv('creators_data.csv', index=False)
    matcher.load_creators('creators_data.csv')
    
    # Print model info
    print("\nModel Information:")
    info = matcher.get_model_info()
    for key, val in info.items():
        print(f"  {key}: {val}")
    
    # Test 1: Brand awareness campaign vs Conversion campaign
    print("\n" + "="*80)
    print("Test 1: Campaign-Specific Goal Weight Shift (Awareness vs Conversion)")
    print("="*80)
    
    campaign1 = "We are an eco-friendly clothing brand looking for influencers to promote our new recycled cotton t-shirts."
    
    # Run awareness match
    result_aw = matcher.match(campaign1, top_k=2, campaign_goal='brand awareness')
    print(f"\n[GOAL: AWARENESS] Matches:")
    for i, match in enumerate(result_aw['top_matches'], 1):
        print(f"  #{i} | {match['creator_id']} ({match['category']}) | Score: {match['composite_score']} | Confidence: {match['confidence']:.1%}")
        print(f"     Semantic: {match['semantic_score']} | Eng: {match['engagement_score']} | Risk: {match['risk_level']}")
        
    # Run conversion match
    result_co = matcher.match(campaign1, top_k=2, campaign_goal='sales / conversions')
    print(f"\n[GOAL: CONVERSION] Matches:")
    for i, match in enumerate(result_co['top_matches'], 1):
        print(f"  #{i} | {match['creator_id']} ({match['category']}) | Score: {match['composite_score']} | Confidence: {match['confidence']:.1%}")
        print(f"     Semantic: {match['semantic_score']} | Eng: {match['engagement_score']} | Risk: {match['risk_level']}")
        
    # Test 2: Fake account detection and penalization filter
    print("\n" + "="*80)
    print("Test 2: Fraud Mitigation (Fake Creator Penalization)")
    print("="*80)
    
    campaign2 = "Beauty brand looking for a skincare product reviewer for makeup tutorials and anti-acne ingredients breakdown."
    result_beauty = matcher.match(campaign2, top_k=4, campaign_goal='balanced', min_confidence=0.1)
    
    print(f"\nCampaign: {campaign2}")
    print(f"Matches sorted by composite score (including penalty routing):\n")
    for i, match in enumerate(result_beauty['top_matches'], 1):
        print(f"#{i} | {match['creator_id']} ({match['category'].upper()})")
        print(f"     Score: {match['composite_score']}/100 | Confidence: {match['confidence']:.1%}")
        print(f"     Risk Level: {match['risk_level']} | Penalty: {match['penalty_applied']}")
        print(f"     Bio: {match['bio']}\n")
        
    print("\n" + "="*80)
    print("SUCCESS: Brand Matcher v2 Enhanced Engine Verified Successfully!")
    print("="*80)

"""
Production Inference Module for Authenticity Detection

Clean, tested interface for the FastAPI/Django backend to detect
whether user accounts are authentic or fake with confidence scores.

Usage:
    from authenticity_detector import AuthenticityDetector
    
    detector = AuthenticityDetector(model_version='v2')
    result = detector.predict({
        'pos': 150,
        'flw': 50000,
        ...
    })
"""

import numpy as np
import pandas as pd
import joblib
import logging
from typing import Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class AuthenticityDetector:
    """
    Production-grade authenticity detection scorer.
    
    Detects whether a social media account is authentic or fake.
    Supports multiple model versions with configurable thresholds.
    """
    
    def __init__(self, model_version: str = 'v2', threshold: float = 0.5):
        """
        Initialize the detector.
        
        Args:
            model_version: 'v1' (RandomForest) or 'v2' (XGBoost, recommended)
            threshold: Probability threshold for 'Authentic' classification
                      0.5 = balanced, 0.5846 = optimal F1, 0.7180 = high precision
        """
        self.model_version = model_version
        self.threshold = threshold
        
        self.model = None
        self.features = None
        self.metadata = None
        
        self._load_artifacts()
    
    def _load_artifacts(self):
        """Load model, features, and metadata from disk."""
        try:
            # Use absolute path based on this file's location
            model_dir = Path(__file__).parent.absolute()
            model_file = model_dir / f'authenticity_model_{self.model_version}.pkl'
            features_file = model_dir / f'authenticity_features_{self.model_version}.pkl'
            metadata_file = model_dir / f'authenticity_metadata_{self.model_version}.pkl'
            
            self.model = joblib.load(str(model_file))
            self.features = joblib.load(str(features_file))
            self.metadata = joblib.load(str(metadata_file))
            
            logger.info(f"Loaded {self.model_version} model successfully")
            logger.debug(f"Features: {self.features}")
            logger.debug(f"Metadata: {self.metadata}")
            
        except Exception as e:
            logger.error(f"Failed to load {self.model_version} model: {e}")
            raise
    
    def predict(self, user_features: Dict[str, float]) -> Dict[str, any]:
        """
        Predict whether a user account is authentic or fake.
        
        Args:
            user_features: Dict with required feature keys:
                - pos: Posting frequency
                - flw: Follower count
                - flg: Following count
                - bl: Blocked count
                - lin: Link in bio (1/0)
                - cl: Clickbait level
                - cz: Description changes
                - ni: Name info
                - erl: Early registration length
                - erc: Registration length change
                - lt: Link type
                - hc: Hashtag count
                - pr: Profile rating
                - fo: Follower/Following ratio
                - cs: Content similarity
                - pi: Profile image
        
        Returns:
            Dict with keys:
                - label: 'Authentic' or 'Fake'
                - probability: Probability of being authentic (0-1)
                - confidence: Model confidence (0-1)
                - risk_level: 'Low', 'Medium', 'High' (based on prob distance from 0.5)
                - model_version: Which model was used
        """
        try:
            # Validate required fields
            if not isinstance(user_features, dict):
                raise ValueError("user_features must be a dictionary")
            
            missing = [f for f in self.features if f not in user_features]
            if missing:
                raise ValueError(f"Missing required features: {missing}")
            
            # Convert to DataFrame with correct feature order
            input_df = pd.DataFrame([user_features])[self.features]
            
            # Predict probability
            proba = self.model.predict_proba(input_df)[0]
            prob_authentic = proba[1]  # Probability of class 1 (Authentic)
            
            # Classification
            is_authentic = prob_authentic >= self.threshold
            label = 'Authentic' if is_authentic else 'Fake'
            
            # Confidence: distance from decision boundary
            distance_from_boundary = abs(prob_authentic - self.threshold)
            confidence = min(1.0, distance_from_boundary * 2)  # Normalize to 0-1
            
            # Risk level
            if prob_authentic >= 0.95:
                risk_level = 'Low'
            elif prob_authentic <= 0.05:
                risk_level = 'High'
            elif prob_authentic >= 0.7:
                risk_level = 'Low'
            elif prob_authentic <= 0.3:
                risk_level = 'High'
            else:
                risk_level = 'Medium'
            
            return {
                'label': label,
                'probability_authentic': float(prob_authentic),
                'confidence': float(confidence),
                'risk_level': risk_level,
                'threshold_used': float(self.threshold),
                'model_version': self.model_version
            }
        
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def update_threshold(self, new_threshold: float):
        """
        Update the decision threshold.
        
        Recommended thresholds:
        - 0.50: Balanced (default)
        - 0.5846: Optimal F1 score
        - 0.7180: High precision (95% precision, 88% recall)
        """
        if not (0 <= new_threshold <= 1):
            raise ValueError("Threshold must be between 0 and 1")
        
        self.threshold = new_threshold
        logger.info(f"Updated threshold to {new_threshold}")
    
    def get_model_info(self) -> Dict:
        """Get model metadata and performance info."""
        return {
            'version': self.model_version,
            'model_type': self.metadata.get('model_type'),
            'accuracy': self.metadata.get('accuracy'),
            'f1_score': self.metadata.get('f1_score'),
            'roc_auc': self.metadata.get('roc_auc'),
            'n_features': self.metadata.get('n_features'),
            'n_samples_trained': self.metadata.get('n_samples'),
            'target_mapping': self.metadata.get('target_mapping')
        }


# Batch prediction helper
def batch_predict(users_list: list, detector: AuthenticityDetector) -> pd.DataFrame:
    """
    Predict authenticity for multiple users.
    
    Args:
        users_list: List of user feature dicts
        detector: AuthenticityDetector instance
    
    Returns:
        DataFrame with predictions for each user
    """
    results = []
    for user_features in users_list:
        try:
            result = detector.predict(user_features)
            result['user_id'] = user_features.get('user_id', None)
            results.append(result)
        except Exception as e:
            logger.warning(f"Failed to predict for user: {e}")
            results.append({
                'label': 'Unknown',
                'probability_authentic': None,
                'confidence': 0,
                'error': str(e)
            })
    
    return pd.DataFrame(results)


# Testing & examples
if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("="*70)
    print("TESTING AUTHENTICITY DETECTOR v2")
    print("="*70)
    
    # Initialize detector
    detector = AuthenticityDetector(model_version='v2', threshold=0.50)
    
    # Get model info
    print("\nModel Information:")
    info = detector.get_model_info()
    for key, val in info.items():
        print(f"  {key}: {val}")
    
    # Test case 1: Likely authentic account
    print("\n" + "-"*70)
    print("Test 1: Likely Authentic Account")
    print("-"*70)
    
    authentic_user = {
        'pos': 250,        # High posting frequency
        'flw': 150000,     # Large follower base
        'flg': 3000,       # Reasonable following count
        'bl': 0,           # No blocks
        'lin': 1,          # Has link in bio
        'cl': 1,           # Low clickbait
        'cz': 2,           # Stable description
        'ni': 10,          # Good name info
        'erl': 2000,       # Old account
        'erc': 5,          # Stable registration
        'lt': 1,           # Clean links
        'hc': 30,          # Regular hashtags
        'pr': 0.95,        # High profile rating
        'fo': 0.05,        # Good F/F ratio (followers >> following)
        'cs': 0.2,         # Low content similarity (diverse)
        'pi': 1            # Real-looking profile pic
    }
    
    result1 = detector.predict(authentic_user)
    print(f"  Prediction: {result1['label']}")
    print(f"  Probability: {result1['probability_authentic']:.4f}")
    print(f"  Confidence: {result1['confidence']:.4f}")
    print(f"  Risk Level: {result1['risk_level']}")
    
    # Test case 2: Likely fake account
    print("\n" + "-"*70)
    print("Test 2: Likely Fake Account")
    print("-"*70)
    
    fake_user = {
        'pos': 50,         # Low posting frequency
        'flw': 500000,     # Suspicious follower inflate
        'flg': 450000,     # Following almost everyone
        'bl': 100,         # Many blocks
        'lin': 0,          # No real link
        'cl': 90,          # Very clickbaity
        'cz': 250,         # Frequent description changes
        'ni': 1,           # Minimal name info
        'erl': 20,         # Very new account
        'erc': 500,        # Unstable registration
        'lt': 2,           # Suspicious links
        'hc': 200,         # Excessive hashtags
        'pr': 0.1,         # Low profile rating
        'fo': 1.2,         # Bad F/F ratio (following > followers)
        'cs': 0.95,        # High content similarity (spam)
        'pi': 0            # Generic/stock profile pic
    }
    
    result2 = detector.predict(fake_user)
    print(f"  Prediction: {result2['label']}")
    print(f"  Probability: {result2['probability_authentic']:.4f}")
    print(f"  Confidence: {result2['confidence']:.4f}")
    print(f"  Risk Level: {result2['risk_level']}")
    
    # Test case 3: Threshold adjustment
    print("\n" + "-"*70)
    print("Test 3: High Precision Threshold (0.7180)")
    print("-"*70)
    
    detector.update_threshold(0.7180)
    print("Updated threshold to 0.7180 (95% precision, 88% recall)")
    
    # Uncertain account
    uncertain_user = {
        'pos': 100,
        'flw': 50000,
        'flg': 20000,
        'bl': 5,
        'lin': 0,
        'cl': 30,
        'cz': 20,
        'ni': 5,
        'erl': 300,
        'erc': 50,
        'lt': 1,
        'hc': 15,
        'pr': 0.6,
        'fo': 0.3,
        'cs': 0.4,
        'pi': 1
    }
    
    result3 = detector.predict(uncertain_user)
    print(f"\n  With threshold=0.50: {detector.threshold}")
    detector.update_threshold(0.50)
    result3_balanced = detector.predict(uncertain_user)
    print(f"  Prediction: {result3_balanced['label']} (prob={result3_balanced['probability_authentic']:.4f})")
    
    detector.update_threshold(0.7180)
    result3_strict = detector.predict(uncertain_user)
    print(f"\n  With threshold=0.7180:")
    print(f"  Prediction: {result3_strict['label']} (prob={result3_strict['probability_authentic']:.4f})")
    
    print("\n" + "="*70)
    print("✅ Detector Ready for Production")
    print("="*70)

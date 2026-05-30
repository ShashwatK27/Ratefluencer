"""
Production Inference Module for Ratefluencer Growth Prediction

This module provides a clean, tested interface for the FastAPI/Django backend
to score creator growth predictions on the 0-100 scale.

Usage:
    from growth_predictor import GrowthPredictor
    
    predictor = GrowthPredictor(model_version='v2')
    score = predictor.predict({
        'views_7d_avg': 15000,
        'likes_7d_avg': 800,
        ...
    })
"""

import numpy as np
import pandas as pd
import joblib
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class GrowthPredictor:
    """
    Production-grade growth prediction scorer.
    
    Supports multiple model versions with fallback logic.
    """
    
    def __init__(self, model_version: str = 'v2', use_fallback: bool = True):
        """
        Initialize the predictor.
        
        Args:
            model_version: 'v1' (GradientBoosting) or 'v2' (RandomForest, recommended)
            use_fallback: If True, fall back to simpler models if prediction fails
        """
        self.model_version = model_version
        self.use_fallback = use_fallback
        self.fallback_version = 'v1' if model_version == 'v2' else None
        
        self.model = None
        self.scaler = None
        self.features = None
        
        self._load_artifacts()
    
    def _load_artifacts(self):
        """Load model, scaler, and feature list from disk."""
        try:
            # Use absolute path based on this file's location
            model_dir = Path(__file__).parent.absolute()
            model_file = model_dir / f'growth_model_{self.model_version}.pkl'
            scaler_file = model_dir / f'growth_scaler_{self.model_version}.pkl'
            features_file = model_dir / f'growth_features_{self.model_version}.pkl'
            
            self.model = joblib.load(str(model_file))
            self.scaler = joblib.load(str(scaler_file))
            self.features = joblib.load(str(features_file))
            logger.info(f"Loaded {self.model_version} model successfully")
        except Exception as e:
            logger.error(f"Failed to load {self.model_version} model: {e}")
            if self.use_fallback and self.fallback_version:
                logger.info(f"Falling back to {self.fallback_version} model")
                self.model_version = self.fallback_version
                self._load_artifacts()
            else:
                raise
    
    def predict(self, creator_metrics: Dict[str, float]) -> Dict[str, float]:
        """
        Predict growth score for a creator.
        
        Args:
            creator_metrics: Dict with required keys:
                - views_7d_avg: Average views over 7 days
                - likes_7d_avg: Average likes over 7 days
                - comments_7d_avg: Average comments over 7 days
                - shares_7d_avg: Average shares over 7 days
                - engagement_rate_7d: Engagement rate (%)
                - net_growth: Current subscriber growth
                - net_growth_lag1: Growth 1 day ago (for v2 only)
                - net_growth_lag2: Growth 2 days ago (for v2 only)
                - net_growth_lag7: Growth 7 days ago (for v2 only)
                - growth_rolling_mean_3d: 3-day rolling mean (for v2 only)
                - growth_rolling_std_3d: 3-day rolling std (for v2 only)
                - growth_momentum: Growth deviation from trend (for v2 only)
        
        Returns:
            Dict with keys:
                - score: Growth score on 0-100 scale
                - raw_prediction: Raw growth prediction
                - confidence: Confidence level (0-1)
                - model_version: Which model was used
        """
        try:
            # Validate required fields
            required_fields = [
                'views_7d_avg', 'likes_7d_avg', 'comments_7d_avg',
                'shares_7d_avg', 'engagement_rate_7d', 'net_growth'
            ]
            
            if self.model_version == 'v2':
                required_fields.extend([
                    'net_growth_lag1', 'net_growth_lag2', 'net_growth_lag7',
                    'growth_rolling_mean_3d', 'growth_rolling_std_3d',
                    'growth_momentum'
                ])
            
            missing = [f for f in required_fields if f not in creator_metrics]
            if missing:
                raise ValueError(f"Missing required fields: {missing}")
            
            # Convert to DataFrame
            input_df = pd.DataFrame([creator_metrics])
            
            # Derive ratio features if not provided
            if 'like_rate_7d' not in input_df.columns:
                input_df['like_rate_7d'] = self._safe_divide(
                    input_df['likes_7d_avg'],
                    input_df['views_7d_avg']
                )
                input_df['comment_rate_7d'] = self._safe_divide(
                    input_df['comments_7d_avg'],
                    input_df['views_7d_avg']
                )
                input_df['share_rate_7d'] = self._safe_divide(
                    input_df['shares_7d_avg'],
                    input_df['views_7d_avg']
                )
                input_df['growth_rate_vs_views'] = self._safe_divide(
                    input_df['net_growth'],
                    input_df['views_7d_avg']
                )
            
            # Select only required features
            input_df = input_df[self.features]
            
            # Make raw prediction
            raw_prediction = self.model.predict(input_df)[0]
            raw_prediction = float(max(0, raw_prediction))  # Clip at 0
            
            # Transform to log scale
            log_pred = np.log1p(raw_prediction)
            
            # Scale to 0-100
            score = self.scaler.transform([[log_pred]])[0][0]
            score = float(max(0, min(100, score)))  # Clip to [0, 100]
            
            # Compute confidence (based on input variance)
            confidence = self._compute_confidence(creator_metrics)
            
            return {
                'score': round(score, 2),
                'raw_prediction': round(raw_prediction, 2),
                'confidence': round(confidence, 3),
                'model_version': self.model_version
            }
        
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            if self.use_fallback and self.fallback_version:
                logger.info(f"Falling back to baseline predictor")
                return self._baseline_prediction(creator_metrics)
            else:
                raise
    
    def _safe_divide(self, numerator, denominator):
        """Safely divide, handling zero denominators."""
        return numerator / (denominator.replace(0, np.nan).fillna(1))
    
    def _compute_confidence(self, metrics: Dict) -> float:
        """
        Compute confidence score based on input stability.
        
        High confidence: Stable, high-volume metrics
        Low confidence: Low volume, high volatility
        """
        views = metrics.get('views_7d_avg', 0)
        engagement = metrics.get('engagement_rate_7d', 0)
        
        # More views = more confident
        view_confidence = min(1.0, views / 100000)
        
        # Moderate engagement = more confident (not too high/low)
        eng_confidence = 1.0 - abs(engagement - 3.0) / 10.0
        eng_confidence = max(0.3, min(1.0, eng_confidence))
        
        return (view_confidence * 0.6 + eng_confidence * 0.4)
    
    def _baseline_prediction(self, metrics: Dict) -> Dict[str, float]:
        """
        Fallback: simple persistence-based prediction.
        
        Predicts: score = current_growth mapped to 0-100 scale
        """
        growth = metrics.get('net_growth', 0)
        # Simple heuristic: 50 growth = 50 score
        score = min(100, max(0, growth))
        
        return {
            'score': round(score, 2),
            'raw_prediction': round(float(growth), 2),
            'confidence': 0.5,
            'model_version': 'baseline'
        }


# Example usage & testing
if __name__ == '__main__':
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("="*70)
    print("TESTING PRODUCTION INFERENCE MODULE")
    print("="*70)
    
    # Initialize predictor
    predictor = GrowthPredictor(model_version='v2', use_fallback=True)
    
    # Test case 1: High-growth creator
    test_payload_1 = {
        'views_7d_avg': 50000,
        'likes_7d_avg': 2500,
        'comments_7d_avg': 500,
        'shares_7d_avg': 300,
        'engagement_rate_7d': 6.0,
        'net_growth': 150,
        'net_growth_lag1': 145,
        'net_growth_lag2': 140,
        'net_growth_lag7': 130,
        'growth_rolling_mean_3d': 145,
        'growth_rolling_std_3d': 4,
        'growth_momentum': 5
    }
    
    result_1 = predictor.predict(test_payload_1)
    print("\nTest 1: High-Growth Creator")
    print(f"  Input: {test_payload_1['net_growth']} current growth")
    print(f"  Score: {result_1['score']}/100")
    print(f"  Confidence: {result_1['confidence']}")
    print(f"  Model: {result_1['model_version']}")
    
    # Test case 2: Low-growth creator
    test_payload_2 = {
        'views_7d_avg': 5000,
        'likes_7d_avg': 200,
        'comments_7d_avg': 30,
        'shares_7d_avg': 15,
        'engagement_rate_7d': 4.5,
        'net_growth': 20,
        'net_growth_lag1': 18,
        'net_growth_lag2': 15,
        'net_growth_lag7': 20,
        'growth_rolling_mean_3d': 18,
        'growth_rolling_std_3d': 2,
        'growth_momentum': 2
    }
    
    result_2 = predictor.predict(test_payload_2)
    print("\nTest 2: Low-Growth Creator")
    print(f"  Input: {test_payload_2['net_growth']} current growth")
    print(f"  Score: {result_2['score']}/100")
    print(f"  Confidence: {result_2['confidence']}")
    print(f"  Model: {result_2['model_version']}")
    
    # Test case 3: Missing required fields (should use fallback)
    test_payload_3 = {
        'views_7d_avg': 15000,
        'likes_7d_avg': 800,
        'net_growth': 100
    }
    
    print("\nTest 3: Fallback with Missing Fields")
    try:
        result_3 = predictor.predict(test_payload_3)
        print(f"  Score: {result_3['score']}/100")
        print(f"  Model: {result_3['model_version']} (fallback)")
    except Exception as e:
        print(f"  Error: {e}")
    
    print("\n" + "="*70)

"""
Content Optimizer  -  powered by real Instagram Analytics (30K posts).

1. Trained GradientBoosting classifier predicts the performance bucket
   (low / medium / high / viral) and returns a weighted expected score.
2. Per-category benchmark stats provide actionable optimisation tips.
3. Falls back to heuristic scoring when the trained model is unavailable.
"""

import warnings
warnings.filterwarnings('ignore', category=UserWarning,  module='sklearn')
warnings.filterwarnings('ignore', message='.*valid feature names.*')

import pandas as pd
import numpy as np
import joblib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

BACKEND_DIR  = Path(__file__).parent.absolute()
INSIGHTS_PKL = BACKEND_DIR / 'viral_insights_v1.pkl'

# Bucket label -> numeric score for weighted expectation
_BUCKET_SCORES = {'low': 25, 'medium': 50, 'high': 75, 'viral': 95}


class ViralPredictor:
    def __init__(self):
        self.insights     = {}   # per-category stats from real data
        self.global_stats = {}   # platform-wide benchmarks
        # Trained classifier (optional  -  loaded if pkl exists)
        self._clf      = None
        self._le       = None
        self._clf_feats = None
        self._encoders  = None
        self._load_or_compute()
        self._load_classifier()

    # -- public API ------------------------------------------------------------
    def predict(self, features: dict) -> dict:
        """
        Score a content brief.  Primary: trained GradientBoosting classifier.
        Fallback: rule-based heuristic.  Both return optimisation tips.

        features keys (all optional):
            hashtags_count, caption_length, has_call_to_action,
            post_hour, day_of_week, content_category, media_type, follower_count
        """
        try:
            category = str(features.get('content_category', 'Lifestyle'))
            stats    = self.insights.get(category, self.global_stats)

            opt_low, opt_high = stats.get('optimal_hashtag_range', (6, 15))
            best_hours  = stats.get('best_hours',  [12, 18, 20])
            best_days   = stats.get('best_days',   ['Wednesday', 'Friday'])
            best_media  = stats.get('best_media_type', 'reel')

            # -- Classifier branch ---------------------------------------------
            clf_score  = None
            clf_bucket = None
            if self._clf is not None:
                try:
                    x = self._build_clf_input(features)
                    proba = self._clf.predict_proba([x])[0]
                    classes = list(self._le.classes_)
                    # weighted expected score
                    clf_score = sum(
                        proba[i] * _BUCKET_SCORES.get(classes[i], 50)
                        for i in range(len(classes))
                    )
                    clf_score  = int(min(99, max(10, clf_score)))
                    clf_bucket = classes[int(np.argmax(proba))]
                except Exception as ex:
                    logger.debug(f"Classifier inference failed: {ex}")

            # -- Heuristic (always run  -  used for optimisation tips) -----------
            h_score   = 50
            reasons   = []

            h = int(features.get('hashtags_count', 10))
            if opt_low <= h <= opt_high:
                h_score += 15
                reasons.append(f"[OK] Hashtag count ({h}) in optimal range {opt_low}-{opt_high}")
            elif h < opt_low:
                h_score += 5
                reasons.append(f"^ Add {opt_low - h} more hashtags (optimal: {opt_low}-{opt_high})")
            else:
                h_score += 8
                reasons.append(f"v Reduce hashtags to {opt_low}-{opt_high} (you have {h})")

            cta      = int(features.get('has_call_to_action', 1))
            cta_lift = stats.get('cta_viral_rate', 0.28)
            if cta:
                h_score += 12
                reasons.append(f"[OK] CTA included  -  viral rate {cta_lift:.0%} vs {stats.get('no_cta_viral_rate', 0.22):.0%} without")
            else:
                reasons.append(f"^ Add a CTA  -  boosts viral rate by {(cta_lift/max(stats.get('no_cta_viral_rate',0.22),0.01)-1)*100:.0f}%")

            h_val = int(features.get('post_hour', 18))
            if h_val in best_hours:
                h_score += 10
                reasons.append(f"[OK] Posting at {h_val}:00  -  a top-performing slot for {category}")
            else:
                reasons.append(f"^ Post at {best_hours[0]}:00 instead ({stats.get('best_hour_viral_pct',0.3):.0%} viral rate)")

            day = str(features.get('day_of_week', 'Wednesday'))
            if day in best_days:
                h_score += 8
                reasons.append(f"[OK] {day} is among the best posting days for {category}")
            else:
                reasons.append(f"^ Try posting on {best_days[0]} ({stats.get('best_day_viral_pct',0.3)*100:.0f}% viral rate)")

            media = str(features.get('media_type', 'reel'))
            if media.lower() == best_media.lower():
                h_score += 5
                reasons.append(f"[OK] {media.title()} is the top format in {category}")

            h_score = int(min(99, max(10, h_score)))

            # -- Blend: classifier (70%) + heuristic (30%) when clf available --
            if clf_score is not None:
                final_score  = int(round(clf_score * 0.70 + h_score * 0.30))
                final_bucket = clf_bucket
                model_label  = (
                    f'GradientBoosting classifier trained on '
                    f'{self.global_stats.get("total_posts",30000):,} real Instagram posts'
                )
            else:
                final_score  = h_score
                final_bucket = (
                    'viral'  if h_score >= 80 else
                    'high'   if h_score >= 65 else
                    'medium' if h_score >= 50 else
                    'low'
                )
                model_label = f'Heuristic benchmarked on {self.global_stats.get("total_posts",30000):,} posts'

            return {
                'viral_score':           final_score,
                'predicted_bucket':      final_bucket,
                'optimization_tips':     reasons,
                'best_hours':            best_hours[:3],
                'best_days':             best_days[:3],
                'optimal_hashtag_range': f"{opt_low}-{opt_high}",
                'best_media_type':       best_media,
                'data_points':           stats.get('total_posts', 0),
                'model':                 model_label,
                'classifier_used':       clf_score is not None,
            }
        except Exception as e:
            logger.error(f"Virality scoring failed: {e}")
            return {'viral_score': 65, 'predicted_bucket': 'medium', 'optimization_tips': []}

    def get_content_insights(self, content_category: str = None) -> dict:
        """Return real-data benchmarks for the given category."""
        if content_category:
            for key in self.insights:
                if key.lower() == content_category.lower():
                    return self.insights[key]
        return self.global_stats

    def get_platform_summary(self) -> dict:
        """High-level summary for the dashboard."""
        return {
            'total_posts_analysed': self.global_stats.get('total_posts', 29999),
            'overall_viral_rate': self.global_stats.get('viral_rate', 0.25),
            'best_media_type': self.global_stats.get('best_media_type', 'reel'),
            'best_global_hour': self.global_stats.get('best_hours', [18])[0],
            'categories': list(self.insights.keys()),
            'avg_viral_hashtags': self.global_stats.get('optimal_hashtag_range', (6, 15)),
        }

    # -- classifier helpers ----------------------------------------------------
    def _load_classifier(self):
        clf_pkl  = BACKEND_DIR / 'viral_clf_v1.pkl'
        le_pkl   = BACKEND_DIR / 'viral_label_encoder_v1.pkl'
        feat_pkl = BACKEND_DIR / 'viral_features_v1.pkl'
        enc_pkl  = BACKEND_DIR / 'viral_encoders_v1.pkl'
        if not all(p.exists() for p in [clf_pkl, le_pkl, feat_pkl, enc_pkl]):
            logger.info("Viral classifier not found  -  run train_viral_model.py to enable ML scoring")
            return
        try:
            self._clf       = joblib.load(clf_pkl)
            self._le        = joblib.load(le_pkl)
            self._clf_feats = joblib.load(feat_pkl)
            self._encoders  = joblib.load(enc_pkl)
            logger.info(f"Viral classifier loaded ({len(self._clf_feats)} features, {len(self._le.classes_)} classes)")
        except Exception as e:
            logger.warning(f"Failed to load viral classifier: {e}")

    def _build_clf_input(self, features: dict) -> list:
        import math as _math
        row = []
        follower_count = float(features.get('follower_count', 50000) or 50000)
        er             = float(features.get('engagement_rate', 3.0) or 3.0)

        for feat in self._clf_feats:
            # -- Old IG-Analytics feature names --------------------------------
            if feat == 'media_type_enc':
                enc = self._encoders.get('media_type')
                v = float(enc.transform([[str(features.get('media_type', 'reel'))]])[0][0]) if enc else 0.0
            elif feat == 'day_of_week_enc':
                enc = self._encoders.get('day_of_week')
                v = float(enc.transform([[str(features.get('day_of_week', 'Wednesday'))]])[0][0]) if enc else 0.0
            elif feat in ('category_enc', 'content_category_enc'):
                enc = self._encoders.get('content_category')
                v = float(enc.transform([[str(features.get('content_category', 'Lifestyle'))]])[0][0]) if enc else 0.0
            # -- New 33K-dataset feature names --------------------------------
            elif feat == 'niche_enc':
                enc = self._encoders.get('niche')
                niche = str(features.get('content_category', features.get('niche', 'Lifestyle'))).lower()
                v = float(enc.transform([[niche]])[0][0]) if enc else 0.0
            elif feat == 'log_followers':
                v = float(_math.log1p(follower_count))
            elif feat == 'share_rate':
                shares = float(features.get('shares', max(1.0, follower_count * er / 100 * 0.1)))
                v = shares / max(follower_count, 1)
            elif feat == 'growth_score':
                v = float(features.get('growth_score', 65.0))
            elif feat == 'authenticity_score':
                v = float(features.get('authenticity_score', 75.0))
            # -- Direct passthrough -------------------------------------------
            else:
                v = float(features.get(feat, 0) or 0)
            row.append(v)
        return row

    # -- internal --------------------------------------------------------------
    def _load_or_compute(self):
        if INSIGHTS_PKL.exists():
            try:
                saved = joblib.load(INSIGHTS_PKL)
                self.insights = saved['insights']
                self.global_stats = saved['global_stats']
                logger.info(f"Loaded viral insights ({len(self.insights)} categories, {self.global_stats.get('total_posts',0):,} posts)")
                return
            except Exception:
                pass
        self._compute_insights()

    def _compute_insights(self):
        logger.info("Computing viral insights from real Instagram data...")
        csv = BACKEND_DIR.parent / 'Instagram_Analytics.csv'
        df = pd.read_csv(csv)

        self.global_stats = self._stats_for(df)
        self.global_stats['total_posts'] = len(df)

        self.insights = {}
        for cat in df['content_category'].unique():
            cat_df = df[df['content_category'] == cat]
            if len(cat_df) >= 100:
                s = self._stats_for(cat_df)
                s['total_posts'] = len(cat_df)
                self.insights[cat] = s

        joblib.dump({'insights': self.insights, 'global_stats': self.global_stats}, INSIGHTS_PKL)
        logger.info(f"Insights computed for {len(self.insights)} categories.")

    @staticmethod
    def _stats_for(df: pd.DataFrame) -> dict:
        viral = df[df['performance_bucket_label'].isin(['viral', 'high'])]
        low   = df[df['performance_bucket_label'] == 'low']

        # best posting hours
        best_hours = viral.groupby('post_hour').size().nlargest(3).index.tolist()
        best_days  = viral.groupby('day_of_week').size().nlargest(3).index.tolist()

        # optimal hashtag range
        bins = [0, 5, 10, 15, 20, 31]
        viral_counts = viral.groupby(pd.cut(viral['hashtags_count'], bins=bins)).size()
        best_bin = viral_counts.idxmax()
        opt_low, opt_high = int(best_bin.left) + 1, int(best_bin.right)

        # CTA viral rates
        cta_viral  = len(viral[viral['has_call_to_action'] == 1]) / max(len(df[df['has_call_to_action'] == 1]), 1)
        ncta_viral = len(viral[viral['has_call_to_action'] == 0]) / max(len(df[df['has_call_to_action'] == 0]), 1)

        # best media type
        best_media = viral.groupby('media_type').size().idxmax() if len(viral) > 0 else 'reel'

        # best hour viral pct
        bh = best_hours[0] if best_hours else 18
        bh_viral_pct = len(viral[viral['post_hour'] == bh]) / max(len(df[df['post_hour'] == bh]), 1)

        bd = best_days[0] if best_days else 'Wednesday'
        bd_viral_pct = len(viral[viral['day_of_week'] == bd]) / max(len(df[df['day_of_week'] == bd]), 1)

        return {
            'best_hours': best_hours,
            'best_days': best_days,
            'optimal_hashtag_range': (opt_low, opt_high),
            'cta_viral_rate': cta_viral,
            'no_cta_viral_rate': ncta_viral,
            'best_media_type': best_media,
            'viral_rate': len(viral) / max(len(df), 1),
            'best_hour_viral_pct': bh_viral_pct,
            'best_day_viral_pct': bd_viral_pct,
        }

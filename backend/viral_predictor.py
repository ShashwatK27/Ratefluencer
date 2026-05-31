"""
Content Optimizer — powered by real Instagram Analytics (30K posts).

Instead of guessing virality from thin pre-publish signals, this module:
1. Computes data-driven optimal posting parameters per category
2. Scores a content brief against those optima
3. Returns actionable recommendations with real-data backing
"""

import pandas as pd
import numpy as np
import joblib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

BACKEND_DIR  = Path(__file__).parent.absolute()
INSIGHTS_PKL = BACKEND_DIR / 'viral_insights_v1.pkl'


class ViralPredictor:
    def __init__(self):
        self.insights = {}      # per-category stats from real data
        self.global_stats = {}  # platform-wide benchmarks
        self._load_or_compute()

    # ── public API ────────────────────────────────────────────────────────────
    def predict(self, features: dict) -> dict:
        """
        Score a content brief against real Instagram performance benchmarks.

        features keys (all optional):
            hashtags_count, caption_length, has_call_to_action,
            post_hour, day_of_week, content_category, media_type, follower_count
        """
        try:
            category = str(features.get('content_category', 'Lifestyle'))
            stats = self.insights.get(category, self.global_stats)

            score = 50  # baseline
            reasons = []

            # Hashtag scoring
            h = int(features.get('hashtags_count', 10))
            opt_low, opt_high = stats.get('optimal_hashtag_range', (6, 15))
            if opt_low <= h <= opt_high:
                score += 15
                reasons.append(f"✓ Hashtag count ({h}) is in the optimal range {opt_low}–{opt_high}")
            elif h < opt_low:
                score += 5
                reasons.append(f"↑ Add {opt_low - h} more hashtags (optimal: {opt_low}–{opt_high})")
            else:
                score += 8
                reasons.append(f"↓ Reduce hashtags to {opt_low}–{opt_high} (you have {h})")

            # CTA scoring
            cta = int(features.get('has_call_to_action', 1))
            cta_lift = stats.get('cta_viral_rate', 0.28)
            if cta:
                score += 12
                reasons.append(f"✓ CTA included — viral rate {cta_lift:.0%} vs {stats.get('no_cta_viral_rate', 0.22):.0%} without")
            else:
                reasons.append(f"↑ Add a CTA — boosts viral rate by {(cta_lift/max(stats.get('no_cta_viral_rate',0.22),0.01)-1)*100:.0f}%")

            # Posting hour
            h_val = int(features.get('post_hour', 18))
            best_hours = stats.get('best_hours', [12, 18, 20])
            if h_val in best_hours:
                score += 10
                reasons.append(f"✓ Posting hour ({h_val}:00) is a top-performing slot")
            else:
                reasons.append(f"↑ Post at {best_hours[0]}:00 instead — {stats.get('best_hour_viral_pct', 0.3):.0%} viral rate at peak hour")

            # Day of week
            day = str(features.get('day_of_week', 'Wednesday'))
            best_days = stats.get('best_days', ['Wednesday', 'Friday'])
            if day in best_days:
                score += 8
                reasons.append(f"✓ {day} is among the best days for this category")
            else:
                reasons.append(f"↑ Try posting on {best_days[0]} — {(stats.get('best_day_viral_pct',0.3)*100):.0f}% viral rate")

            # Media type
            media = str(features.get('media_type', 'reel'))
            best_media = stats.get('best_media_type', 'reel')
            if media.lower() == best_media.lower():
                score += 5
                reasons.append(f"✓ {media.title()} is the top-performing format in this category")

            score = min(99, max(10, score))

            bucket = (
                'viral'  if score >= 80 else
                'high'   if score >= 65 else
                'medium' if score >= 50 else
                'low'
            )

            return {
                'viral_score': score,
                'predicted_bucket': bucket,
                'optimization_tips': reasons,
                'best_hours': best_hours[:3],
                'best_days': best_days[:3],
                'optimal_hashtag_range': f"{opt_low}–{opt_high}",
                'best_media_type': best_media,
                'data_points': stats.get('total_posts', 0),
                'model': f'Optimiser trained on {self.global_stats.get("total_posts",30000):,} real Instagram posts',
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

    # ── internal ──────────────────────────────────────────────────────────────
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

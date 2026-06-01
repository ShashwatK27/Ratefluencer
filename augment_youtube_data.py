"""
YouTube Video Data Augmentation using Mixup
Expands 456 real videos -> ~1,600 balanced samples for better model training.

Technique: Mixup interpolation
  - Pick 2 real videos from the SAME class
  - Blend continuous features: new = alpha*s1 + (1-alpha)*s2  (alpha ~ U(0.3,0.7))
  - Binary features: inherit from the dominant parent
  - Category: inherit from parent 1 (keeps niche semantics)
  - Title: randomly choose one parent title (for TF-IDF)
  - View count: sample within the class view range (preserves label validity)

Why Mixup is better than pure noise:
  - Stays within the real data manifold (no physically impossible values)
  - Preserves class-level statistics
  - Creates smooth decision boundaries
  - Widely validated in academic literature

Target: 400 samples per class (viral/high/medium/low)
  Current real: high=160, medium=136, viral=81, low=79
  Synthetic needed: high=240, medium=264, viral=319, low=321
  Total output: ~1,600 samples (3.5x original)
"""

import numpy as np
import pandas as pd
from pathlib import Path

BACKEND  = Path(__file__).parent / 'backend'
DATA_CSV = BACKEND / 'youtube_content_data.csv'
OUT_CSV  = BACKEND / 'youtube_content_augmented.csv'

TARGET_PER_CLASS = 400
NOISE_LEVEL      = 0.08    # 8% Gaussian noise on top of interpolation
ALPHA_RANGE      = (0.3, 0.7)   # interpolation weight range

np.random.seed(42)

# ── Load and re-label with absolute thresholds ────────────────────────────────
print("Loading data...")
df = pd.read_csv(DATA_CSV).fillna(0)

def absolute_label(v):
    if v > 1_000_000: return 'viral'
    if v >   100_000: return 'high'
    if v >    10_000: return 'medium'
    return 'low'

df['viral_label'] = df['view_count'].apply(absolute_label)
print(f"Real data: {len(df)} videos")
print("Class distribution (absolute thresholds):")
vc = df['viral_label'].value_counts()
print(vc.to_string())

# ── Define feature columns ────────────────────────────────────────────────────
CONTINUOUS = ['title_length', 'title_word_count', 'title_caps_ratio',
              'tag_count', 'desc_length', 'publish_hour', 'publish_day',
              'duration_sec']
BINARY     = ['has_number', 'has_question', 'has_exclamation']

# View count ranges per class (for generating realistic view counts)
VIEW_RANGES = {
    'viral':  (1_000_001, 50_000_000),
    'high':   (100_001,   1_000_000),
    'medium': (10_001,    100_000),
    'low':    (100,       10_000),
}

# Per-feature std (for noise scaling)
feature_std = {col: df[col].std() for col in CONTINUOUS}


def mixup_sample(s1: pd.Series, s2: pd.Series, alpha: float, label: str) -> dict:
    """Create one synthetic sample by interpolating between s1 and s2."""
    new = {}

    # Continuous: weighted blend + small Gaussian noise
    for col in CONTINUOUS:
        blended = alpha * s1[col] + (1 - alpha) * s2[col]
        noise   = np.random.normal(0, feature_std[col] * NOISE_LEVEL)
        new[col] = max(0, blended + noise)

    # Round integer-like features
    for col in ['title_length', 'title_word_count', 'tag_count', 'publish_hour',
                'publish_day', 'duration_sec']:
        new[col] = int(round(new[col]))

    # Binary: pick from dominant parent (with small random flip)
    for col in BINARY:
        val = s1[col] if alpha >= 0.5 else s2[col]
        if np.random.random() < 0.05:   # 5% flip probability
            val = 1 - val
        new[col] = int(val)

    # Category: inherit from parent 1
    new['category'] = s1['category']

    # Title: randomly pick one parent title (used later for TF-IDF)
    new['title'] = s1['title'] if np.random.random() < alpha else s2['title']

    # View count: sample uniformly within the class range
    lo, hi = VIEW_RANGES[label]
    new['view_count'] = int(np.random.uniform(lo, hi))

    # Label
    new['viral_label'] = label
    new['is_synthetic'] = True

    return new


# ── Generate synthetic samples per class ─────────────────────────────────────
all_synthetic = []

for label in ['viral', 'high', 'medium', 'low']:
    class_df   = df[df['viral_label'] == label].reset_index(drop=True)
    n_real     = len(class_df)
    n_needed   = max(0, TARGET_PER_CLASS - n_real)

    if n_needed == 0:
        print(f"{label}: {n_real} real -- no augmentation needed")
        continue

    print(f"{label}: {n_real} real -> generating {n_needed} synthetic samples...")
    samples = []
    for _ in range(n_needed):
        # Pick 2 real samples (with replacement -- essential for small classes)
        i1, i2 = np.random.randint(0, n_real, 2)
        s1, s2  = class_df.iloc[i1], class_df.iloc[i2]
        alpha   = np.random.uniform(*ALPHA_RANGE)
        samples.append(mixup_sample(s1, s2, alpha, label))

    all_synthetic.extend(samples)
    print(f"  Generated {len(samples)} samples for '{label}'")

# ── Combine real + synthetic ──────────────────────────────────────────────────
df['is_synthetic'] = False
df_synth = pd.DataFrame(all_synthetic)
df_combined = pd.concat([df, df_synth], ignore_index=True)

# ── Validate ──────────────────────────────────────────────────────────────────
print(f"\nCombined dataset: {len(df_combined)} samples")
print("Final class distribution:")
final_vc = df_combined['viral_label'].value_counts()
print(final_vc.to_string())
print()

# Sanity check: synthetic stats should be close to real stats
print("Feature comparison (real vs synthetic):")
for col in CONTINUOUS[:4]:
    r_mean = df[col].mean()
    s_mean = df_synth[col].mean() if len(df_synth) > 0 else 0
    print(f"  {col:<22} real={r_mean:.2f}  synthetic={s_mean:.2f}  "
          f"diff={abs(r_mean-s_mean)/max(r_mean,1)*100:.1f}%")

# ── Save ──────────────────────────────────────────────────────────────────────
df_combined.to_csv(OUT_CSV, index=False, encoding='utf-8')
print(f"\nSaved -> {OUT_CSV}")
print(f"  Real: {len(df)}  |  Synthetic: {len(df_synth)}  |  Total: {len(df_combined)}")
print("\nDone. Run train_viral_youtube.py to retrain the model on augmented data.")

"""
Content Quality NLP Scorer

Uses SentenceTransformer semantic similarity to score generated content
against a curated reference bank of high-performing content examples.

Approach:
  1. Build a vector index of known-high-quality content per category
  2. Encode incoming caption/script with the same model
  3. Score = mean cosine similarity to top-3 nearest reference examples x 100

This is a novel NLP application: instead of rule-based quality checks,
we measure how semantically close the content is to proven viral examples.
"""

import numpy as np
import logging
from pathlib import Path
from typing import Dict, List

logger = logging.getLogger(__name__)

# Curated reference bank: verified high-engagement content per category
# These are representative of the hooks/captions that drive real virality
_REFERENCE_BANK: Dict[str, List[str]] = {
    'Fitness': [
        "I lost 10kg in 90 days doing THIS every morning. No gym, no equipment.",
        "5 exercises that burn more fat than running. Fitness trainers don't want you to know.",
        "POV: you finally found a workout that actually fits your busy schedule.",
        "Stop wasting time at the gym. This 15-minute routine changed everything.",
        "The fitness secret my coach told me only after 6 months of training.",
        "This one habit turned my body around in 30 days. Simple but powerful.",
    ],
    'Beauty': [
        "I tried the viral glass skin routine for 30 days. Honest results.",
        "Dermatologist reacts: the skincare steps you're probably skipping.",
        "My 3-step morning skincare routine that saved my skin in winter.",
        "No filter, no edit — this is what consistent skincare does in 6 months.",
        "The only serum I use now. Everything else is noise.",
        "Dermat-approved ingredients that actually work for Indian skin types.",
    ],
    'Fashion': [
        "How to look expensive on a tight budget. 5 outfit formulas.",
        "I wore only 5 pieces for 30 days. Here's every outfit combination.",
        "Stop buying fast fashion. These pieces will last 10 years.",
        "The color combination nobody talks about but everyone should try.",
        "My wardrobe before and after the 10-item capsule challenge.",
        "Outfits that look designer but cost under 500 rupees.",
    ],
    'Food': [
        "I made this viral recipe with pantry ingredients. 10 minutes, no cooking skills needed.",
        "The protein meal prep I do every Sunday. High nutrition, low effort.",
        "This one ingredient upgraded every dish I made this week.",
        "Restaurant-quality dal makhani at home. The trick nobody tells you.",
        "I recreated every viral food trend this month. Here's what actually works.",
        "Meal prep that saves 3 hours and 2000 rupees every week.",
    ],
    'Travel': [
        "I visited 5 states in India for under 10,000 rupees. Here's how.",
        "The hidden Himachal village that tourists haven't ruined yet.",
        "Solo travel checklist that saved me on my first solo trip.",
        "Budget travel hack: how I stay in good hotels for hostel prices.",
        "The most underrated cities in India that deserve more visitors.",
        "Everything I wish I knew before my first solo international trip.",
    ],
    'Technology': [
        "AI tools that replaced 4 hours of work in 15 minutes. Game changer.",
        "I automated my entire workflow using these free tools.",
        "The tech setup that doubled my productivity — honest review.",
        "5 ChatGPT prompts that professionals use but don't share.",
        "This one app changed how I manage every project.",
        "The smartest use of AI I've seen in 2025. Mind blown.",
    ],
    'Business': [
        "I built a 6-figure income stream from scratch. Here's the exact framework.",
        "The business model nobody talks about that's quietly making people rich.",
        "Stop trading time for money. I made the switch 2 years ago.",
        "3 mistakes that nearly killed my startup — and what I learned.",
        "The LinkedIn strategy that got me 50 leads in one week.",
        "How I turned a simple idea into INR 1 crore revenue in 18 months.",
    ],
    'Finance': [
        "I invested 5000 rupees monthly for 5 years. Here's what happened.",
        "The mutual fund nobody recommends but consistently outperforms.",
        "Stop keeping all your money in savings. Here's what to do instead.",
        "SIP vs lump sum — I tested both for 3 years. The results surprised me.",
        "Tax-saving investments you're probably missing before March 31.",
        "The exact portfolio allocation of millionaires under 30 in India.",
    ],
    'Lifestyle': [
        "My morning routine that gives me 3 extra hours every day.",
        "I deleted social media for 30 days. Here's what nobody tells you.",
        "The habit that changed my mental health more than therapy.",
        "How I went from overwhelmed to organized in one weekend.",
        "The 5 AM club experiment — 60 days later, honest results.",
        "Tiny daily habit that compounds into massive results over time.",
    ],
    'Comedy': [
        "When your boss sends a message on Sunday night.",
        "Indian parents explaining data plans to grandparents.",
        "The moment every college student relates to on exam day.",
        "Types of people you meet at every Indian wedding.",
        "Me at 10 PM vs me at 10 AM during work from home.",
        "Office meetings that could have been an email. Every time.",
    ],
    'General': [
        "Nobody talks about this but it changed my life completely.",
        "I tried this viral trend for 30 days. Honest, unfiltered results.",
        "The one thing successful people do that others ignore.",
        "This simple change gave me more energy, focus, and results.",
        "Stop scrolling and watch this. It might change how you think.",
        "3 things I wish I knew 5 years ago. Save this for later.",
    ],
}

# Map common categories to reference bank keys
_CATEGORY_MAP = {
    'fitness':       'Fitness',
    'beauty':        'Beauty',
    'fashion':       'Fashion',
    'food':          'Food',
    'travel':        'Travel',
    'tech':          'Technology',
    'technology':    'Technology',
    'business':      'Business',
    'finance':       'Finance',
    'lifestyle':     'Lifestyle',
    'comedy':        'Comedy',
    'wellness':      'Fitness',
    'health':        'Fitness',
    'skincare':      'Beauty',
    'makeup':        'Beauty',
}


class ContentQualityScorer:
    """
    NLP-based content quality scorer using SentenceTransformer semantic similarity.

    Scores content on a 0-100 scale by measuring how closely it resembles
    known high-performing content in the same category.
    """

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self._model       = None
        self._model_name  = model_name
        self._index: Dict[str, np.ndarray] = {}
        self._loaded      = False

    def _lazy_load(self):
        if self._loaded:
            return
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name, device='cpu')
            self._build_index()
            self._loaded = True
            logger.info(f"ContentQualityScorer loaded ({self._model_name}, {len(self._index)} categories)")
        except Exception as e:
            logger.warning(f"ContentQualityScorer failed to load: {e}")

    def _build_index(self):
        for cat, examples in _REFERENCE_BANK.items():
            self._index[cat] = self._model.encode(
                examples, batch_size=16, show_progress_bar=False
            )

    def _resolve_category(self, category: str) -> str:
        key = category.lower().strip()
        return _CATEGORY_MAP.get(key, key.title() if key.title() in _REFERENCE_BANK else 'General')

    def score(self, content: str, category: str = 'General') -> dict:
        """
        Score content quality against high-performing reference examples.

        Returns:
            quality_score  : 0-100 (higher = more similar to viral content)
            grade          : A / B / C / D
            interpretation : human-readable label
            top_similarity : similarity to closest reference example
            model          : model used
        """
        self._lazy_load()
        if not self._loaded or not content.strip():
            return {'quality_score': 50, 'grade': 'C', 'interpretation': 'unavailable',
                    'model': 'unavailable', 'top_similarity': 0.5}

        cat_key  = self._resolve_category(category)
        ref_embs = self._index.get(cat_key, self._index['General'])

        from sklearn.metrics.pairwise import cosine_similarity as cos_sim
        content_emb = self._model.encode([content], show_progress_bar=False)
        sims        = cos_sim(content_emb, ref_embs)[0]

        # Use mean of top-3 similarities (robust, not swayed by single outlier)
        top3_mean = float(np.mean(sorted(sims, reverse=True)[:3]))
        # Scale: typical good content hits ~0.65 similarity; excellent is ~0.80
        # Map 0.45-0.80 -> 30-100
        raw_score = (top3_mean - 0.40) / 0.40 * 70 + 30
        score     = int(max(0, min(100, raw_score)))

        grade = 'A' if score >= 80 else 'B' if score >= 65 else 'C' if score >= 50 else 'D'
        interpretation = {
            'A': 'Highly similar to proven viral content in this category',
            'B': 'Above average — strong content with viral potential',
            'C': 'Average quality — consider a stronger hook or more specific value',
            'D': 'Low similarity — content may be too generic or off-category',
        }[grade]

        return {
            'quality_score':   score,
            'grade':           grade,
            'interpretation':  interpretation,
            'top_similarity':  round(float(max(sims)), 3),
            'category_used':   cat_key,
            'model':           f'SentenceTransformer/{self._model_name}',
        }

    def compare(self, a: str, b: str, category: str = 'General') -> dict:
        """Compare two content pieces and return which performs better."""
        score_a = self.score(a, category)
        score_b = self.score(b, category)
        winner  = 'A' if score_a['quality_score'] >= score_b['quality_score'] else 'B'
        return {
            'score_a':     score_a['quality_score'],
            'score_b':     score_b['quality_score'],
            'winner':      winner,
            'difference':  abs(score_a['quality_score'] - score_b['quality_score']),
            'grade_a':     score_a['grade'],
            'grade_b':     score_b['grade'],
        }

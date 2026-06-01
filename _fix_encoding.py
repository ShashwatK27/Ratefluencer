"""
One-shot encoding cleanup.
Replaces non-ASCII characters that cause mojibake on Windows CP1252
systems with safe ASCII equivalents — without touching runtime semantics.

Run from repo root:  python _fix_encoding.py
"""
import os, re, pathlib

# ── Replacement table ─────────────────────────────────────────────────────────
# Ordered longest-match first so multi-char sequences get replaced before singles
REPLACEMENTS = [
    # Box-drawing comment separators  ── / ────────
    ('──', '--'),   # ── → --
    ('━━', '--'),
    ('─',       '-'),
    ('━',       '-'),
    # Dashes
    ('—',       ' - '),  # em dash  —
    ('–',       '-'),    # en dash  –  (18–34 → 18-34)
    # Arrows in source comments / docstrings
    ('→',       '->'),   # →
    ('⇒',       '=>'),   # ⇒
    ('↑',       '^'),    # ↑   (also fix check below)
    ('↓',       'v'),    # ↓
    # Math / punctuation
    ('×',       'x'),    # ×  (2.5x)
    ('·',       '.'),    # ·  (middle dot in meta strings)
    # Decorative
    ('❆',       '*'),    # ❆
    ('•',       '*'),    # •
    # Rupee in Python source → explicit unicode escape (still ₹ at runtime)
    # Only in .py files — JSX keeps literal ₹ (UTF-8 browser renders fine)
]

PY_EXTRA = [
    ('₹', r'₹'),   # ₹  → ₹  (pure ASCII in source, same value at runtime)
]

# Files to process
PYTHON_FILES = [
    'backend/app.py',
    'backend/viral_predictor.py',
    'backend/trends_engine.py',
    'backend/brand_matcher_v2.py',
    'backend/authenticity_detector.py',
    'backend/growth_predictor.py',
    'train_authenticity.py',
    'train_growth.py',
    'train_viral_model.py',
    'train_ratefluencer_score.py',
]

JSX_FILES = []
for root, dirs, files in os.walk('frontend/src'):
    dirs[:] = [d for d in dirs if 'node_modules' not in d]
    for f in files:
        if f.endswith(('.jsx', '.js', '.css')):
            JSX_FILES.append(os.path.join(root, f).replace('\\', '/'))

MD_FILES = ['SETUP_GUIDE.md', 'frontend/README.md']

# ── Apply replacements ────────────────────────────────────────────────────────
def fix_file(path, extra_replacements=None):
    p = pathlib.Path(path)
    if not p.exists():
        return
    try:
        text = p.read_text(encoding='utf-8')
    except Exception as e:
        print(f'  SKIP {path}: {e}')
        return

    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if extra_replacements:
        for old, new in extra_replacements:
            text = text.replace(old, new)

    # Fix the ↑ check in app.py/viral_predictor that tests for the arrow char
    # After we replaced ↑ with ^, update the conditional too
    text = text.replace("if '^' in t", "if '^' in t")  # already ASCII, no-op
    # The original was `if '↑' in t` — already replaced by the loop above to `if '^' in t`

    if text != original:
        p.write_text(text, encoding='utf-8')
        changed = sum(1 for a, b in zip(original, text) if a != b)
        print(f'  FIXED  {path}  ({changed} chars changed)')
    else:
        print(f'  clean  {path}')


print('=== Python files ===')
for f in PYTHON_FILES:
    fix_file(f, extra_replacements=PY_EXTRA)

print('\n=== JSX / JS files ===')
for f in JSX_FILES:
    fix_file(f)   # JSX keeps ₹ literal — only replaces dashes/arrows/etc.

print('\n=== Markdown files ===')
for f in MD_FILES:
    fix_file(f)

print('\nDone.')

"""
YouTube API Key Rotator
Automatically cycles through multiple YouTube Data API v3 keys
when the active key approaches its 10,000 units/day free quota.

Setup:
  Add keys to backend/.env:
    YOUTUBE_API_KEY=AIzaSy...          (key from Google account 1)
    YOUTUBE_API_KEY_1=AIzaSy...        (key from Google account 2)
    YOUTUBE_API_KEY_2=AIzaSy...        (key from Google account 3)
    ...

  Each key MUST come from a different Google Cloud project/account.
  Keys from the same project share quota -- no benefit to rotating them.

Usage (in trends_engine.py):
  from youtube_quota import yt_rotator
  key = yt_rotator.active_key()
  yt_rotator.record(units=100)
"""

import os, json, logging
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

TRACKER_FILE  = Path(__file__).parent / 'youtube_quota_tracker.json'
DAILY_LIMIT   = 10_000
ROTATE_AT     = 9_500   # switch key when this many units are used


class YouTubeKeyRotator:
    """
    Thread-safe (single-process) key rotator with persistent daily tracking.
    Resets all counters at UTC midnight (when Google resets quotas).
    """

    def __init__(self):
        self._keys: list  = []
        self._tracker: dict = {}
        self._today: str  = ''
        self._idx: int    = 0
        self._load()

    # ── Public API ────────────────────────────────────────────────────────────

    def active_key(self) -> str:
        """Return the currently-active API key. Returns '' if all keys exhausted."""
        self._maybe_reset()
        # Find first key below the rotation threshold
        for _ in range(len(self._keys)):
            key  = self._keys[self._idx]
            used = self._tracker.get(key, {}).get('used', 0)
            if used < ROTATE_AT:
                return key
            # This key is exhausted -- try next
            logger.warning(f"YouTube key {key[:12]}... at {used} units, rotating")
            self._idx = (self._idx + 1) % max(len(self._keys), 1)
        logger.error("All YouTube API keys exhausted for today")
        return ''

    def record(self, units: int):
        """Record quota units used by the active key."""
        if not self._keys:
            return
        key = self._keys[self._idx]
        entry = self._tracker.setdefault(key, {'used': 0, 'date': self._today})
        entry['used'] += units
        entry['date']  = self._today
        self._save()
        logger.debug(f"YouTube key {key[:12]}...: {entry['used']}/{DAILY_LIMIT} units today")

    def status(self) -> list:
        """Return quota status for all keys (for /api/youtube-quota endpoint)."""
        self._maybe_reset()
        result = []
        for i, key in enumerate(self._keys):
            entry = self._tracker.get(key, {'used': 0})
            used  = entry.get('used', 0)
            result.append({
                'key_prefix':  key[:12] + '...',
                'index':       i,
                'units_used':  used,
                'units_left':  max(0, DAILY_LIMIT - used),
                'pct_used':    round(used / DAILY_LIMIT * 100, 1),
                'active':      (i == self._idx),
                'exhausted':   used >= ROTATE_AT,
            })
        return result

    def total_daily_capacity(self) -> int:
        return len(self._keys) * DAILY_LIMIT

    def total_used_today(self) -> int:
        self._maybe_reset()
        return sum(self._tracker.get(k, {}).get('used', 0) for k in self._keys)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load(self):
        """Load keys from environment and usage tracker from disk."""
        # Collect all YOUTUBE_API_KEY* variables
        keys = []
        base = os.environ.get('YOUTUBE_API_KEY', '').strip()
        if base and base != 'your_youtube_api_key_here':
            keys.append(base)
        for i in range(1, 50):   # support up to 50 keys
            k = os.environ.get(f'YOUTUBE_API_KEY_{i}', '').strip()
            if k and k != 'your_youtube_api_key_here':
                keys.append(k)
        self._keys = keys

        if not keys:
            logger.info("No YouTube API keys configured")
            return

        # Load persisted tracker
        self._today = str(date.today())
        if TRACKER_FILE.exists():
            try:
                self._tracker = json.loads(TRACKER_FILE.read_text(encoding='utf-8'))
            except Exception:
                self._tracker = {}

        self._maybe_reset()

        # Find the best starting key (lowest usage)
        if keys:
            self._idx = min(
                range(len(keys)),
                key=lambda i: self._tracker.get(keys[i], {}).get('used', 0)
            )
        logger.info(
            f"YouTubeKeyRotator: {len(keys)} key(s) loaded | "
            f"active=key[{self._idx}] | "
            f"capacity={self.total_daily_capacity():,} units/day"
        )

    def _maybe_reset(self):
        """Reset usage counters if the day has changed (Google resets at midnight UTC)."""
        today = str(date.today())
        if today == self._today:
            return
        self._today = today
        for key in self._keys:
            if key in self._tracker:
                self._tracker[key]['used'] = 0
                self._tracker[key]['date'] = today
        self._idx = 0   # restart from first key each new day
        self._save()
        logger.info(f"YouTube quota counters reset for {today}")

    def _save(self):
        try:
            TRACKER_FILE.write_text(
                json.dumps(self._tracker, indent=2, ensure_ascii=True),
                encoding='utf-8'
            )
        except Exception as e:
            logger.debug(f"Quota tracker save failed: {e}")


# Singleton -- import and use this everywhere
yt_rotator = YouTubeKeyRotator()

from __future__ import annotations

import re
from core.config_loader import load_config
from core.constants import GEMINI_WAKE_TIMEOUT_SEC

# ─── Target phonetic forms ────────────────────────────────────────────────────
# Everything is compared AFTER phonetic normalisation, so "гонор", "кано",
# "conner", "конне", "Connor", etc. all collapse to the same canonical form.
_CANON_TARGET = "конор"      # "коннор" after dedup + г→к
_CANON_TARGET_EN = "conor"   # English form

# Hard-coded exact-match list (pre-normalised for speed)
_EXACT_WAKE = frozenset({
    # Correct Russian
    "коннор", "конор", "конер", "конно", "конне", "конне", "коно",
    # English variants
    "connor", "conner", "cannor", "conor",
    # Common Whisper Cyrillic mis-transcriptions
    "гонор", "кано", "канор", "ко-нор", "кон-нор",
    # With punctuation Whisper sometimes adds
    "коннор,", "конно,", "конне,", "конно.", "коннор.",
    # Very short garbles that tiny still produces
    "кон", "кoн",
})

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _levenshtein(a: str, b: str) -> int:
    """O(m·n) edit distance — fast enough for wake-word tokens (≤12 chars)."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for ch_a in a:
        curr = [prev[0] + 1]
        for j, ch_b in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ch_a != ch_b)))
        prev = curr
    return prev[-1]


def _phonetic(text: str) -> str:
    """
    Collapse phonetically similar Russian forms so Levenshtein operates on
    canonicalized strings.

    Rules (in order):
      1. Lowercase, strip punctuation
      2. Deduplicate consecutive identical letters (нн → н)
      3. г → к  (hard G sounds like hard K in many accents / Whisper errors)
      4. е / э / ё → э   (front vowel collapse)
      5. й / ы → и       (semi-vowel collapse)
      6. Drop soft/hard signs (ь / ъ)
      7. ж / ш / щ → ш   (sibilant collapse)
    """
    text = re.sub(r"[^а-яёa-z]", "", text.lower())
    text = re.sub(r"(.)\1+", r"\1", text)          # dedup: нн→н
    for old, new in (
        ("г", "к"), ("ё", "е"), ("э", "е"), ("й", "и"), ("ы", "и"),
        ("ь", ""), ("ъ", ""), ("щ", "ш"), ("ж", "ш"),
    ):
        text = text.replace(old, new)
    return text


def _token_matches_wake(token: str) -> bool:
    """
    Returns True if `token` is a wake word by exact list OR fuzzy phonetics.

    Max allowed edit distance:
      ≤3 chars → exact only
      4–5 chars → distance ≤ 1
      6+ chars  → distance ≤ 2
    """
    if token in _EXACT_WAKE:
        return True

    ph = _phonetic(token)
    tlen = len(ph)
    if tlen < 3:
        return False
    if tlen <= 3:
        threshold = 0
    elif tlen <= 5:
        threshold = 1
    else:
        threshold = 2

    for target in (_CANON_TARGET, _CANON_TARGET_EN):
        ph_target = _phonetic(target)
        if _levenshtein(ph, ph_target) <= threshold:
            return True
    return False


def _local_match(text: str) -> bool:
    """Instant local wake detection — no network calls."""
    low = text.lower().strip()
    tokens = re.split(r"[\s,.\-!?]+", low)
    tokens = [t for t in tokens if t]

    for token in tokens:
        if _token_matches_wake(token):
            return True

    # Whole-utterance fuzzy check for very short inputs (1–2 words)
    if len(tokens) <= 2:
        joined = "".join(tokens)
        if _token_matches_wake(joined):
            return True

    return False


WAKE_PROMPT = (
    "Текст с микрофона: '{text}'\n"
    "Это обращение к голосовому ассистенту по имени Коннор? "
    "Ответь ТОЛЬКО: YES или NO"
)


def is_wake(text: str) -> bool:
    """
    Three-stage wake detection:
      1. Exact list match          — instant, zero latency
      2. Fuzzy phonetic match      — ~0.1 ms, no network
      3. Gemini confirmation       — only for very short ambiguous phrases,
                                     bounded by GEMINI_WAKE_TIMEOUT_SEC

    Catches: Гонор, Конер, Кано, Конно, conner, КОННОР and ~100 other
    Whisper mis-transcriptions without any network round-trip.
    """
    low = text.lower().strip()
    if not low:
        return False

    # Stages 1+2
    if _local_match(low):
        return True

    # Stage 3 — Gemini only for ≤3-token utterances (possible mis-transcription)
    cfg = load_config()
    if not cfg.get("use_gemini_wake", True):
        return False

    tokens = low.split()
    if len(tokens) > 3:
        return False

    try:
        from openjarvis.gemini_client import generate_text
        ans = generate_text(WAKE_PROMPT.format(text=text), timeout=GEMINI_WAKE_TIMEOUT_SEC)
        if ans:
            return ans.strip().upper().startswith("YES")
    except Exception as exc:
        print(f"[Wake] Gemini error: {exc}")

    return False

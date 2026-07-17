"""Health-check every Gemini API key in the pool against the model ladder.

Usage (from repo root or backend/):
    python backend/scripts/check_gemini_keys.py
    python backend/scripts/check_gemini_keys.py --json
    python backend/scripts/check_gemini_keys.py --models gemini-3.5-flash,gemini-2.5-flash

For each GEMINI_API_KEY* env var (same regex + ordering as inference.py's pool
loader) the script fires one tiny generateContent call per ladder model and
classifies the outcome. Keys are ALWAYS masked in output (first 6 + last 4
chars) — never print full key material.

Statuses:
    OK                key + model both serve
    INVALID_KEY       400/403 API key rejected (dead from the start)
    DAILY_EXHAUSTED   429 per-day quota spent (healthy key, come back tomorrow)
    RATE_LIMITED      429 per-minute (healthy key, transient)
    MODEL_UNAVAILABLE model not served to this key (404, or 429 with limit: 0
                      — e.g. Pro models removed from the free tier)
    ERROR             anything else (network, 5xx, ...)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_DIR / ".env.local", override=False)
load_dotenv(REPO_DIR / ".env", override=False)

# Keep in sync with the default ladder in app/models/inference.py
# (duplicated deliberately — importing inference.py drags in cv2/inference-sdk).
DEFAULT_MODELS = "gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash"

API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)

# Same regex + ordering as the pool loader in inference.py.
_KEY_RE = re.compile(r"^GEMINI_API_KEY(_(\d+))?$")


def collect_keys() -> list[tuple[str, str]]:
    """Return [(env_var_name, key_value)] in pool order (base key first)."""
    found = []
    for name, value in os.environ.items():
        m = _KEY_RE.match(name)
        if m and value.strip():
            found.append((int(m.group(2)) if m.group(2) else 0, name, value.strip()))
    found.sort()
    return [(name, value) for _, name, value in found]


def mask(key: str) -> str:
    if len(key) <= 12:
        return key[:3] + "..." + key[-2:]
    return key[:6] + "..." + key[-4:]


def classify(status: int, body: str) -> str:
    lowered = body.lower()
    if status == 200:
        return "OK"
    if status in (400, 403):
        if "api key" in lowered or "api_key_invalid" in lowered or status == 403:
            return "INVALID_KEY"
        return "ERROR"
    if status == 404:
        return "MODEL_UNAVAILABLE"
    if status == 429:
        if "limit: 0" in lowered or '"limit":0' in lowered or "limit:0" in lowered:
            return "MODEL_UNAVAILABLE"
        if "perday" in lowered or "per day" in lowered or "daily" in lowered:
            return "DAILY_EXHAUSTED"
        if "perminute" in lowered or "per minute" in lowered:
            return "RATE_LIMITED"
        return "RATE_LIMITED"
    return "ERROR"


def ping(key: str, model: str, timeout: float) -> tuple[str, str]:
    """One tiny generateContent call. Returns (status_label, detail)."""
    payload = json.dumps(
        {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 20},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        API_URL.format(model=model, key=key),
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return classify(resp.status, body), ""
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        label = classify(exc.code, body)
        # Surface the API's own message for anything unexpected.
        detail = ""
        if label == "ERROR":
            detail = f"http {exc.code}"
            try:
                detail += ": " + json.loads(body)["error"]["message"][:80]
            except Exception:
                pass
        return label, detail
    except Exception as exc:  # network/timeout
        return "ERROR", f"{type(exc).__name__}: {exc}"[:90]


def main() -> int:
    parser = argparse.ArgumentParser(description="Gemini key pool health check")
    parser.add_argument(
        "--models",
        default=os.getenv("GEMINI_MODELS", DEFAULT_MODELS),
        help="comma-separated model ladder to test (default: env GEMINI_MODELS or built-in)",
    )
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--timeout", type=float, default=60.0, help="per-call timeout seconds")
    args = parser.parse_args()

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    keys = collect_keys()
    if not keys:
        print("No GEMINI_API_KEY* vars found in environment/.env", file=sys.stderr)
        return 1

    results = []
    for slot, (name, key) in enumerate(keys, start=1):
        row = {"slot": slot, "env": name, "key_masked": mask(key), "models": {}}
        for model in models:
            label, detail = ping(key, model, args.timeout)
            row["models"][model] = {"status": label, "detail": detail}
            if not args.json:
                extra = f"  ({detail})" if detail else ""
                print(f"[{name}] {mask(key)}  {model:<28} {label}{extra}", flush=True)
        results.append(row)

    if args.json:
        print(json.dumps({"models": models, "keys": results}, indent=2))
        return 0

    # Summary table
    col = max(len(r["env"]) for r in results)
    print()
    header = f"{'KEY':<{col}}  {'MASKED':<16}" + "".join(f"  {m:<28}" for m in models)
    print(header)
    print("-" * len(header))
    for r in results:
        line = f"{r['env']:<{col}}  {r['key_masked']:<16}"
        for m in models:
            line += f"  {r['models'][m]['status']:<28}"
        print(line)

    print()
    for m in models:
        ok = sum(1 for r in results if r["models"][m]["status"] == "OK")
        print(f"{ok}/{len(results)} keys healthy on {m}")
    dead = [r["env"] for r in results if all(v["status"] == "INVALID_KEY" for v in r["models"].values())]
    if dead:
        print(f"DEAD KEYS (invalid on every model): {', '.join(dead)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

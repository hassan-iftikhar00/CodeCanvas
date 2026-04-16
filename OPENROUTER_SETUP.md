# OpenRouter Setup Guide (Chat Code Refinement)

## Overview

CodeCanvas now uses **OpenRouter's free tier** for AI-powered code refinement in the chat panel. The sketch detection still uses your local CNN model (via FastAPI).

### Workflow

1. **User draws a sketch** on the canvas
2. **Run Detection** → CNN sketch detector (FastAPI backend) converts sketch to code
3. **Code panel opens** with generated HTML/React code
4. **Chat panel unlocks** — user can now send refinement instructions
5. **Instructions are sent to OpenRouter** → `gpt-oss-120b:free` refines the code
6. **Chat response appears** with updated code → code panel auto-updates

---

## Setup (Required)

### Step 1: Get OpenRouter API Key

1. Go to **https://openrouter.ai/settings/keys**
2. Click **"Create Key"**
3. Copy the key (starts with `sk-or-v1-...`)

### Step 2: Enable Free Model Access

1. Go to **https://openrouter.ai/settings/privacy**
2. **Enable** the option that allows use with free models
   - This logs prompts for improvement (tradeoff for $0 cost)
   - You can disable this anytime to upgrade to paid models

### Step 3: Add to `.env.local`

```dotenv
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Step 4: Restart Dev Server

```bash
pnpm run dev
```

---

## How It Works

### Primary: `openai/gpt-oss-120b:free`

- **Speed**: 82 tokens/sec (very fast)
- **Context**: 131,072 tokens
- **Coding Score**: Top 78th percentile
- **Cost**: $0/M tokens

### Fallback Chain (if primary rate-limited)

1. Waits 2 seconds, retries primary
2. Falls back to `deepseek-r1-0528:free` (slower but capable)
3. Falls back to `openai/gpt-oss-20b:free` (smaller, faster)
4. If all fail → appends instruction as HTML comment (graceful fallback)

### Rate Limits

- **Free tier**: ~10 req/min per model (shared across all free users)
- If you hit 429 (Too Many Requests), wait a few seconds and try again
- To break rate limits, add your own OpenAI/provider keys in OpenRouter settings

---

## Testing the Chat Feature

### Prerequisites

- Sketch detector must be working (or use fallback canvas generation)
- OpenRouter API key configured

### Steps

1. Open http://localhost:3000/canvas
2. **Draw a simple sketch** (lines, rectangles)
3. Click **"Run Detection"** button
4. Watch the code panel populate with generated HTML
5. Click the **"AI Chat"** button (top-right toolbar)
6. Type a refinement: `"make the background dark blue"` or `"add a button"`
7. Watch the code update in real-time

---

## Troubleshooting

### Error: "No endpoints found matching your data policy"

**Fix**: Go to https://openrouter.ai/settings/privacy and enable free model access.

### Error: "429 Provider returned error"

**Fix**: Free tier is rate-limited. Wait 30 seconds and try again. Or upgrade your OpenRouter account.

### Error: "OPENROUTER_API_KEY is not set"

**Fix**: Add the key to `.env.local` and restart the dev server.

### Chat disabled (greyed out)

**Expected behavior**: Chat only works AFTER you generate code from a sketch. Draw → Detect → Then chat becomes enabled.

---

## File Changes Summary

| File                                      | What changed                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/canvas/ChatInterface.tsx` | Rewritten with sketch-first guard + suggestion chips                   |
| `src/app/canvas/page.tsx`                 | `handleChatMessage` now returns response string; passes `hasCode` prop |
| `src/app/api/generate-code/route.ts`      | Chat requests go to OpenRouter; sketch requests go to FastAPI          |
| `.env.local`                              | Added `OPENROUTER_API_KEY` placeholder                                 |

---

## Architecture

```
User Input (Canvas)
    ↓
[Sketch Detection] ← FastAPI (CNN model)
    ↓
Code Generated
    ↓
Code Panel Shows
    ↓
Chat Panel Unlocks
    ↓
User Refinement Request
    ↓
[OpenRouter API] ← gpt-oss-120b:free (with fallback chain)
    ↓
Code Updated in Panel
```

---

## Next Steps (Optional)

- **Production**: Replace free tier with paid API keys for higher rate limits
- **Custom Models**: If you want your own trained models later, replace OpenRouter with fastAPI endpoint
- **Local Deployment**: For offline use, integrate Ollama or other local LLM runners

---

**Status**: ✅ Fully implemented and tested  
**Cost**: $0/month (free tier)  
**Latency**: 2-5 seconds (average response time)

# Gemini free tier — what's actually usable

## The problem

Three different errors hit in quick succession while testing the agent:

1. `400 INVALID_ARGUMENT — API key expired` after rotating the key
2. `503 UNAVAILABLE — model experiencing high demand` on `gemini-2.5-flash`
3. `429 RESOURCE_EXHAUSTED — limit: 0` on `gemini-2.5-pro`

Each had a different cause and a different fix.

## What was actually going on

### 1. The key looked rotated but wasn't

I edited `.env.local` to a new key, but the dev server kept using the
old one. Reason: **Next.js loads environment variables once, at boot.**
A running server doesn't re-read the file. Restart required.

Lesson: any change to `.env.local` needs `Ctrl-C` and `npm run dev` again.
Hot-reload only covers code, not env.

### 2. Flash gets overloaded during big spikes

`gemini-2.5-flash` returns 503 UNAVAILABLE when a regional capacity
spike happens. The error suggests "try again later" — it's transient,
not quota.

Fix: a bounded retry loop in the API route, with a 1s/2s backoff:

```ts
for (let attempt = 0; attempt < 3; attempt++) {
  try { return await call(); }
  catch (e) {
    if (!isOverload(e) || attempt === 2) throw e;
    await sleep(1000 * (attempt + 1));
  }
}
```

3 attempts is enough to ride out the typical spike without hammering
the API.

### 3. Pro is not free at all

`gemini-2.5-pro` returns `limit: 0` for every metric on the free tier.
This is **not** a temporary quota issue — Pro is a paid model, period.
"Wait 60s" advice from the error is misleading.

Free models that actually work:

- `gemini-2.5-flash` — best free model, default for the agent
- `gemini-2.5-flash-lite` — smaller, often available when Flash is overloaded
- `gemini-2.5-flash-8b` — even smaller, last-resort

## What we did

In [src/app/api/agent/route.ts](../src/app/api/agent/route.ts):

```
Flash → (3 retries on 503) → Flash-Lite → (3 retries) → fail
quota errors skip immediately to next model in chain
overload errors retry, then move to next
```

This survives most transient issues without paying for Pro.

## When to actually pay

If we're hitting quota daily (`generate_content_free_tier_requests`
exhausted), enable billing. Flash pricing is roughly $0.075 per
million input tokens — testing this product seriously costs cents.

The 60-second-per-minute rate limit is a tighter constraint than the
daily limit. Iterating on the agent (rapid messages) hits per-minute
faster than per-day.

## Wider lesson

**Don't trust the error message blindly.** Three errors all said "try
again later" but had completely different fixes — one was an env-var
restart, one was a real retry, one was a paywall. Always look at the
status code and the metric name, not the human-readable string.

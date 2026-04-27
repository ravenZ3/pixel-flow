# The agent kept creating empty ImageInputs

## The problem

First end-to-end agent test: an ImageInput already existed on the
canvas with a real uploaded image. The user asked the agent to build
a pipeline. Instead of wiring into the existing ImageInput, the agent
**created a brand-new one** and built its pipeline off that. The new
node had no upload, so the pipeline produced nothing.

## Why it happened

The system prompt said to "call read_graph before modifying" but
treated reuse as a soft suggestion. From the agent's point of view,
adding a fresh ImageInput is the simplest, most local action — it
doesn't have to reason about the existing one, just spawn what it
needs.

The catch: **ImageInput holds runtime state (the uploaded ImageBitmap)
that the agent can never recreate.** A fresh ImageInput is always empty.
Same goes for Output — there should be exactly one and the agent
should target it.

## The fix

Tightened the system prompt in
[src/lib/agent/loop.ts](../src/lib/agent/loop.ts):

- "ALWAYS call read_graph before mutating. Never create a duplicate
  of a node that already exists."
- A specific CRITICAL rule for ImageInput: "If one exists you MUST
  connect to it. A fresh ImageInput is empty and produces no output."
- Same rule for Output.

This is the right level to enforce it. It's a behavioral constraint,
not a code constraint, so it lives in the prompt.

## Wider lesson

**Source/sink nodes (anything holding runtime state the agent can't
recreate) need to be treated specially in the prompt.**

Every time we add a new node type that holds out-of-graph state — an
uploaded image, a hand-drawn mask, a saved palette, an external API
binding — the prompt has to explicitly mark it as "reuse, never
recreate." Forgetting will produce the same class of silent-empty-pipeline
bug.

If this list grows, move it from the prompt into the schema itself
(e.g. a `singleton: true` or `holds_runtime_state: true` flag) so the
agent gets it programmatically.

## Things that did *not* fix this

- Restating the rule more politely. The original prompt already said
  "call read_graph before modifying." Vague guidance lost to "just
  add a node, that's simpler."
- Lowering temperature. Not a sampling issue.

What worked was making the rule **specific, named, and capitalized**
(CRITICAL / MUST / ALWAYS) — and tying it to a concrete consequence
("an empty ImageInput produces no output"). Models follow rules they
can predict the cost of breaking.

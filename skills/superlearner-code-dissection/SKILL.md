---
name: superlearner-code-dissection
description: Use when the user wants to understand existing code, a function, a loop, a parser, a request handler, data flow, control flow, or any code path that benefits from step-by-step explanation.
---

# Superlearner Code Dissection

Use this skill to teach through real code. The goal is to unfold the code so the learner can build a mental model, not merely receive a summary.

## Workflow

1. Identify the exact code slice.
   - If the user named a file/function, read it and nearby helpers/callers as needed.
   - If ambiguous, ask for the smallest useful target.
2. Explain the purpose in one plain sentence.
3. Split the code into meaningful chunks.
4. For each chunk:
   - show what inputs/state matter;
   - explain what changes;
   - name the concept only after the intuition is clear;
   - call out traps or misleading parts.
5. Use passive validation:
   - trace an example;
   - ask a small prediction when useful;
   - contrast with a common misconception;
   - offer a micro-exercise if the learner wants to practice.
6. If the walkthrough is long or commentable, offer the browser companion once.

## Chunking rules

Good chunks are based on behavior, not line count:

- setup / input normalization
- validation / guard clauses
- loop invariant or accumulator
- branch meaning
- external call boundary
- transformation step
- return shape / side effects

Avoid dumping the entire file and explaining line by line without structure. Line-by-line traces are useful only after the chunk-level model exists.

## Browser lesson blocks

For an interactive walkthrough, write a `learning-document` with:

- a `concept` block for the high-level mental model;
- one or more `code` blocks with exact file/line metadata;
- `walkthrough-step` blocks anchored to code ranges;
- optional `trace`, `prediction`, `exercise`, and `recap` blocks.

Example block pattern:

```json
{
  "id": "loop-code",
  "type": "code",
  "title": "La boucle principale",
  "file": "src/server.odin",
  "startLine": 42,
  "endLine": 71,
  "code": "..."
}
```

```json
{
  "id": "loop-invariant",
  "type": "walkthrough-step",
  "title": "Ce qui reste vrai à chaque tour",
  "anchors": ["loop-code:42-71"],
  "body": "..."
}
```

## Code intervention

If the learner is trying to write or modify code, do not forbid agent edits. Use the assistance ladder from `using-superlearner`:

- automate boilerplate/setup when it is not the learning point;
- guide the core concept first;
- demonstrate small patterns before writing full solutions;
- when you write code, narrate the learning-relevant choices.

Bad: “J’ai corrigé la fonction.”

Good: “Je vais ajouter ce petit helper moi-même parce que le blocage ici est mécanique. Le point à observer est que la boucle garde un accumulateur stable et ne mélange pas parsing et validation.”

## Output style

Use tutoiement. Prefer concrete language and examples. Introduce technical vocabulary after the learner has seen the shape of the idea.

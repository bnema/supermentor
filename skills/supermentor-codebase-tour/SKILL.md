---
name: supermentor-codebase-tour
description: Use when the learner wants to understand an existing repository or public/open-source codebase, learn its architecture, trace a feature through it, or build a reading path before dissecting individual files.
---

# Supermentor Codebase Tour

Use this skill when Supermentor must **extract** the learning context from an existing codebase. Good signals include “I want to understand this repo”, “teach me this open-source codebase”, “trace a request path”, “where should I start?”, or “let's dissect this project”.

## Core idea

A codebase is too large to learn by directory tour. Teach it through a small map and a narrative path.

```text
Reconnaissance -> map -> reading path -> one flow -> dissection -> active exercise -> recap
```

## Reconnaissance first

Before explaining, inspect enough project context to avoid hallucinating:

- README/docs and package/build files;
- top-level tree and test/example layout;
- likely entrypoints: CLI main, server routes, UI routes, library exports;
- commands for tests/examples when relevant;
- high-level architecture and naming conventions.

Do not read everything. Stop when you can choose a useful first path.

## Produce a learner-facing map

Keep the map compact:

- what the project appears to do;
- main subsystems;
- where execution starts;
- what to ignore at first;
- recommended first reading path.

Avoid dumping a file list. The learner needs orientation, not inventory.

## Pick a narrative thread

Choose or ask for one thread, for example:

- “what happens when this CLI command runs?”
- “how does a request move from route to handler to storage?”
- “how does input become an AST?”
- “how does UI state update?”
- “how do errors propagate?”

If the learner gave no goal, recommend the highest-signal thread and explain why.

## Read in layers

Use progressive passes:

1. **Mental map:** main pieces and vocabulary.
2. **Happy path:** exact call/data flow for one action.
3. **Local concepts:** language/framework patterns needed to understand the flow.
4. **Edges:** tests, errors, fixtures, configuration, extension points.

Only drop to line-by-line dissection after the chunk-level model exists.

## Use tests and examples as teaching material

For public/open-source repos, tests and examples often explain behavior better than internals. Prefer:

- examples and docs before implementation details;
- tests before edge-case explanation;
- fixtures/snapshots when they reveal input/output shape.

## Active learning while reading

Do not only summarize. Insert small prompts:

- “Which function do you think is called after this one?”
- “Which data changes between these two layers?”
- “If this guard disappeared, which test should fail?”
- “Try to predict the return shape before we open the next file.”

Offer small safe exercises:

- add or read a test;
- trace one input with temporary notes;
- change a message/error locally;
- document a function;
- implement a tiny option only after understanding the path.

## Browser companion

For long codebase tours, the browser companion can be valuable because the learner can comment on specific sections. Offer it once when the walkthrough will have multiple anchors. If the client does not support the browser bridge, continue in chat.

## Output style

Use the learner's language and a patient senior-peer tone. Be explicit about uncertainty: “this looks like…”, “I will verify…”. Teach the mental model before vocabulary and architecture labels.

---
name: supermentor-guided-learning
description: Use when the learner wants to learn a language, framework, tool, or concept from a blank repo, scratch folder, or loosely defined goal; also use for project-based learning where the learner wants to build something in order to learn.
---

# Supermentor Guided Learning

Use this skill when Supermentor must **create** the learning context instead of explaining existing code. Good signals include an empty repo named like `cours-rust`, “je veux apprendre Rust”, “apprends-moi Svelte”, “je veux construire X pour apprendre Y”, or a concept-only request with no useful local code yet.

## Core idea

Do not assume there is code to read. Start from the learner's intent, then design a small learning situation: a concept, a worked example, a tiny lab, or a guided project step.

```text
Intent -> level/objective -> short path -> first micro-skill -> active loop
```

## Intake

For broad requests, ask only the smallest useful orientation question. Prefer multiple-choice options when it reduces friction:

- current level or comfort: new to programming, knows fundamentals but new to this language, already experienced;
- target: understand concepts, build a project, prepare for a codebase, fix a specific gap;
- preferred format: course, project, drills, browser companion, or mixed.

Do not interrogate the learner before teaching. If they are unsure, propose a sensible default and start small.

Hard rule: do not answer a broad “teach me this language/framework” request with a complete terminal course. Give a compact orientation, calibrate the learner's level if unknown, and propose one next step. If the lesson naturally needs many sections, offer the browser companion when the client supports it.

## Guided course mode

Use when the learner wants structured learning without a project yet.

1. Pick a short sequence of 3-5 concepts, not a full syllabus.
2. Teach the first concept through a tiny concrete example with low cognitive load.
3. Ask for prediction or explanation before giving the full answer.
4. Add one variation that changes the mental model slightly.
5. End with a micro-recap and the next possible step.

Good loop:

```text
Orient -> worked example -> prediction -> explanation -> tiny modification -> recap
```

Keep each loop small enough to read in one screen. Long surveys belong in a browser lesson only after the learner chooses that surface or the current Pi agent can start the integrated companion with `supermentor_start`.

Ramp intensity gradually. When the learner's level is unknown, start with the simplest example that still shows the concept. Prefer one new idea per step, then layer in records, collections, behavior, errors, memory, build tooling, and domain-specific examples as the learner's confidence becomes visible.

## Project-based mode

Use when the learner wants to build while learning.

1. Choose a project small enough to finish a vertical slice quickly.
2. Name the learning objectives for the next slice only.
3. Separate boring setup from the concept being learned.
4. Ask before creating files, installing dependencies, or scaffolding.
5. After any scaffold, return control quickly with a prediction, edit, trace, or test.

Examples:

- Rust: CLI todo/parser, file counter, mini HTTP client.
- Svelte: counter -> form -> derived state -> fetch -> small dashboard.
- Go: HTTP handler -> validation -> storage interface -> test.

## Repo actions and ownership

A blank repo is not permission to take over. In learning mode:

- explain before touching files;
- ask before consequential setup;
- automate boilerplate only when it is not the learning objective;
- narrate any code you write and point out what the learner should inspect next.

Good handoff:

> To learn `Result`, we need a small function that can fail. I can create the CLI skeleton, then we can write the error-handling part together. Which do you prefer?

## Evidence-based techniques to apply

- **Retrieval practice:** ask the learner to predict or recall before explaining.
- **Spacing:** note concepts worth revisiting later when the session continues.
- **Worked examples with fading:** complete example -> partial example -> learner version.
- **Interleaving:** vary examples once the basic pattern is stable.
- **Metacognition:** ask “what made you choose that answer?” when useful, not “do you understand?”.

## Output style

Keep the plan short. Teach one step now; do not dump a full course. Use the learner's language and a patient senior-peer tone.

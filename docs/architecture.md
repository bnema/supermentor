# supermentor architecture

## Overview

supermentor has three layers that let a coding agent mentor the human learner:

1. **Pedagogical skills** — the portable core. They teach the agent to recognize learning intent, inspect available context, choose a learning method, and keep code intervention pedagogical.
2. **Local learning server** — an optional browser companion that serves an adaptive document and converts browser inline questions into filesystem side-thread events.
3. **Harness adapters** — optional client-specific bridges. They expose commands, start the local server, or route browser events into a client session where that client supports it.

The default product model is **skill-first, command-optional**. Supermentor should work from natural-language requests in clients that only support skills or chat. Slash commands and the browser companion are convenience surfaces, not the required learning interface.

## Learning method model

Supermentor routes each request from the learner's goal, learner calibration, and the context available in the current workspace. It does not select rigid modes from keywords alone. If the first message is ambiguous, the agent asks one calibration question at a time about learner level, learning objective, desired learner effort, and desired agent intervention before producing a plan, lesson, exercise ladder, or browser document.

```text
Learning request -> intent -> learner calibration -> available context -> learning method -> active teaching loop
```

Important contexts:

- **Blank repo or scratch folder** — Supermentor creates a learning context through a tiny course, lab, or project slice.
- **Project idea** — Supermentor teaches by building one small vertical slice while preserving learner ownership.
- **Existing or public codebase** — Supermentor extracts a learning context by mapping the repo, selecting a narrative reading path, and dissecting one flow.
- **Selected code or named file** — Supermentor performs local code dissection.
- **Error, log, or failing test** — Supermentor teaches through diagnosis and evidence.
- **Concept-only question** — Supermentor verifies source-sensitive facts, then teaches with examples and recall prompts.

The neutral v1 learning-method palette is:

- exercises;
- guided projects;
- worked examples;
- code dissection;
- codebase tours;
- debugging lessons;
- drills/predictions;
- recaps.

Exercise-based learning means the learner writes code in their IDE/current codebase. The agent frames the task, gives constraints, offers hints, reviews attempts, corrects misconceptions, and withholds the full solution unless requested or after a real attempt/blockage.

## Core data model

`lesson.json` is a single adaptive learning document. It can represent concept lessons, code walkthroughs, practice labs, project lessons, and recaps using block types instead of separate rigid templates.

```json
{
  "kind": "learning-document",
  "version": 1,
  "sessionId": "sm_...",
  "title": "Comprendre une boucle HTTP",
  "intro": "...",
  "blocks": [
    {
      "id": "request-loop",
      "type": "code",
      "title": "La boucle principale",
      "file": "server.odin",
      "startLine": 42,
      "endLine": 71,
      "code": "..."
    },
    {
      "id": "step-accept",
      "type": "walkthrough-step",
      "title": "Accepter une connexion",
      "anchors": ["request-loop:42-48"],
      "body": "..."
    }
  ]
}
```

Useful block types for v1:

- `concept`
- `code`
- `walkthrough-step`
- `trace`
- `prediction`
- `exercise`
- `recap`

## Side-thread flow

```text
browser comment
  -> POST /api/inline-question
  -> question.json in cache session
  -> stdout { type: "inline-question", ... }
  -> harness adapter injects compact prompt into agent session
  -> agent reads question.json and writes reply.json
  -> browser polls /api/threads/<threadId>
  -> reply appears under the commented block
```

The question enters the main agent context through the adapter so it can use the ongoing conversation, codebase context, and loaded skills. The answer body does not become the main chat response; it lives in `reply.json` and the browser.

## Security model

The server is loopback-only. `SUPERMENTOR_HOST` may be `127.0.0.1` or `::1`; non-loopback values are rejected at startup. This is intentional because the initial HTML page embeds a random per-server token used for browser API calls.

The browser can read session and lesson data and submit inline questions. It cannot overwrite `lesson.json` through HTTP; agents update lessons by writing the session file directly. When agents update a lesson, they should preserve existing inline comments and answers.

Inline question submission waits for a short launcher acknowledgement before telling the browser the question was delivered to the active agent session.

## Storage

Sessions are outside the current repository and use a platform cache directory:

```text
SUPERMENTOR_CACHE_DIR/sessions/<sessionId>/          # explicit override
$XDG_CACHE_HOME/supermentor/sessions/<sessionId>/    # Linux/Unix when set
~/.cache/supermentor/sessions/<sessionId>/           # Linux/Unix fallback
~/Library/Caches/supermentor/sessions/<sessionId>/   # macOS fallback
%LOCALAPPDATA%\supermentor\sessions\<sessionId>\    # Windows fallback
```

This matters because learning can happen from any directory, including `$HOME` or scratch folders with no git repository.

## Pedagogical policy

supermentor should use an assistance ladder, not a binary “agent does it / human does it” split:

1. Orient with the idea and constraints.
2. Guide the next small step.
3. Demonstrate a small targeted pattern.
4. Implement with narration when the blocker is mechanical or repeated.
5. Automate boilerplate/setup that is not the learning objective.

When the agent touches code, it must explain why, what pattern it illustrates, and what the learner should notice next.

The default voice is tutoiement: a patient senior peer, not a school teacher. Avoid “tu as compris ?” as the default checkpoint. Prefer passive comprehension validation: predictions, traces, contrastive examples, optional micro-exercises, and concise recaps.

## Client capability model

Client integrations do not all expose the same extension features:

- **Pi** supports Supermentor skills plus an agent-callable `supermentor_start` tool and extension commands for the browser companion.
- **OpenCode** currently registers skills and bootstrap instructions; the browser bridge is not claimed as supported yet.
- **Claude Code** currently uses Supermentor as a local skills-directory plugin; the browser bridge is not claimed as supported yet.
- **Codex** currently uses local skill installation; the browser bridge is not claimed as supported yet.

This means Supermentor docs and skills must not require commands such as `/supermentor-start` for core learning. They may mention commands only as optional features where the client supports them. In Pi, integrated browser sessions should be started by `supermentor_start` or `/supermentor-start`; starting `server.cjs` manually bypasses the inline-question bridge.

## Browser companion offer

The browser companion is an optional side guide for teaching/learning sessions, not a coding environment, generic design canvas, product-brainstorming surface, or separate learning mode. It can show readable steps, references, success criteria, inline questions/comments, and action callbacks while the learner writes code in their IDE/current codebase. A running session is updated by rewriting `lesson.json`; the server should not be restarted for each exercise.

Do not push the browser companion by default. For longer exercise paths, ask whether the learner wants chat/terminal or the browser side guide. Offer it only when useful and supported by the current client:

> Je peux te répondre directement ici. Pour un parcours plus long, on peut rester dans le chat/terminal, ou ouvrir un guide latéral dans le navigateur avec les étapes, critères de réussite et commentaires si ce client le permet. Tu écris toujours le code dans ton IDE ou ton codebase.

If the learner declines, continue in chat without repeated offers.

## Exercise document defaults

Exercise JSON should stay minimal. Supermentor infers default English action labels such as "I'm struggling" and "Review my attempt". Lesson authors should describe the task, constraints, references, hints, and success criteria rather than hardcoding UI labels or localized placeholders. Reviewing an attempt is the completion checkpoint for a step. Initial exercise documents must not include full expected programs or complete solution blocks; code blocks in an exercise guide should be skeletons, partial snippets, API references, or post-attempt corrections.

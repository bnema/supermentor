# superlearner architecture

## Overview

superlearner has three layers:

1. **Pedagogical skills** — teach the agent how to recognize learning intent, choose a teaching strategy, and keep code intervention pedagogical.
2. **Local learning server** — serves an adaptive document and converts browser inline questions into filesystem side-thread events.
3. **Harness adapters** — bridge server events into a client session and tell the agent where to read questions and write replies.

The browser is a companion, not the default interface. The agent should offer it when interactivity adds real learning value.

## Core data model

`lesson.json` is a single adaptive learning document. It can represent concept lessons, code walkthroughs, practice labs, project lessons, and recaps using block types instead of separate rigid templates.

```json
{
  "kind": "learning-document",
  "version": 1,
  "sessionId": "sl_...",
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

The server is loopback-only. `SUPERLEARNER_HOST` may be `127.0.0.1` or `::1`; non-loopback values are rejected at startup. This is intentional because the initial HTML page embeds a random per-server token used for browser API calls.

The browser can read session and lesson data and submit inline questions. It cannot overwrite `lesson.json` through HTTP; agents update lessons by writing the session file directly.

Inline question submission waits for a short launcher acknowledgement before telling the browser the question was delivered to the active agent session.

## Storage

Sessions are outside the current repository:

```text
$XDG_CACHE_HOME/superlearner/sessions/<sessionId>/
~/.cache/superlearner/sessions/<sessionId>/
```

This matters because learning can happen from any directory, including `$HOME` or scratch folders with no git repository.

## Pedagogical policy

superlearner should use an assistance ladder, not a binary “agent does it / human does it” split:

1. Orient with the idea and constraints.
2. Guide the next small step.
3. Demonstrate a small targeted pattern.
4. Implement with narration when the blocker is mechanical or repeated.
5. Automate boilerplate/setup that is not the learning objective.

When the agent touches code, it must explain why, what pattern it illustrates, and what the learner should notice next.

The default voice is tutoiement: a patient senior peer, not a school teacher. Avoid “tu as compris ?” as the default checkpoint. Prefer passive comprehension validation: predictions, traces, contrastive examples, optional micro-exercises, and concise recaps.

## Browser companion offer

Do not push the browser companion by default. Offer it only when useful:

> Je peux te répondre directement ici. Si tu veux rendre cet apprentissage plus interactif, je peux ouvrir un espace où tu pourras commenter les sections ou les lignes de code qui coincent, et je répondrai directement sous ces passages.

If the learner declines, continue in chat without repeated offers.

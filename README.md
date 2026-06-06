# supermentor

supermentor is an adaptive mentorship layer that helps coding agents teach humans code, concepts, and projects. It combines a skill-first pedagogy with an optional local browser companion for lessons, code walkthroughs, exercises, and inline questions.

The goal is not to make the agent finish a course. The goal is to help the learner build a complete mental model: slow down when the material gets dense, dissect code step by step, validate understanding passively, and keep inline clarifications attached to the exact section or code range that triggered them.

## Product stance

- **Skill-first, harness-aware** — v1 ships a complete Pi extension, local skill/bootstrap installs for OpenCode, Claude Code, and Codex, reusable adapter helpers, and the same file/stdout protocol other harnesses can adopt. Browser side-thread support is only claimed where a tested harness bridge exists.
- **Browser optional** — the agent should answer directly in chat for small questions. It should offer the browser companion only when comments, code anchors, progress, or section-level interaction materially improve learning.
- **Adaptive pedagogy** — the agent chooses between explanation, walkthrough, trace, practice, project-based learning, and code intervention from user intent and learning signals, not rigid keywords.
- **Assist, don't bypass** — the agent may write boilerplate or demonstrate code when useful, but it must keep the learning objective explicit and never silently do the conceptual work for the learner.
- **Side-thread inline questions** — browser comments use the main agent context, but answers are written to structured reply files and rendered back under the commented section.

## V1 scope

V1 focuses on a reusable foundation:

1. A local HTTP server that serves a learning document from an out-of-repo cache session.
2. A browser UI for adaptive sections, code blocks, comments, and inline replies.
3. A filesystem side-thread protocol for browser questions and agent replies.
4. Local install instructions for Pi, OpenCode, Claude Code, and Codex, plus reusable adapter helpers for harness bridges.
5. Skills that teach the agent how to route learning requests pedagogically.

## Installation

Installation is local-only for now. Install Supermentor separately for each agent client you use. The consistent flow is:

1. clone or copy this repository onto the machine running the agent;
2. read the install instructions for your client;
3. run the local installer script or create the documented symlinks;
4. restart the client and verify the skills are visible.

Recommended checkout location:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

If you are developing Supermentor, use your development checkout instead.

### Support matrix

| Client | Local install status | Browser companion | Notes |
| --- | --- | --- | --- |
| Pi | Supported | Supported | Pi package installs skills and `/supermentor-*` extension commands. |
| OpenCode | Supported for skills/bootstrap | Not yet claimed | Local plugin registers skills and injects the teaching bootstrap. Inline question delivery bridge is future work. |
| Claude Code | Supported for skills/bootstrap | Not yet claimed | Local skills-directory plugin via `.claude-plugin/plugin.json`. |
| Codex | Supported for skills | Not yet claimed | Local skill symlinks into `~/.agents/skills`; no marketplace plugin yet. |

### Pi

Install the local checkout as a Pi package:

```bash
pi install ~/.local/share/supermentor
```

Or from a development checkout:

```bash
pi install /absolute/path/to/supermentor
```

After installing, start a new Pi session. The skills are discovered from `skills/`, and the optional browser companion is available through:

```text
/supermentor-start [title]
/supermentor-status
/supermentor-stop
```

Detailed instructions: [`install/pi.md`](install/pi.md).

### OpenCode

Tell OpenCode:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/opencode.md.
```

Or run from the Supermentor checkout:

```bash
node scripts/install-local.mjs opencode
```

This links `.opencode/plugins/supermentor.js` into `~/.config/opencode/plugins/`. The plugin registers Supermentor skills and injects the `using-supermentor` teaching bootstrap.

Detailed instructions: [`install/opencode.md`](install/opencode.md).

### Claude Code

Tell Claude Code:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/claude-code.md.
```

Or run from the Supermentor checkout:

```bash
node scripts/install-local.mjs claude
```

This links the checkout into `~/.claude/skills/supermentor`. Claude Code loads it as a local skills-directory plugin because the checkout contains `.claude-plugin/plugin.json` and `skills/`.

Detailed instructions: [`install/claude-code.md`](install/claude-code.md).

### Codex

Tell Codex:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/codex.md.
```

Or run from the Supermentor checkout:

```bash
node scripts/install-local.mjs codex
```

This links Supermentor skill folders into `~/.agents/skills/`. This is intentionally local skill installation, not a Codex marketplace plugin.

Detailed instructions: [`install/codex.md`](install/codex.md).

### Generic/manual adapter mode

The package includes reusable protocol helpers in `client-shared.js`, `pi.js`, and `opencode.js`. Harnesses without a tested browser bridge can still use the skills locally. To support inline browser questions, a harness adapter must:

1. read `server-started` and `inline-question` JSON events from stdout;
2. inject inline questions into the active agent context;
3. write `supermentor-ack` JSON lines to stdin; and
4. tell the agent to answer browser questions by writing the requested `reply.json` file.

Do not claim browser companion support for a client until that delivery bridge is implemented and tested end to end.

## Session storage

supermentor does **not** write session state into the current project by default. Sessions live under the platform cache directory:

```text
SUPERMENTOR_CACHE_DIR/sessions/<sessionId>/          # explicit override
$XDG_CACHE_HOME/supermentor/sessions/<sessionId>/    # Linux/Unix when set
~/.cache/supermentor/sessions/<sessionId>/           # Linux/Unix fallback
~/Library/Caches/supermentor/sessions/<sessionId>/   # macOS fallback
%LOCALAPPDATA%\supermentor\sessions\<sessionId>\    # Windows fallback
```

A session contains:

```text
session.json          # manifest: id, cwd, title
server.json           # current server URL/token when running
lesson.json           # adaptive learning document
threads/<threadId>/
  question.json       # browser question written by the server
  reply.json          # agent answer written by the coding agent
events.jsonl          # append-only operational events
```

## Inline question protocol

When the learner comments on a block in the browser, the server writes a `question.json` file and emits an event on stdout:

```json
{
  "type": "inline-question",
  "requestId": "req_abc123",
  "payload": {
    "threadId": "thr_abc123",
    "question": "Why is this loop here?",
    "selection": "for (...) { ... }",
    "paths": {
      "questionPath": "/.../question.json",
      "replyPath": "/.../reply.json"
    },
    "instruction": "Read .../question.json. Write the answer JSON to .../reply.json."
  }
}
```

The harness adapter injects that event into the active agent session. The agent reads `question.json`, writes `reply.json`, and keeps the main chat compact.

Expected reply shape:

```json
{
  "type": "inline_reply",
  "threadId": "thr_abc123",
  "markdown": "This loop is here because...",
  "followups": [
    { "label": "Walk through a trace", "kind": "trace" },
    { "label": "Give me a mini exercise", "kind": "exercise" }
  ]
}
```

The browser polls the thread endpoint and renders the reply below the original comment.

## Development

```bash
npm test
```

Start the server manually for UI/server smoke testing:

```bash
node server.cjs
```

The server prints a `server-started` JSON event containing the URL, session id, session directory, and token. It is intentionally loopback-only (`127.0.0.1` or `::1`) because the initial HTML page embeds the API token needed by the browser. Inline browser questions require a harness adapter to acknowledge stdout events and route the question back into the agent context; manual server mode does not provide that delivery bridge by itself.

## License

MIT © bnema

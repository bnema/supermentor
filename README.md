# supermentor

supermentor is a local teaching toolkit for coding agents. It provides portable teaching skills, client install helpers, and an optional Pi browser companion for longer lessons, code walkthroughs, exercises, and inline questions.

The primary interface is skill-based mentoring in the agent chat. Slash commands and browser support are available only when the client integration provides them.

## What it includes

- Teaching skills for guided learning, code dissection, codebase tours, and setup support.
- Local install helpers for Pi, OpenCode, Claude Code, and Codex.
- A Pi extension with `supermentor_start` plus `/supermentor-start`, `/supermentor-status`, and `/supermentor-stop`.
- A local HTTP server and file-based protocol for browser lessons and inline comments.
- Adapter helpers for harness integrations.

Browser side-thread support requires a tested harness bridge. Pi supports the browser companion today. OpenCode, Claude Code, and Codex can use the local skills, but their browser companion bridges are not supported yet.

## Local installation

Install Supermentor separately for each agent client:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
node scripts/install-local.mjs pi
```

Supported install targets:

```bash
node scripts/install-local.mjs pi
node scripts/install-local.mjs opencode
node scripts/install-local.mjs claude
node scripts/install-local.mjs codex
```

Use your development checkout instead of `~/.local/share/supermentor` when working on Supermentor itself. Use `--copy` if symlinks are inconvenient:

```bash
node scripts/install-local.mjs codex --copy
```

### Client support

| Client | Local support | Browser companion | Install details |
| --- | --- | --- | --- |
| Pi | Skills + extension commands | Supported | [`install/pi.md`](install/pi.md) |
| OpenCode | Skills + bootstrap plugin | Not supported yet | [`install/opencode.md`](install/opencode.md) |
| Claude Code | Skills-directory plugin | Not supported yet | [`install/claude-code.md`](install/claude-code.md) |
| Codex | Local skills | Not supported yet | [`install/codex.md`](install/codex.md) |

## Learning methods

Supermentor adapts lessons to the learner's goal, current level, workspace context, and preferred amount of agent help. When the request needs clarification, the agent asks focused calibration questions before planning the lesson.

| Context | Typical use |
| --- | --- |
| Blank repo or scratch folder | Guided course, tiny lab, or project slice. |
| Project idea | Small build with learner-owned implementation choices. |
| Existing or public codebase | Repository map, reading path, and focused flow dissection. |
| Selected code or named file | Purpose, behavior chunks, example traces, and micro-exercises. |
| Error, log, or failing test | Diagnosis lesson based on evidence. |
| Concept-only question | Explanation with examples, checks for understanding, and recall prompts. |

Methods include exercises, guided projects, worked examples, code dissection, codebase tours, debugging lessons, drills, predictions, and recaps.

A common teaching loop is:

```text
Orient -> predict -> explain -> modify or trace -> practice -> recap
```

For exercise-based learning, the learner writes code in their IDE or current codebase. The agent frames the task, gives constraints and success criteria, offers hints, reviews attempts, and corrects misconceptions. Full solutions are reserved for explicit requests or real blockage after an attempt.

## Pedagogical basis

Supermentor uses common evidence-backed teaching techniques:

- **Retrieval practice:** ask the learner to recall, predict, or explain before showing the answer.
- **Spaced practice:** mark concepts worth revisiting later.
- **Interleaving:** vary related problem types after the first pattern is stable.
- **Worked examples and fading:** move from complete examples to partial examples to learner attempts.
- **Example-based code reading:** use traces, tests, fixtures, and small changes to connect code to behavior.
- **Metacognition:** ask the learner to notice why an answer felt plausible.

References:

- [Dunlosky et al., "Improving Students' Learning With Effective Learning Techniques"](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266)
- [Brown, Roediger, and McDaniel, *Make It Stick*](https://www.hup.harvard.edu/books/9780674729018)
- [Ambrose et al., *How Learning Works*](https://firstliteracy.org/wp-content/uploads/2015/07/How-Learning-Works.pdf)
- [Raspberry Pi Foundation, "Teaching programming in schools: A review of approaches and strategies"](https://www.raspberrypi.org/app/uploads/2021/11/Teaching-programming-in-schools-pedagogy-review-Raspberry-Pi-Foundation.pdf)
- [ITiCSE working group review, "Introductory Programming: A Systematic Literature Review"](https://repository.falmouth.ac.uk/3051/1/ITiCSE_2018__WG3.pdf)
- ["Parsons Problems and Beyond: Systematic Literature Review and Empirical Study Designs"](https://aaltodoc.aalto.fi/items/a77c8afa-0f57-4ef6-85d2-4f982776677c)

## Pi browser companion

After installing in Pi, the agent can start the browser companion with `supermentor_start` when a lesson would benefit from a side guide. You can also start it manually in a Pi session:

```text
/supermentor-start Learning session
/supermentor-status
/supermentor-stop
```

Use the browser companion for long walkthroughs, code anchors, inline comments, and longer exercise paths. It displays learning material and side-thread questions; it is not a coding environment. Learners still write code in their IDE or current codebase. A running browser session is updated by rewriting `lesson.json`; it does not need to be restarted for each exercise.

For short explanations, or in clients without a supported browser bridge, use chat. In Pi, prefer the integrated tool or command over launching `server.cjs` manually. Manual server startup displays lessons but cannot route inline browser questions back into the active agent session.

## Session storage

supermentor does not write session state into the current project by default. Sessions live under the platform cache directory:

```text
SUPERMENTOR_CACHE_DIR/sessions/<sessionId>/          # explicit override
$XDG_CACHE_HOME/supermentor/sessions/<sessionId>/    # Linux/Unix when set
~/.cache/supermentor/sessions/<sessionId>/           # Linux/Unix fallback
~/Library/Caches/supermentor/sessions/<sessionId>/   # macOS fallback
%LOCALAPPDATA%\supermentor\sessions\<sessionId>      # Windows fallback
```

A session contains:

```text
session.json          # manifest: id, cwd, title
server.json           # current server URL/token when running
lesson.json           # adaptive learning document
threads/<threadId>/
  question.json       # browser question/action written by the server
  reply.json          # agent answer written by the coding agent
events.jsonl          # append-only operational events
```

Exercise documents keep JSON minimal. Supermentor infers default English action labels such as "I'm struggling" and "Review my attempt". Lesson authors should describe tasks, constraints, references, and success criteria instead of hardcoding UI labels. Reviewing an attempt is the completion checkpoint for a step. Existing inline comments and answers should be preserved when a lesson is updated.

## Browser protocol

The browser companion uses a file-based side-thread protocol. The server writes `question.json`, emits an `inline-question` or `agent-action` event, waits for the harness adapter to acknowledge delivery, and then polls for the agent's `reply.json`.

A harness adapter that wants browser support must:

1. read `server-started`, `inline-question`, and `agent-action` JSON events from stdout;
2. inject browser questions/actions into the active agent context;
3. write `supermentor-ack` JSON lines to stdin; and
4. tell the agent to answer by writing the requested `reply.json` file.

See [`docs/architecture.md`](docs/architecture.md) for protocol details.

## Development

```bash
npm test
npm run smoke
node --check server.cjs
```

Start the server manually for UI/server smoke testing:

```bash
node server.cjs
```

Manual server mode prints a `server-started` JSON event with the URL, session id, session directory, and token. Inline browser questions still require a harness adapter; manual server mode does not route questions into an agent session by itself.

## Credits

Supermentor is inspired by [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (`@obra`), especially its skill-first approach and local harness installation patterns.

## License

MIT © bnema

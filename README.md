# supermentor

supermentor helps coding agents teach humans code, concepts, projects, and existing codebases. It combines portable teaching skills with an optional local browser companion for longer lessons, code walkthroughs, exercises, and inline questions.

Supermentor is designed to help learners build durable mental models through paced explanations, step-by-step code walkthroughs, small predictions, traces, exercises, and guided practice.

Supermentor is **skill-first and command-optional**. The portable workflow is natural-language mentoring through installed skills. Slash commands and the browser companion are available only in clients with matching integration support.

## What it includes

- **Teaching skills** that tell the agent when to explain, trace, dissect code, map a codebase, run a lab, teach through a guided project, or scaffold setup.
- **Local install helpers** for Pi, OpenCode, Claude Code, and Codex.
- **Optional Pi browser companion** with `/supermentor-start`, `/supermentor-status`, and `/supermentor-stop`.
- **A local HTTP server and file protocol** for browser lessons and inline comments.
- **Reusable adapter helpers** for future harness bridges.

Browser side-thread support requires a tested harness bridge. Today, that means Pi. Other clients can use the Supermentor skills locally, but their browser companion bridges are not documented as supported yet.

## Local installation

Install Supermentor separately for each agent client. The local flow is always the same:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
node scripts/install-local.mjs pi
```

Supported clients:

```bash
node scripts/install-local.mjs pi
node scripts/install-local.mjs opencode
node scripts/install-local.mjs claude
node scripts/install-local.mjs codex
```

Use your development checkout instead of `~/.local/share/supermentor` if you are working on Supermentor itself. Use `--copy` if symlinks are inconvenient:

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

## Learning modes

Supermentor adapts the lesson to the learner's goal and the context available in the current workspace.

| Context | Supermentor behavior |
| --- | --- |
| Blank repo or scratch folder | Creates a guided course, tiny lab, or project slice. |
| Project idea | Teaches through a small build while keeping the learner in control of implementation choices. |
| Existing or public codebase | Maps the repo, chooses a reading path, and dissects one flow. |
| Selected code or named file | Explains purpose, chunks behavior, traces examples, and offers micro-exercises. |
| Error, log, or failing test | Teaches through diagnosis and evidence. |
| Concept-only question | Verifies source-sensitive details, then teaches with examples and recall prompts. |

The reusable teaching loop is:

```text
Orient -> predict -> explain -> modify or trace -> practice -> recap
```

These modes cover both learning from a new workspace and learning from an existing repository.

## Pedagogical basis

Supermentor's methodology uses evidence-backed learning techniques:

- **Retrieval practice** — ask the learner to recall, predict, or explain before showing the answer.
- **Spaced practice** — note concepts worth revisiting across a longer session or later recap.
- **Interleaving** — vary related problem types once the first pattern is stable.
- **Worked examples and fading** — complete example, then partial example, then learner attempt.
- **Example-based code reading** — use traces, tests, fixtures, and small changes to connect code to behavior.
- **Metacognition** — prompt the learner to notice why an answer felt plausible instead of asking only whether they understood.

Useful references:

- [Dunlosky et al., “Improving Students' Learning With Effective Learning Techniques”](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266) — retrieval practice and spaced practice are among the strongest general study techniques.
- [Brown, Roediger, and McDaniel, *Make It Stick*](https://www.hup.harvard.edu/books/9780674729018) — practical synthesis of retrieval, spacing, interleaving, and desirable difficulty.
- [Ambrose et al., *How Learning Works*](https://firstliteracy.org/wp-content/uploads/2015/07/How-Learning-Works.pdf) — research-based teaching principles around prior knowledge, practice, feedback, and self-directed learning.
- [Raspberry Pi Foundation, “Teaching programming in schools: A review of approaches and strategies”](https://www.raspberrypi.org/app/uploads/2021/11/Teaching-programming-in-schools-pedagogy-review-Raspberry-Pi-Foundation.pdf) — programming-specific strategies such as worked examples, tracing, PRIMM, debugging tasks, Parsons problems, pair programming, and peer instruction.
- [ITiCSE working group review: “Introductory Programming: A Systematic Literature Review”](https://repository.falmouth.ac.uk/3051/1/ITiCSE_2018__WG3.pdf) — overview of introductory programming education research.
- [“Parsons Problems and Beyond: Systematic Literature Review and Empirical Study Designs”](https://aaltodoc.aalto.fi/items/a77c8afa-0f57-4ef6-85d2-4f982776677c) — evidence base for code-ordering and structured programming exercises.

### Pi browser companion

After installing in Pi, start a new Pi session and run:

```text
/supermentor-start Learning session
/supermentor-status
/supermentor-stop
```

Use the browser companion for long walkthroughs, code anchors, or inline comments. For short explanations, or in clients without a tested browser bridge, stay in chat.

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
  question.json       # browser question written by the server
  reply.json          # agent answer written by the coding agent
events.jsonl          # append-only operational events
```

## Browser protocol

The browser companion uses a file-based side-thread protocol. The server writes `question.json`, emits an `inline-question` event, waits for the harness adapter to acknowledge delivery, and then polls for the agent's `reply.json`.

A harness adapter that wants browser support must:

1. read `server-started` and `inline-question` JSON events from stdout;
2. inject inline questions into the active agent context;
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

Supermentor is heavily inspired by [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (`@obra`), especially its skill-first approach and local harness installation patterns.

## License

MIT © bnema

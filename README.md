# supermentor

supermentor helps coding agents teach humans code, concepts, and projects. It combines teaching skills with an optional local browser companion for longer lessons, code walkthroughs, exercises, and inline questions.

The point is not to make the agent finish a course for the learner. The point is to help the learner build a mental model: slow down when the material gets dense, dissect code step by step, validate understanding through small predictions and traces, and avoid silently doing the conceptual work for them.

## What it includes

- **Teaching skills** that tell the agent when to explain, trace, dissect code, run a lab, or scaffold boring setup.
- **Local install helpers** for Pi, OpenCode, Claude Code, and Codex.
- **Pi browser companion** with `/supermentor-start`, `/supermentor-status`, and `/supermentor-stop`.
- **A local HTTP server and file protocol** for browser lessons and inline comments.
- **Reusable adapter helpers** for future harness bridges.

Browser side-thread support is only claimed where a tested harness bridge exists. Today, that means Pi. Other clients can use the Supermentor skills locally, but their browser companion bridges are not documented as supported yet.

## Local installation

Install Supermentor separately for each agent client. The local flow is always the same:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
node scripts/install-local.mjs <client>
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
| OpenCode | Skills + bootstrap plugin | Not yet claimed | [`install/opencode.md`](install/opencode.md) |
| Claude Code | Skills-directory plugin | Not yet claimed | [`install/claude-code.md`](install/claude-code.md) |
| Codex | Local skills | Not yet claimed | [`install/codex.md`](install/codex.md) |

### Pi browser companion

After installing in Pi, start a new Pi session and run:

```text
/supermentor-start [title]
/supermentor-status
/supermentor-stop
```

Use the browser companion for long walkthroughs, code anchors, or inline comments. For short explanations, stay in chat.

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

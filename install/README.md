# Local Supermentor installs

Supermentor is installed separately for each agent client. For now, these instructions are local-only: clone or copy this repository on the machine that runs the agent, then link or install the local checkout for the target client.

Recommended checkout location:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

If you are developing Supermentor, use your development checkout instead.

## Quick commands

From the Supermentor checkout:

```bash
node scripts/install-local.mjs pi
node scripts/install-local.mjs opencode
node scripts/install-local.mjs claude
node scripts/install-local.mjs codex
```

Use `--copy` if symlinks are inconvenient on your platform:

```bash
node scripts/install-local.mjs codex --copy
```

## Per-client instructions

- [Pi](./pi.md)
- [OpenCode](./opencode.md)
- [Claude Code](./claude-code.md)
- [Codex](./codex.md)

## Browser companion support

Pi currently has the complete local browser companion integration. Other clients get the Supermentor teaching skills locally, but the browser side-thread bridge is not documented as supported until that client can route inline question events back into the active agent session and acknowledge delivery.

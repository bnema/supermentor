# Installing Supermentor locally for Claude Code

## Agent prompt

Tell Claude Code:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/claude-code.md.
```

## Manual steps

Clone or copy Supermentor locally:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

Link the checkout into Claude Code's local skills directory:

```bash
node scripts/install-local.mjs claude
```

Equivalent manual command:

```bash
mkdir -p ~/.claude/skills
ln -sfn ~/.local/share/supermentor ~/.claude/skills/supermentor
```

Restart Claude Code or run:

```text
/reload-plugins
```

## Why this works

The repository contains `.claude-plugin/plugin.json` and `skills/`. Claude Code treats a folder under `~/.claude/skills/` that contains `.claude-plugin/plugin.json` as a local skills-directory plugin.

## Verify

In Claude Code, check plugin/skill visibility with the plugin UI or ask:

```text
Use Supermentor to explain a small piece of code step by step.
```

Supermentor should activate its teaching skills. The optional browser companion is not yet packaged as a Claude Code plugin bridge; use the skills in chat unless a tested adapter is available.

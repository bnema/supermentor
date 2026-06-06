# Installing Supermentor locally for Codex

## Agent prompt

Tell Codex:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/codex.md.
```

## Manual steps

Clone or copy Supermentor locally:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

Link the Supermentor skills into Codex's local skill directory:

```bash
node scripts/install-local.mjs codex
```

Equivalent manual commands:

```bash
mkdir -p ~/.agents/skills
ln -sfn ~/.local/share/supermentor/skills/using-supermentor ~/.agents/skills/using-supermentor
ln -sfn ~/.local/share/supermentor/skills/supermentor-code-dissection ~/.agents/skills/supermentor-code-dissection
ln -sfn ~/.local/share/supermentor/skills/supermentor-guided-learning ~/.agents/skills/supermentor-guided-learning
ln -sfn ~/.local/share/supermentor/skills/supermentor-codebase-tour ~/.agents/skills/supermentor-codebase-tour
```

If symlinks are inconvenient:

```bash
node scripts/install-local.mjs codex --copy
```

Restart Codex.

## Verify

Use Codex's skill selector or ask:

```text
Use $using-supermentor to help me learn this code step by step.
```

Codex should discover Supermentor from `~/.agents/skills`.

## Scope note

These instructions intentionally install local skills, not a Codex marketplace plugin. Codex plugins are the installable distribution unit for shared workflows, but Supermentor's current Codex support is local skill installation only.

The optional browser companion is not yet documented as supported in Codex because inline browser questions need a tested delivery bridge before they are claimed as working.

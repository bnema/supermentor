# Installing Supermentor locally for OpenCode

## Agent prompt

Tell OpenCode:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/opencode.md.
```

## Manual steps

Clone or copy Supermentor locally:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

Link the OpenCode plugin into OpenCode's local plugin directory:

```bash
node scripts/install-local.mjs opencode
```

Equivalent manual command:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sfn ~/.local/share/supermentor/.opencode/plugins/supermentor.js ~/.config/opencode/plugins/supermentor.js
```

If symlinks are inconvenient:

```bash
node scripts/install-local.mjs opencode --copy
```

Restart OpenCode.

## Verify

Ask OpenCode:

```text
Tell me about Supermentor.
```

Then ask OpenCode to use its native skill tool to list skills. You should see Supermentor skills from the local checkout.

## What is installed

The OpenCode plugin is intentionally small. It:

1. registers Supermentor's `skills/` directory with OpenCode; and
2. injects the `using-supermentor` bootstrap instructions so the agent knows to teach pedagogically instead of silently implementing.

The optional browser companion is not yet a full OpenCode integration. Inline browser questions need a tested OpenCode delivery bridge before they are documented as supported.

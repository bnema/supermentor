# Installing Supermentor for OpenCode

Follow the local-only OpenCode instructions in this repository:

```text
install/opencode.md
```

Short version:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
node scripts/install-local.mjs opencode
```

Restart OpenCode and ask:

```text
Tell me about Supermentor.
```

The plugin registers Supermentor skills and injects the `using-supermentor` teaching bootstrap. The browser companion is not yet documented as supported in OpenCode because inline questions still need a tested delivery bridge.

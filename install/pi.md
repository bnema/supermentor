# Installing Supermentor locally for Pi

## Agent prompt

Tell Pi:

```text
Read and follow the local Supermentor install instructions at /path/to/supermentor/install/pi.md.
```

## Manual steps

Clone or copy Supermentor locally:

```bash
git clone https://github.com/bnema/supermentor ~/.local/share/supermentor
cd ~/.local/share/supermentor
```

Install the local checkout as a Pi package:

```bash
pi install ~/.local/share/supermentor
```

For a development checkout, run:

```bash
pi install /absolute/path/to/supermentor
```

Start a new Pi session. Supermentor contributes:

- skills from `skills/`;
- extension commands from `extensions/`:
  - `/supermentor-start [title]`
  - `/supermentor-status`
  - `/supermentor-stop`

## Verify

In a new Pi session, ask:

```text
Je veux apprendre un bout de code pas à pas.
```

For the optional browser companion, run:

```text
/supermentor-start Learning session
```

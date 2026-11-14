# opencode-rex-fork

An OpenCode plugin for the Rex terminal. `/fork` and `/branch` fork the current OpenCode session and open it in a new Rex tab.

Companion plugin for Claude Code: [claude-rex-fork](https://github.com/damianmarek/claude-rex-fork).

## Behavior

In a Rex terminal:

- `/fork` opens OpenCode's fork picker (the whole conversation or a message), then opens the fork in a new Rex tab. It takes over OpenCode's own `session.fork` command, so there is still a single `/fork` entry.
- `/branch` opens a new tab on a full fork of the conversation. `/branch <name>` names the new session.
- If `rex` fails, the error appears in a toast.

Outside Rex (`REX_SESSION` not set), the fork opens in the current OpenCode TUI instead.

The fork is created with OpenCode's session fork API, then the tab runs:

```
rex run --interactive -s "$REX_SESSION" -c <session directory> --label fork -- opencode --session <fork id>
```

`--interactive` sources the interactive shell config, so settings from `~/.zshrc` (for example `HERDR_ENV`, which hides OpenCode's tab strip) behave the same in the new tab as in the current one.

## Install

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.json` or `opencode.jsonc`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/opencode-rex-fork"]
}
```

Or, once the package is published, install it from npm:

```
opencode plugin add opencode-rex-fork
```

The plugin has a TUI part and an empty server part. OpenCode loads the TUI part from the server part, so a single `plugins` entry is enough. If you prefer a TUI-only install, add the package to `plugins` in `~/.config/opencode/cli.json` instead.

## Requirements

- Rex terminal with the `rex` CLI on the PATH of the OpenCode TUI.
- `opencode` on the login-shell PATH, so the new Rex tab can start it.
- OpenCode v2.3 or newer.

## Develop

```sh
bun install
bunx tsc --noEmit
```

To try a local checkout without touching global config, link it into a project:

```sh
mkdir -p .opencode/plugins
ln -s /path/to/opencode-rex-fork .opencode/plugins/rex-fork
```

OpenCode loads the plugin from there, and the TUI loads its `./tui` export. `REX_SESSION` is read from the TUI process, so the plugin must run in the TUI attached to the Rex pane.

## Publish

```sh
npm publish
```

The package exports `"."` (server) and `"./tui"` (TUI). Keep `@opencode/plugin` on a version compatible with the OpenCode release you target.

## License

MIT

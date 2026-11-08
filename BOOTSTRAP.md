# Bootstrapping a machine

```sh
git clone git@github.com:Chiarandini/dotfiles.git ~/.config
~/.config/install.sh            # full desktop
~/.config/install-headless.sh   # headless box (air)
~/.config/install-verify.sh     # assert it actually worked
```

## The rule

**A new machine-level requirement gets an assertion in `install-verify.sh`,
not just a step in `install.sh`.**

This is not process for its own sake. Every expensive failure in this setup
was silent:

- TPM was cloned into `~/.tmux/plugins/tpm` while the config lived in
  `~/.config/tmux`, so it read a path it could not see, found zero plugins,
  and left `tmux-resurrect` inert **from 2023 to 2026**. Nothing errored.
- `tmux-resurrect` corrupted its own save file whenever a pane had an empty
  title, restoring those panes in the wrong directory. Nothing errored.
- Claude's `preferredNotifChannel` defaulted to `auto`, which can resolve to
  "no method available", so the bell never rang and the red "wants you" state
  never fired. Nothing errored.
- `KeyRepeat` and `InitialKeyRepeat` were set by hand in System Settings on
  each machine and owned by no file, so every rebuild quietly reverted to a
  backspace that crawls. `mru-spaces` is worse: it defaults to true, which
  reorders spaces by most-recent-use and silently points every positional
  `cmd+<n>` binding in `skhdrc` at whichever space now sits at that index.
  Nothing errored.

An installer that only runs commands cannot catch any of these. One that
asserts outcomes catches all four, which is why `install-verify.sh` exists
and why it is worth keeping honest. Break something deliberately once in a
while and confirm it still fails; a verifier that only ever prints `ok` is
decoration.

## What each script assumes

| Script | For | Assumes |
|---|---|---|
| `install.sh` | full desktop | macOS, admin rights, GUI apps wanted |
| `install-headless.sh` | `air` | no GUI, no yabai/skhd/kitty |
| `install-verify.sh` | both | run last; exit status is the failure count |

## Things that are deliberately not cloned or generated

- **tmux plugins are vendored** in `tmux/plugins/`, not fetched at setup.
  See `tmux/plugins/VENDORED.md`. Cloning them is precisely what failed for
  three years.
- **`~/.claude/settings.json` is symlinked** from `claude/settings.json`, so
  the notification settings travel with the repo.
  `~/.claude/settings.local.json` stays untracked: it holds machine-specific
  permission grants.

## macOS defaults

`macos-defaults.sh` owns the `defaults` values this setup needs that live in
no dotfile: key repeat, hold-to-repeat, `mru-spaces`, and Brave's ctrl-based
tab shortcuts (ctrl+t / ctrl+w / ctrl+shift+d). Both installers call it and
`install-verify.sh` asserts every value, because none of them fail loudly
-- an unset key-repeat value just makes the machine feel wrong.

Applications read the key-repeat values **at launch**, so changing them reaches
a running app only when it restarts. Log out and back in to apply them
everywhere.

## Not covered by bootstrap

These need a human and are not asserted, because failing them is loud and
obvious rather than silent:

- `claude` authentication (`/login`)
- Tailscale enrolment on a new box
- macOS permissions: Accessibility for yabai/skhd, Screen Recording for kitty
- App Store apps and anything requiring a licence key

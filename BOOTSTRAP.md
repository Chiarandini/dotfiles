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

An installer that only runs commands cannot catch any of these. One that
asserts outcomes catches all three, which is why `install-verify.sh` exists
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

## Not covered by bootstrap

These need a human and are not asserted, because failing them is loud and
obvious rather than silent:

- `claude` authentication (`/login`)
- Tailscale enrolment on a new box
- macOS permissions: Accessibility for yabai/skhd, Screen Recording for kitty
- App Store apps and anything requiring a licence key

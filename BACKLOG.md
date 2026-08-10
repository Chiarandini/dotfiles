# BACKLOG

Follow-ups for the dotfiles / terminal environment (this repo: `~/.config`).
Each item carries a clear next action. Scope is the machine environment —
shell, editor, window manager, scripts. Project-level backlogs live with
their projects (e.g. `~/programming/constellation/BACKLOG.md`).

## Open

- **Untracked hand-written scripts in `~/.local/bin`.** The convention in
  this repo is that hand-written scripts live in `~/.config/scripts/`
  (tracked) and `~/.local/bin` holds only symlinks onto `$PATH` — that is
  how `airdrop`, `fix-yabai`, `fix-yabai-sa`, `yabai-watchdog` and
  `dirmarks` are set up. Three scripts break the convention and exist
  **only** as real files in `~/.local/bin`, so they are in no repo and in no
  backup that follows the dotfiles:
  `space-bench` (126 lines), `space-bench-single` (72), `space-bench-sweep`
  (77) — the yabai space-switch latency harness written during the
  yabai-drift investigation.
  Everything else in `~/.local/bin` is either a symlink to a tracked source
  or a reinstallable artifact (`dict`, `distant`, `qpm` are binaries;
  `py.test`, `pytest`, `pygmentize`, `yt-dlp`, `python3.12`, `csf`,
  `claude-sessions`, `safe-run-mcp` are pip/uv/pipx shims; `accountant` and
  `zen` point into their own installs), so those need nothing.
  **Next action:** move the three `space-bench*` scripts into
  `~/.config/scripts/`, symlink them back into `~/.local/bin`, and commit.
  Then treat "is it a symlink?" as the standing audit for that directory —
  `ls -la ~/.local/bin | grep -v '\->'` lists everything that isn't yet.
  Blocks nothing, but it is the kind of loss you only notice on a new
  machine, which is exactly when the chezmoi migration happens.

#!/bin/sh
# Rehearse the failure that started all this, and check the result against a
# recorded baseline rather than against memory.
#
#   crash-test.sh before   force a save, record what exists, print the drill
#   crash-test.sh after    record what came back and diff it against before
. "$HOME/.config/tmux/bin/lib.sh"

BEFORE="$STATE_DIR/crash-test-before.txt"
AFTER="$STATE_DIR/crash-test-after.txt"

inventory() {
  tmux list-windows -a -F '#{session_name}	#{window_name}	#{pane_current_path}' 2>/dev/null | sort
}

case "${1:-}" in
before)
  # The local fix in resurrect's save.sh is not upstream, so `git pull` in
  # that plugin will silently revert it and cwds will start drifting again.
  if ! grep -q 'LOCAL PATCH: never emit an empty pane_title' \
      "$HOME/.config/tmux/plugins/tmux-resurrect/scripts/save.sh" 2>/dev/null; then
    printf '\nWARNING: the empty-pane_title patch is missing from save.sh.\n'
    printf 'Panes with no title will lose their cwd on restore.\n'
    printf 'See the "Local patch" section of ~/.config/tmux/README.md.\n\n'
  fi

  printf 'Forcing a save...\n'
  tmux run-shell "$HOME/.config/tmux/plugins/tmux-resurrect/scripts/save.sh"
  sleep 2

  last=$(readlink "$HOME/.local/share/tmux/resurrect/last" 2>/dev/null)
  inventory > "$BEFORE"

  printf '\nSaved state: %s\n' "${last:-NONE - STOP, nothing to restore from}"
  printf 'Recorded %s windows to %s\n\n' "$(wc -l < "$BEFORE" | tr -d ' ')" "$BEFORE"
  cat "$BEFORE"

  printf '\n--- what will NOT come back, by design ---\n'
  printf '  dev servers: restored as named windows, not restarted (cmd+k s)\n'
  printf '  nvim buffers: only as recent as the last persistence save\n'
  printf '  claude: resumed per window cwd, not mid-response\n'

  printf '\n--- the drill ---\n'
  printf '  1. open a NON-tmux kitty tab (cmd+n), so you can watch\n'
  printf '  2. tmux kill-server\n'
  printf '  3. tmux start-server ; sleep 8\n'
  printf '  4. tmux attach\n'
  printf '  5. ~/.config/tmux/bin/crash-test.sh after\n' ;;

after)
  [ -f "$BEFORE" ] || { printf 'No baseline. Run `crash-test.sh before` first.\n'; exit 1; }
  inventory > "$AFTER"

  printf '=== restored vs baseline ===\n'
  if diff -u "$BEFORE" "$AFTER" > /tmp/crash-diff.txt 2>&1; then
    printf 'IDENTICAL: every session, window and cwd came back.\n\n'
  else
    printf 'Differences (- missing after restore, + new):\n\n'
    grep -E '^[-+][^-+]' /tmp/crash-diff.txt
    printf '\n'
  fi

  printf '=== event log ===\n'
  tail -6 "$STATE_DIR/events.log" 2>/dev/null

  printf '\n=== still to check by hand ===\n'
  printf '  nvim windows reopened their buffers\n'
  printf '  claude windows resumed the right conversation\n'
  printf '  scrollback is present in restored windows\n'
  printf '  cmd+k s brings the servers back\n' ;;

*)
  printf 'usage: crash-test.sh [before|after]\n'; exit 1 ;;
esac

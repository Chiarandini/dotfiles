#!/bin/sh
# Append-only record of state saves and restores, so "is this actually
# working" has an answer that is not a guess. Called from the resurrect
# hooks in tmux.conf; `view` opens it.
. "$HOME/.config/tmux/bin/lib.sh"

LOG="$STATE_DIR/events.log"

case "${1:-}" in
view)
  if [ -s "$LOG" ]; then
    printf 'tmux events  (%s)\n\n' "$LOG"
    tail -200 "$LOG"
  else
    printf 'No events yet: %s\n\nA save is written every 5 minutes while a\nclient is attached, and on cmd+k S.\n' "$LOG"
  fi
  printf '\n[q to close]\n'
  # shellcheck disable=SC2162
  read _ ;;

saved)
  sessions=$(tmux list-sessions 2>/dev/null | wc -l | tr -d ' ')
  windows=$(tmux list-windows -a 2>/dev/null | wc -l | tr -d ' ')
  printf '%s  saved      sessions=%s windows=%s\n' \
    "$(date +%Y-%m-%dT%H:%M:%S)" "$sessions" "$windows" >> "$LOG" ;;

restoring)
  printf '%s  restoring  from %s\n' \
    "$(date +%Y-%m-%dT%H:%M:%S)" \
    "$(readlink ~/.local/share/tmux/resurrect/last 2>/dev/null || echo '?')" >> "$LOG" ;;

bell)
  where=$(tmux display-message -p -t "${TMUX_PANE:-}" '#{session_name}:#{window_name}' 2>/dev/null)
  flagged=$(tmux list-windows -a -F '#{?window_bell_flag,#{session_name}:#{window_name},}' 2>/dev/null | tr -s '\n' ' ')
  printf '%s  bell       from=%s flagged=[%s]\n' \
    "$(date +%Y-%m-%dT%H:%M:%S)" "${where:-?}" "${flagged% }" >> "$LOG" ;;

*)
  printf 'usage: log-event.sh [view|saved|restoring]\n'; exit 1 ;;
esac

# Keep it bounded; this is a breadcrumb trail, not an archive.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

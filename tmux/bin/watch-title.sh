#!/bin/sh
# Sample a window's pane_title and the glyph the status line derives from it.
# Use this when a window's colour looks wrong: run it, then make Claude work
# in that window for a few seconds. It prints every distinct state it sees.
#
#   watch-title.sh                 the current window
#   watch-title.sh 'sess:window'   a specific one
. "$HOME/.config/tmux/bin/lib.sh"

target=${1:-$(tmux display-message -p -t "${TMUX_PANE:-}" '#{session_name}:#{window_name}')}
fmt=$(tmux show -gv window-status-format)

printf 'watching %s for 30s; make Claude work now\n\n' "$target"
last=
i=0
while [ "$i" -lt 120 ]; do
  cmd=$(tmux display-message -p -t "$target" '#{pane_current_command}' 2>/dev/null)
  title=$(tmux display-message -p -t "$target" '#{pane_title}' 2>/dev/null)
  glyph=$(tmux display-message -p -t "$target" -F "$fmt" 2>/dev/null | sed 's/#\[[^]]*\]//g')
  cur="$cmd|$title|$glyph"
  if [ "$cur" != "$last" ]; then
    printf '%s  cmd=%-12s title=[%s]\n              renders as [%s]\n' \
      "$(date +%H:%M:%S)" "$cmd" "$title" "$glyph"
    last="$cur"
  fi
  i=$((i + 1))
  sleep 0.25
done
printf '\ndone. If title never changed while Claude worked, Claude is not\nupdating the title under tmux and the working state needs another source.\n'
printf '\n[enter to close]'; read -r _

#!/bin/sh
# New window for a role, started by typing into the pane's interactive shell
# rather than as the pane's direct command. Two reasons:
#   - shell wrappers apply; nvim() in zsh/functions.zsh carries the
#     NVIM_RUN_ON_EXIT handoff that Oil's gR depends on.
#   - the window survives the program exiting, leaving you a shell.
# This is also how tmux-resurrect relaunches things, so started and restored
# windows behave identically.
. "$HOME/.config/tmux/bin/lib.sh"

case "${1:-shell}" in
  claude) name=claude; cmd=claude ;;
  nvim)   name=nvim;   cmd=nvs ;;
  shell)  name=shell;  cmd= ;;
  *)      printf 'usage: newwin.sh [claude|nvim|shell]\n'; exit 1 ;;
esac

cwd=$(tmux display-message -p -t "${TMUX_PANE:-}" '#{pane_current_path}')
win=$(tmux new-window -P -F '#{window_id}' -c "$cwd" -n "$name")
[ -n "$cmd" ] && tmux send-keys -t "$win" "$cmd" C-m
exit 0

#!/bin/sh
# Jump to any tmux WINDOW from anywhere in kitty, including from a tab with no
# tmux in it at all, and land in the right place:
#   - its session is already showing in a kitty tab -> focus that tab
#   - running but not displayed anywhere            -> open a tab attached
# Either way the target window is selected first, so the tab comes up showing
# it rather than wherever that session was last left.
#
# Window-level rather than session-level on purpose: jumping to a window
# reaches its session too, so this subsumes a session picker.
# Bound to cmd+shift+k in kitty.conf.
. "$HOME/.config/tmux/bin/lib.sh"

TAB=$(printf '\t')

rows=$(tmux list-windows -a -F "#{session_name}${TAB}#{window_index}${TAB}#{session_name}:#{window_name}${TAB}#{pane_current_command}${TAB}#{?session_attached,shown,detached}" 2>/dev/null)
[ -z "$rows" ] && { printf 'No tmux sessions running.\n\nStart one with:  tx\n\n[enter to close]'; read -r _; exit 0; }

picked=$(printf '%s\n' "$rows" | sort -t"$TAB" -k1,1 -k2,2n | fzf \
  --delimiter="$TAB" --with-nth=3,4,5 \
  --prompt='window > ' --reverse --border \
  --header='project:window                        running       where' \
  --preview 'tmux capture-pane -p -t "$(echo {} | cut -f1):$(echo {} | cut -f2)" 2>/dev/null | tail -40' \
  --preview-window=right:50%)

[ -z "$picked" ] && exit 0
log_picker "kitty-jump-window"

sess=$(printf '%s' "$picked" | cut -f1)
idx=$(printf '%s' "$picked" | cut -f2)

# Select first so the tab appears already showing the window you asked for.
tmux select-window -t "=$sess:$idx" 2>/dev/null

"$HOME/.config/tmux/bin/focus-client.sh" "$sess" && exit 0

sock="${KITTY_LISTEN_ON:-}"
[ -n "$sock" ] || sock="unix:$(ls -t /tmp/mykitty-* 2>/dev/null | head -1)"

kitty @ --to "$sock" launch --type=tab --tab-title "$sess" \
  tmux attach-session -t "=$sess" >/dev/null 2>&1 \
  || tmux attach-session -t "=$sess"

#!/bin/sh
# Show the exact bytes a key produces, inside whatever pane you run it in.
# Use it when a chord "stops working": it separates the two halves of the path,
# kitty -> tmux and tmux -> application, which have different fixes.
#
#   Shift+Enter should print   ^[[13;2u
#   plain Enter should print   nothing (a bare newline)
#
# If Shift+Enter prints nothing extra, kitty is not sending a distinct
# sequence. If it prints ^[[13;2u here but the app still ignores it, the app
# is the problem, not tmux.
printf 'Key byte probe. Press keys; Ctrl-D when done.\n'
printf 'Try: Shift+Enter, then plain Enter, then Shift+Tab.\n\n'
printf '  pane_key_mode: %s\n' "$(tmux display-message -p -t "${TMUX_PANE:-}" '#{pane_key_mode}' 2>/dev/null || echo 'not in tmux')"
printf '  extended-keys: %s\n\n' "$(tmux show -s extended-keys 2>/dev/null | awk '{print $2}' || echo 'n/a')"

# Ask for modifyOtherKeys mode 1, which is what nvim and Claude request, then
# echo raw input with control characters made visible.
printf '\033[>4;1m'
stty -echo 2>/dev/null
cat -v
stty echo 2>/dev/null
printf '\033[>4;0m'
printf '\n[enter to close]'; read -r _

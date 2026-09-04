#!/bin/sh
# Populate a freshly created session, but only once a client is attached.
#
# A session with no client has 80x24 windows; it only becomes the real
# terminal size on attach. Starting nvim into 80x24 and letting it restore a
# session there is how you get "E36: Not enough room" from a plugin trying to
# split. So sessionizer.sh marks the session with @bootstrap and the global
# client-attached hook calls this, which runs at the real size.
#
# @bootstrap-claude overrides what the claude window starts with. promote.sh
# sets it to `claude --resume`, so a promoted tab comes up on its conversation
# picker rather than on a fresh conversation.
. "$HOME/.config/tmux/bin/lib.sh"

tmux list-sessions -F '#{session_name}	#{session_attached}	#{@bootstrap}	#{@bootstrap-claude}' 2>/dev/null \
| while IFS="$(printf '\t')" read -r name attached flag claude_cmd; do
    [ "$flag" = "1" ] || continue
    [ "${attached:-0}" -ge 1 ] || continue
    [ -n "$claude_cmd" ] || claude_cmd=claude
    # No `=` prefix: set-option's -t is a target-*pane*, which `=name` does not
    # resolve as. send-keys takes a real target so it keeps its `=`.
    tmux set-option -t "$name" -u @bootstrap
    tmux set-option -t "$name" -u @bootstrap-claude
    tmux send-keys -t "=$name:nvim"   'nvs'         C-m 2>/dev/null
    tmux send-keys -t "=$name:claude" "$claude_cmd" C-m 2>/dev/null
  done
exit 0

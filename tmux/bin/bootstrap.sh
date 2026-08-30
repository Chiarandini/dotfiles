#!/bin/sh
# Populate a freshly created session, but only once a client is attached.
#
# A session with no client has 80x24 windows; it only becomes the real
# terminal size on attach. Starting nvim into 80x24 and letting it restore a
# session there is how you get "E36: Not enough room" from a plugin trying to
# split. So sessionizer.sh marks the session with @bootstrap and the global
# client-attached hook calls this, which runs at the real size.
. "$HOME/.config/tmux/bin/lib.sh"

tmux list-sessions -F '#{session_name}	#{session_attached}	#{@bootstrap}' 2>/dev/null \
| while IFS="$(printf '\t')" read -r name attached flag; do
    [ "$flag" = "1" ] || continue
    [ "${attached:-0}" -ge 1 ] || continue
    tmux set-option -t "=$name" -u @bootstrap
    tmux send-keys -t "=$name:nvim"   'nvs'    C-m 2>/dev/null
    tmux send-keys -t "=$name:claude" 'claude' C-m 2>/dev/null
  done
exit 0

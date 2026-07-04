#!/bin/sh
# Keybinding cheat sheet, shown as an overlay (cmd+shift+/). The --hold flag in
# the kitty.conf mapping keeps this visible until you press a key.
cat <<'EOF'

  KITTY KEYS                                   ( cmd+shift + KEY )

    p     switch to any tab   (type to filter, Enter to jump)
    i     rename this tab
    o     open a new Claude in a folder
    , / . move this tab left / right   (precise; won't detach it)
    y     toggle a "parked" (grey) mark on this tab
    f5    refresh  (apply config / code changes)
    /     show this help


  SPLITS inside a tab

    cmd+shift+enter   split right        cmd+shift+d   split down
    cmd+h cmd+j cmd+k cmd+l   move        cmd+w         close split


  WHAT THE TAB COLOURS MEAN

    orange    Claude - idle, ready for you
    yellow    Claude - thinking
    red       Claude - waiting for your input
    green     nvim
    grey      parked


  (press any key to close)
EOF

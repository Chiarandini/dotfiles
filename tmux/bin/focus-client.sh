#!/bin/sh
# Focus the kitty tab that is already showing a given tmux session.
#
# Attaching a second client to an attached session makes the two kitty tabs
# mirrors: they share a current window, so switching in one switches the
# other. Almost never what you want. This finds the existing tab instead.
#
# The link is the pid: tmux's #{client_pid} is the `tmux attach-session`
# process, which is exactly the foreground process kitty reports for the
# window hosting it.
#
# Exits 0 if it focused something, 1 if it could not (caller should attach).
. "$HOME/.config/tmux/bin/lib.sh"

session="$1"
[ -n "$session" ] || exit 1

me=$(tmux display-message -p -t "${TMUX_PANE:-}" '#{client_pid}' 2>/dev/null)

for pid in $(tmux list-clients -t "=$session" -F '#{client_pid}' 2>/dev/null); do
  [ "$pid" = "$me" ] && continue

  sock="${KITTY_LISTEN_ON:-}"
  [ -n "$sock" ] || sock="unix:$(ls -t /tmp/mykitty-* 2>/dev/null | head -1)"
  [ "$sock" = "unix:" ] && continue

  win=$(kitty @ --to "$sock" ls 2>/dev/null | python3 -c "
import json,sys
target=int(sys.argv[1])
try: data=json.load(sys.stdin)
except Exception: sys.exit(0)
for osw in data:
    for tab in osw.get('tabs',[]):
        for w in tab.get('windows',[]):
            for p in w.get('foreground_processes',[]):
                if p.get('pid')==target:
                    print(w.get('id')); sys.exit(0)
" "$pid" 2>/dev/null)

  if [ -n "$win" ]; then
    kitty @ --to "$sock" focus-window --match "id:$win" >/dev/null 2>&1 && exit 0
  fi
done

exit 1

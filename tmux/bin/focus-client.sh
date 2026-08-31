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

# Every client that displays this session is a candidate, including the one
# calling. Two earlier mistakes lived here:
#
#   - It skipped "the current client", computed with `-t "${TMUX_PANE:-}"`.
#     An empty target does not mean "no target": tmux resolves it to whatever
#     it considers the current client, which is roughly the most recently
#     active one. Run from a kitty overlay, where TMUX_PANE is unset, that
#     frequently resolved to the very session being jumped to, so the only
#     client showing it was skipped and the caller opened a redundant tab
#     for a session already on screen.
#   - Skipping self was wrong anyway. If the session is already displayed
#     somewhere, focusing that tab is the right answer even when it is the
#     caller's own tab; focusing it is a harmless no-op.
# Search every kitty instance, not just the newest socket. skhd binds alt+f2
# to `open -n -a kitty`, which starts a second instance with its own socket, so
# picking `ls -t | head -1` can query the wrong one and conclude, wrongly, that
# nothing is showing the session.
socks=$(ls -t /tmp/mykitty-* 2>/dev/null)
[ -n "${KITTY_LISTEN_ON:-}" ] && socks="${KITTY_LISTEN_ON#unix:}
$socks"
[ -n "$socks" ] || exit 1

for pid in $(tmux list-clients -t "=$session" -F '#{client_pid}' 2>/dev/null); do
  for sock in $socks; do
    [ -S "$sock" ] || continue
    win=$(kitty @ --to "unix:$sock" ls 2>/dev/null | python3 -c "
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
      kitty @ --to "unix:$sock" focus-window --match "id:$win" >/dev/null 2>&1 && exit 0
    fi
  done
done

exit 1

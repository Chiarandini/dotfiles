#!/bin/sh
# Promote the standalone claude in this kitty tab into a tmux project, in place.
#
# The process cannot move. Its pty belongs to this kitty window, and macOS has
# no working reptyr. The conversation can, because Claude's state is the
# transcript under ~/.claude/projects/<cwd>/, not the process. So this exits
# the claude that is here, attaches this same tab to a project session, and
# reopens the conversation in that session's claude window.
#
# Bound to cmd+shift+u in kitty.conf rather than to a cmd+k action: cmd+k is
# the tmux prefix, and a tab that needs promoting has by definition no tmux in
# it to receive one.
#
# It reopens with a bare `claude --resume` picker rather than jumping straight
# to the right conversation, because a live session cannot be identified from
# outside: its transcript carries no summary record until it ends, claude holds
# no handle on the file between writes, and macOS will not show another
# process's environment. The session you just exited is the most recently
# written one, so it is the top row.
. "$HOME/.config/tmux/bin/lib.sh"

sock="${KITTY_LISTEN_ON:-}"
[ -n "$sock" ] || sock="unix:$(ls -t /tmp/mykitty-* 2>/dev/null | head -1)"
K() { kitty @ --to "$sock" "$@"; }

die() { printf '\n%s\n\n[enter to close]' "$1"; read -r _; exit 1; }

# What is in the focused tab: the window to type into, the pid to wait on, the
# directory that decides which project this is, and the title, which is
# Claude's own summary of the conversation and the only human-readable handle
# on it.
info=$(K ls 2>/dev/null | python3 -c '
import json, sys

GLYPHS = "!✳›✎▏▸"

def spinner(ch):
    return 0x2800 <= ord(ch) <= 0x28FF or 0x25D0 <= ord(ch) <= 0x25D3

data = json.load(sys.stdin)
for osw in data:
    for tab in osw.get("tabs", []):
        if not tab.get("is_focused"):
            continue
        raw = (tab.get("title") or "").strip()
        busy = "1" if raw and spinner(raw[0]) else "0"
        title = raw
        while title and (title[0] in GLYPHS or spinner(title[0])):
            title = title[1:].strip()
        found = None
        for w in tab.get("windows", []):
            for p in w.get("foreground_processes", []):
                exe = (p.get("cmdline") or [""])[0].rsplit("/", 1)[-1]
                if exe.startswith("tmux"):
                    print("tmux")
                    sys.exit(0)
                if exe.startswith("claude") and found is None:
                    found = (w.get("id"), p.get("pid"), p.get("cwd") or "")
        if found:
            print("claude\t%s\t%s\t%s\t%s\t%s" % (found + (busy, title)))
        else:
            print("none")
        sys.exit(0)
print("none")
' 2>/dev/null)

case "$(printf '%s' "$info" | cut -f1)" in
  tmux)   die "This tab is already a tmux session. Nothing to promote." ;;
  claude) ;;
  *)      die "No claude is running in this tab." ;;
esac

WIN=$(printf '%s'  "$info" | cut -f2)
PID=$(printf '%s'  "$info" | cut -f3)
CWD=$(printf '%s'  "$info" | cut -f4)
BUSY=$(printf '%s' "$info" | cut -f5)
TITLE=$(printf '%s' "$info" | cut -f6-)

[ "$BUSY" = 1 ] && die "Claude is mid-response. Let it finish, then promote."
[ -d "$CWD" ]  || die "Cannot read this claude's directory. Nothing has changed."

default=$(session_name_for_path "$CWD")

printf 'Promote this tab into a tmux project\n\n'
printf '  conversation   %s\n' "${TITLE:-(untitled)}"
printf '  directory      %s\n' "$(printf '%s' "$CWD" | sed "s|^$HOME|~|")"
printf '\n  This exits the claude here and reopens it in the project.\n'
printf '  An existing project name gets a new claude window instead.\n\n'
printf 'project name [%s]  (ctrl-c cancels): ' "$default"
read -r name
[ -n "$name" ] || name="$default"

# The name is interpolated into a command typed at a shell, so keep it to
# characters that survive that without quoting games.
case "$name" in
  *[!A-Za-z0-9\ _/-]*) die "Use only letters, digits, space, and _ - /" ;;
esac

existing=0
tmux has-session -t "=$name" 2>/dev/null && existing=1

# Exit first, so the transcript is never open in two places.
#
# Ctrl-C twice, never Ctrl-D. Whatever is sent here reaches the shell instead
# the moment claude is already gone, and to a shell Ctrl-C is a cleared line
# while Ctrl-D is EOF: it exits zsh and takes this tab with it, a second before
# we mean to type an attach command into that very shell.
exit_attempt() {
  printf '\003' | K send-text --match "id:$WIN" --stdin
  sleep 0.3
  printf '\003' | K send-text --match "id:$WIN" --stdin
}

printf '\nexiting claude (pid %s)' "$PID"
exit_attempt

i=0
while kill -0 "$PID" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -gt 32 ] && die "claude did not exit. Nothing has changed; exit it yourself and try again."
  [ $((i % 8)) = 0 ] && exit_attempt
  printf '.'
  sleep 0.25
done

if [ "$existing" = 0 ]; then
  # Same shape as sessionizer.sh, with claude selected rather than nvim: the
  # conversation is what you came here to see.
  tmux new-session -d -s "$name" -c "$CWD" -n nvim
  tmux new-window  -d -t "=$name:" -c "$CWD" -n claude
  tmux select-window -t "=$name:claude"
  tmux set-option -t "$name" @bootstrap 1
  tmux set-option -t "$name" @bootstrap-claude 'claude --resume'
else
  # An existing project just gains a claude window. Unlike nvim, claude reflows
  # on resize, so there is nothing to gain by deferring it to attach.
  win=$(tmux new-window -P -F '#{window_id}' -t "=$name:" -c "$CWD" -n claude)
  tmux send-keys -t "$win" 'claude --resume' C-m
  tmux select-window -t "$win"
fi

# Attaching where the session is already on screen would make the two kitty
# tabs mirrors of each other (README, "Notes that will save you an hour
# later"). Go to that tab instead, and leave this one as the shell it now is.
"$CONF_DIR/bin/focus-client.sh" "$name" && exit 0

# Typed into the window's shell, the way every other program here is started.
# The exact `=name` target rather than `tx name`, which greps and takes the
# first match: wrong as soon as one project name is a prefix of another.
printf 'tmux attach-session -t "=%s"\n' "$name" | K send-text --match "id:$WIN" --stdin

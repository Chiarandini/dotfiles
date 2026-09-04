#!/bin/sh
# Declared dev servers, from ~/.config/tmux/serves.tsv.
#   start  start every server declared for the current session, idempotently
#   logs   pick a log and follow it
# Output is piped to a file so it survives the window and a crash; the pane
# scrollback is a convenience, the log is the record.
. "$HOME/.config/tmux/bin/lib.sh"

action=${1:-start}
# `adopt` takes over a server already running outside tmux: kill the holder,
# then start it in a serve/* window so it is managed, logged and restorable.
[ "$action" = adopt ] && { adopt=1; action=start; } || adopt=0

# Run from a display-popup, so resolve the session through this pane rather
# than through "the current client", which a popup does not have.
session=$(tmux display-message -p -t "${TMUX_PANE:-}" '#{session_name}' 2>/dev/null)
[ -n "$session" ] || { printf 'not inside a tmux session\n'; exit 1; }

# Shared by `start` and the session-renamed hook, so there is one
# implementation and one place for the wording to live.
warn_orphans() {
  o=$(orphan_serves)
  [ -n "$o" ] || return 0
  printf '\nNOTE: serves.tsv rows point at sessions that are not live, but whose\n'
  printf 'directories are open under another name. Renaming a project detaches it\n'
  printf 'from its declared servers; update the session column in serves.tsv:\n'
  printf '%s\n' "$o" | while IFS="$(printf '\t')" read -r ds dn live; do
    printf '  %s (%s)  ->  now open as  %s\n' "$ds" "$dn" "$live"
  done
}

case "$action" in
check)
  o=$(orphan_serves)
  [ -n "$o" ] || exit 0
  first=$(printf '%s\n' "$o" | head -1)
  ds=$(printf '%s' "$first" | cut -f1); live=$(printf '%s' "$first" | cut -f3)
  tmux display-message "serves.tsv still says '$ds' but that project is now '$live' - update serves.tsv"
  exit 0 ;;

start)
  tmp=$(mktemp) || exit 1
  read_tsv "$CONF_DIR/serves.tsv" > "$tmp"
  found=0
  # Redirect rather than pipe: a piped while runs in a subshell and $found
  # would never escape it.
  while IFS="$(printf '\t')" read -r s name cwd port cmd; do
    [ "$s" = "$session" ] || continue
    found=$((found + 1))
    win="serve/$name"
    cwd=$(expand_tilde "$cwd")
    log="$SERVE_LOG_DIR/$(slug "$session")-$name.log"

    # A taken port is the trap: most dev servers quietly bind a random one
    # instead and you end up debugging a different server than you think.
    if [ "$port" != "-" ] && [ -n "$port" ]; then
      hpid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $2}')
      if [ -n "$hpid" ]; then
        hname=$(ps -o comm= -p "$hpid" 2>/dev/null | sed 's|.*/||')
        hcwd=$(lsof -a -p "$hpid" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
        # Distinguish "this project is already served" from "something else is
        # squatting the port". Both leave the port alone, but only one is a
        # problem, and calling the good case SKIPPED reads like a failure.
        case "$hcwd" in
          "$cwd"|"$cwd"/*)
            if [ "$adopt" = 1 ]; then
              printf 'adopting  %s  (killing pid %s, restarting under tmux)\n' "$win" "$hpid"
              kill "$hpid" 2>/dev/null
              i=0; while [ "$i" -lt 20 ] && kill -0 "$hpid" 2>/dev/null; do sleep 0.5; i=$((i+1)); done
            else
              printf 'already serving  %s  on port %s\n  pid %s (%s), started outside tmux\n  it works, but is not logged here and will not survive a reboot\n  to manage it here: cmd+k A (adopt), which restarts it in a window\n\n' \
                "$win" "$port" "$hpid" "${hname:-?}"
              continue
            fi ;;
          *)
            printf 'SKIPPED  %s\n  port %s is held by %s (pid %s)\n  cwd %s\n  kill it, or that server will bind a random port instead\n\n' \
              "$win" "$port" "${hname:-?}" "$hpid" "${hcwd:-unknown}"
            continue ;;
        esac
        # No blanket `continue` here: the adopt path has just freed the port and
        # must fall through to the start below. Every branch that should stop
        # continues for itself.
      fi
    fi

    if tmux list-windows -t "=$session" -F '#{window_name}' | grep -qx "$win"; then
      # The window existing is not proof the server is up: a restored window
      # has the right name and a dead program. Ask what is actually running.
      running=$(tmux display-message -p -t "=$session:$win" '#{pane_current_command}' 2>/dev/null)
      case "$running" in
        zsh|bash|sh|fish|dash|"")
          tmux respawn-window -k -t "=$session:$win" -c "$cwd" "$cmd"
          tmux pipe-pane -o -t "=$session:$win" "cat >> '$log'"
          printf 'restarted  %s  (window was idle)\n  log %s\n' "$win" "$log" ;;
        *)
          printf 'already running  %s  (%s)\n' "$win" "$running" ;;
      esac
      continue
    fi

    tmux new-window -d -t "=$session:" -n "$win" -c "$cwd" "$cmd"
    tmux pipe-pane -o -t "=$session:$win" "cat >> '$log'"
    printf 'starting  %s\n  cwd  %s\n  log  %s\n' "$win" "$cwd" "$log"

    # "Launched" is not "listening". npm/ng and friends can fail a prestart
    # gate and exit seconds later, so confirm the port actually comes up
    # rather than reporting success optimistically.
    if [ "$port" != "-" ] && [ -n "$port" ]; then
      printf '  port %s ' "$port"
      up=0; i=0
      while [ "$i" -lt 30 ]; do
        if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then up=1; break; fi
        alive=$(tmux display-message -p -t "=$session:$win" '#{pane_current_command}' 2>/dev/null)
        case "$alive" in zsh|bash|sh|fish|dash|"") break ;; esac
        printf '.'; i=$((i + 1)); sleep 1
      done
      if [ "$up" = 1 ]; then
        printf ' LISTENING\n'
      else
        printf ' DID NOT COME UP\n\n  last lines of the log:\n'
        sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' "$log" 2>/dev/null | grep -v '^[[:space:]]*$' | tail -6 | sed 's/^/    /'
      fi
    fi
  done < "$tmp"
  rm -f "$tmp"
  [ "$found" -eq 0 ] && printf 'nothing declared for %s in serves.tsv\n' "$session"
  warn_orphans
  printf '\nServers run in their own serve/* windows. Closing this popup does\nnot stop them.\n'
  printf '\n[enter to close]'; read -r _ ;;

logs)
  f=$(ls -t "$SERVE_LOG_DIR"/*.log 2>/dev/null | fzf --prompt='log > ' --reverse --border \
        --preview 'tail -40 {}' --preview-window=right:60%)
  # less, not tail -f: q quits cleanly. This only reads a file, so nothing
  # here can affect the running server either way.
  [ -n "$f" ] && less +F "$f" ;;

*)
  printf 'usage: serve.sh [start|adopt|logs|check]\n'; exit 1 ;;
esac

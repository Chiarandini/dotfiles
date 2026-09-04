#!/bin/sh
# Publish three things every status tick:
#   @claude   per window   1 while a Claude is running in it
#   @working  per window   1 while that Claude is actually working
#   @state    per session  the session's most urgent glyph, for the kitty tab
#
# @claude exists because the window-status format cannot answer the question
# itself: see is_claude() below for why a process-name match is not enough. The
# format reads this option instead, so recognition is decided once, here.
#
# Both used to be computed inside format strings, and both were wrong there.
# The session aggregate used a #{W:...} loop, and strftime does not reach into
# a loop body, so the `%s` supplying "now" expanded to nothing and every
# session read as permanently working.
#
# Debounce is why the per-window test moved here too. "Working" cannot mean
# "produced output recently", because a single repaint counts: focusing a kitty
# tab makes tmux forward a focus event, Claude repaints in response, and the
# tab flashes yellow for no reason. So working means output in TWO CONSECUTIVE
# samples. A one-shot repaint from focus, resize or a bell never reaches a
# streak of two; real work advances every tick. The cost is that work shorter
# than roughly two ticks is not shown, which is the right trade for a
# glance-level indicator.
#
# LC_ALL=C on the awk is load-bearing: macOS BSD awk under a UTF-8 locale
# compares different multibyte strings as equal, so glyph comparisons silently
# always said "unchanged" and nothing was ever updated.
PATH=/opt/homebrew/bin:$PATH

STATE_DIR="$HOME/.local/state/tmux"
STAMP="$STATE_DIR/state-last-run"
LOCK="$STATE_DIR/state.lock"
now=$(date +%s)
TAB=$(printf '\t')

# Every attached client draws the status bar, so with six clients this is
# invoked six times per interval. That is not just six times the work: they all
# read and write the streak file, so they race, and the streak counting that
# the debounce depends on gets reset or double-counted at random. The symptom
# is a tab that lags, flickers or changes colour for no reason.
#
# So: one writer, at a fixed cadence. The timestamp guard makes extra
# invocations return immediately, and the mkdir lock is atomic, which closes
# the window where two start at the same moment. Any client can still drive it,
# so there is no daemon to supervise and it heals itself if a run dies.
last=$(cat "$STAMP" 2>/dev/null || echo 0)
case "$last" in *[!0-9]*|"") last=0 ;; esac
[ $((now - last)) -lt 2 ] && exit 0

mkdir "$LOCK" 2>/dev/null || {
  # Stale lock from a killed run: reclaim it after 30s rather than wedging.
  if [ -d "$LOCK" ]; then
    age=$(( now - $(stat -f %m "$LOCK" 2>/dev/null || echo "$now") ))
    [ "$age" -gt 30 ] && rmdir "$LOCK" 2>/dev/null
  fi
  exit 0
}
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
printf '%s\n' "$now" > "$STAMP"


. "$HOME/.config/tmux/bin/lib.sh"
STREAK="$STATE_DIR/window-activity"

sessions=$(tmux list-sessions -F "SES${TAB}#{session_name}${TAB}#{@state}" 2>/dev/null)
[ -n "$sessions" ] || exit 0

out=$(
  {
    [ -f "$STREAK" ] && sed 's/^/OLD	/' "$STREAK"
    printf '%s\n' "$sessions"
    tmux list-windows -a -F "WIN${TAB}#{window_id}${TAB}#{session_name}${TAB}#{window_bell_flag}${TAB}#{pane_current_command}${TAB}#{window_activity}${TAB}#{@working}${TAB}#{pane_title}${TAB}#{@claude}" 2>/dev/null
  } | LC_ALL=C awk -F"$TAB" -v now="$now" -v streak_file="$STREAK" '
    $1 == "OLD" { prev_act[$2] = $3; prev_streak[$2] = $4; next }
    $1 == "SES" { cur_state[$2] = $3; seen[$2] = 1; next }
    # Claude cannot be recognised by process name alone. Depending on the
    # install, pane_current_command is claude, claude.exe, or the bare
    # version string of a re-execed binary such as 2.1.251, so a name match
    # misses it and the session falls through to another glyph. It always
    # keeps a marker at the head of the pane title: U+2733 when idle, or a
    # spinner from the braille or half-circle family. Byte comparisons,
    # since LC_ALL=C is set on this awk.
    function is_claude(cmd, title,   b1, b2, b3) {
      if (cmd ~ /^claude/) return 1
      b1 = substr(title, 1, 1); b2 = substr(title, 2, 1); b3 = substr(title, 3, 1)
      if (b1 != "\342") return 0
      if (b2 == "\234" && b3 == "\263") return 1
      if (b2 >= "\240" && b2 <= "\243") return 1
      if (b2 == "\227" && b3 >= "\220" && b3 <= "\223") return 1
      return 0
    }

    $1 == "WIN" {
      id = $2; s = $3; seen[s] = 1
      act = $6; was = $7
      claude_win = is_claude($5, $8)

      # Consecutive samples that produced new output.
      st = (id in prev_act && act != prev_act[id]) ? prev_streak[id] + 1 : 0
      new_act[id] = act; new_streak[id] = st

      w = (claude_win && st >= 2 && now - act < 5) ? 1 : 0
      if (w != (was == "1" ? 1 : 0))
        printf "set-option -w -t %s @working %d ; ", id, w

      # Unset reads as empty, so a window that has never held a Claude emits
      # once and then stays quiet, same as @working.
      if (claude_win != ($9 == "1" ? 1 : 0))
        printf "set-option -w -t %s @claude %d ; ", id, claude_win

      if ($4 == "1")      bell[s] = 1
      if (claude_win)     { claude[s] = 1; nclaude[s]++; if (w) working[s] = 1 }
      if ($5 ~ /^nvim/)   edit[s] = 1
    }
    END {
      for (s in seen) {
        if      (bell[s])    g = "!"
        else if (working[s]) g = "\342\240\277"   # U+283F
        else if (claude[s])  g = "\342\234\263"   # U+2733
        else if (edit[s])    g = "\342\234\216"   # U+270E
        else                 g = "\342\200\272"   # U+203A

        # How many Claudes live in this project. One is the common case and a
        # "1" everywhere would be noise, so it only shows from two up.
        g = g (nclaude[s] > 1 ? nclaude[s] : "") " "
        if (cur_state[s] != g) {
          t = s; gsub(/"/, "\\\"", t)
          printf "set-option -t \"%s\" @state \"%s\" ; ", t, g
        }
      }
      for (id in new_act)
        printf "%s\t%s\t%s\n", id, new_act[id], new_streak[id] > streak_file
    }')

# One invocation for every change, or none at all when nothing moved. Fed
# through source-file, not the shell: session names contain spaces and the
# quoting is tmux's, not the shell's.
if [ -n "$out" ]; then
  f=$(mktemp) || exit 0
  printf '%s\n' "${out%; }" > "$f"
  tmux source-file "$f" 2>/dev/null
  rm -f "$f"
fi
exit 0

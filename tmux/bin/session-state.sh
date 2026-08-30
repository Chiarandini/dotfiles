#!/bin/sh
# Publish two things every status tick:
#   @working  per window   1 while a Claude is actually working
#   @state    per session  the session's most urgent glyph, for the kitty tab
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
. "$HOME/.config/tmux/bin/lib.sh"

STREAK="$STATE_DIR/window-activity"
now=$(date +%s)
TAB=$(printf '\t')

sessions=$(tmux list-sessions -F "SES${TAB}#{session_name}${TAB}#{@state}" 2>/dev/null)
[ -n "$sessions" ] || exit 0

out=$(
  {
    [ -f "$STREAK" ] && sed 's/^/OLD	/' "$STREAK"
    printf '%s\n' "$sessions"
    tmux list-windows -a -F "WIN${TAB}#{window_id}${TAB}#{session_name}${TAB}#{window_bell_flag}${TAB}#{pane_current_command}${TAB}#{window_activity}${TAB}#{@working}" 2>/dev/null
  } | LC_ALL=C awk -F"$TAB" -v now="$now" -v streak_file="$STREAK" '
    $1 == "OLD" { prev_act[$2] = $3; prev_streak[$2] = $4; next }
    $1 == "SES" { cur_state[$2] = $3; seen[$2] = 1; next }
    $1 == "WIN" {
      id = $2; s = $3; seen[s] = 1
      act = $6; was = $7

      # Consecutive samples that produced new output.
      st = (id in prev_act && act != prev_act[id]) ? prev_streak[id] + 1 : 0
      new_act[id] = act; new_streak[id] = st

      w = ($5 ~ /^claude/ && st >= 2 && now - act < 5) ? 1 : 0
      if (w != (was == "1" ? 1 : 0))
        printf "set-option -w -t %s @working %d ; ", id, w

      if ($4 == "1")      bell[s] = 1
      if ($5 ~ /^claude/) { claude[s] = 1; if (w) working[s] = 1 }
      if ($5 ~ /^nvim/)   edit[s] = 1
    }
    END {
      for (s in seen) {
        if      (bell[s])    g = "! "
        else if (working[s]) g = "\342\240\277 "   # U+283F
        else if (claude[s])  g = "\342\234\263 "   # U+2733
        else if (edit[s])    g = "\342\234\216 "   # U+270E
        else                 g = "\342\200\272 "   # U+203A
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

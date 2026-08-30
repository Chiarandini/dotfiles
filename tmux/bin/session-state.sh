#!/bin/sh
# Compute each session's most urgent state and publish it as @state, which
# set-titles-string reads. That is what the kitty tab shows.
#
# This used to be done inside the title format with a #{W:...} loop, and it was
# quietly wrong: strftime does not reach inside a loop body, so the `%s` meant
# to supply "now" expanded to nothing, every window's computed age became 0,
# and every session read as permanently working. The per-window status bar was
# unaffected because it does not loop.
#
# Precedence matches the window bar: attention > working > ready > editing >
# idle. Printing nothing is deliberate; this is called from status-right for
# its side effect, once per status interval.
#
# LC_ALL=C on the awk is load-bearing, not tidiness: macOS's BSD awk under a
# UTF-8 locale compares multibyte strings as equal even when they differ, so
# `cur[s] != g` silently returned false for every glyph and no session was ever
# updated. Byte semantics make the comparison honest.
#
# It runs every second, so it is written to cost as little as possible: two
# tmux reads, then a single batched write containing only the sessions whose
# state actually changed. In the common case, nothing changed and there is no
# write at all.
PATH=/opt/homebrew/bin:$PATH

now=$(date +%s)
TAB=$(printf '\t')

# Current published state, so we can skip writes that would be no-ops.
current=$(tmux list-sessions -F "#{session_name}${TAB}#{@state}" 2>/dev/null)
[ -n "$current" ] || exit 0

cmds=$(
  {
    printf '%s\n' "$current" | sed 's/^/CUR\t/'
    tmux list-windows -a -F "WIN${TAB}#{session_name}${TAB}#{window_bell_flag}${TAB}#{pane_current_command}${TAB}#{window_activity}" 2>/dev/null
  } | LC_ALL=C awk -F"$TAB" -v now="$now" '
    $1 == "CUR" { cur[$2] = $3; seen[$2] = 1; next }
    $1 == "WIN" {
      s = $2; seen[s] = 1
      if ($3 == "1")      bell[s] = 1
      if ($4 ~ /^claude/) { claude[s] = 1; if (now - $5 < 3) working[s] = 1 }
      if ($4 ~ /^nvim/)   edit[s] = 1
    }
    END {
      for (s in seen) {
        if      (bell[s])    g = "! "
        else if (working[s]) g = "\342\240\277 "   # U+283F
        else if (claude[s])  g = "\342\234\263 "   # U+2733
        else if (edit[s])    g = "\342\234\216 "   # U+270E
        else                 g = "\342\200\272 "   # U+203A
        if (cur[s] != g) {
          gsub(/"/, "\\\"", s)
          printf "set-option -t \"%s\" @state \"%s\" ; ", s, g
        }
      }
    }')

# One invocation for every change, or none at all when nothing moved.
# Fed through source-file rather than the shell: the commands carry quoting for
# tmux's parser, and session names contain spaces ("short story"), so shell
# word-splitting mangles both.
if [ -n "$cmds" ]; then
  f=$(mktemp) || exit 0
  printf '%s\n' "${cmds%; }" > "$f"
  tmux source-file "$f" 2>/dev/null
  rm -f "$f"
fi
exit 0

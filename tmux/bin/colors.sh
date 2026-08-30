#!/bin/sh
# Colour comparison. Run it inside tmux and again in a plain kitty tab; if the
# two look different, the difference is what needs explaining. Prints the
# things that actually differ between terminals rather than a pretty chart.
printf '\n  context   %s\n' "${TMUX:+inside tmux}${TMUX:-plain terminal}"
printf '  TERM      %s\n'   "$TERM"
printf '  COLORTERM %s\n'   "${COLORTERM:-UNSET}"
printf '  tput      %s colours\n\n' "$(tput colors 2>/dev/null)"

printf '  ANSI 0-7    '
i=0; while [ $i -lt 8 ]; do printf '\033[4%dm   \033[0m' "$i"; i=$((i+1)); done; printf '\n'
printf '  bright 8-15 '
i=0; while [ $i -lt 8 ]; do printf '\033[10%dm   \033[0m' "$i"; i=$((i+1)); done; printf '\n\n'

printf '  fg text     '
i=0; while [ $i -lt 8 ]; do printf '\033[3%dmAa\033[0m ' "$i"; i=$((i+1)); done; printf '\n'
printf '  bold        '
i=0; while [ $i -lt 8 ]; do printf '\033[1;3%dmAa\033[0m ' "$i"; i=$((i+1)); done; printf '\n'
printf '  italic      \033[3mitalic\033[0m    dim \033[2mdim\033[0m    underline \033[4mul\033[0m\n\n'

printf '  24-bit ramp '
i=0
while [ $i -lt 32 ]; do
  r=$((255 - i * 8)); g=$((i * 8)); b=128
  printf '\033[48;2;%d;%d;%dm \033[0m' "$r" "$g" "$b"
  i=$((i+1))
done
printf '\n'
printf '  If that ramp has visible steps or bands, 24-bit colour is being\n'
printf '  quantised. If it is smooth in both contexts, colour is fine and the\n'
printf '  difference is a palette or theme question, not a tmux one.\n\n'

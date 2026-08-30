#!/bin/sh
# Renders actions.tsv two ways, so the menu and the search can never disagree:
#   (no args)  the cmd+k display-menu
#   find       fzf over the same actions, for when you know what you want but
#              not which letter it is
. "$HOME/.config/tmux/bin/lib.sh"

ACTIONS="$CONF_DIR/actions.tsv"
PENDING="$STATE_DIR/pending-action"
TAB=$(printf '\t')

# Run a tmux command string through tmux's own parser rather than the shell's.
# The commands carry quoting meant for tmux (display-popup '...'), so eval or
# word-splitting here would mangle them; source-file parses them exactly as
# the menu would.
run_tmux_command() {
  f=$(mktemp) || exit 1
  printf '%s\n' "$1" > "$f"
  tmux source-file "$f"
  rm -f "$f"
}

case "${1:-menu}" in
find)
  # Runs INSIDE a popup, so it must not execute the choice itself: tmux
  # cannot open a popup from within a popup, which silently did nothing for
  # every action that opens one (guide, logs, pickers) while run-shell
  # actions worked. Instead record the choice and let the chained
  # `run-picked` fire once this popup has closed. display-popup blocks the
  # command sequence, so that ordering is guaranteed without a sleep.
  rm -f "$PENDING"
  picked=$(read_tsv "$ACTIONS" | awk -F"$TAB" 'NF>=3 {printf "%-3s %s\n", $1, $2}' \
    | fzf --prompt='action > ' --reverse --border \
          --header='key  action')
  [ -z "$picked" ] && exit 0
  key=$(printf '%s' "$picked" | awk '{print $1}')
  read_tsv "$ACTIONS" | awk -F"$TAB" -v k="$key" 'NF>=3 && $1==k {print $3; exit}' > "$PENDING"
  ;;

run-picked)
  [ -s "$PENDING" ] || exit 0
  cmd=$(cat "$PENDING"); rm -f "$PENDING"
  run_tmux_command "$cmd"
  ;;

menu)
  # Build the display-menu argument list: label, key, command per entry, and a
  # lone empty string for each separator.
  set -- display-menu -T "#[align=centre fg=#F08C3A,bold] cmd+k " -x C -y C
  while IFS= read -r line; do
    case "$line" in
      -) set -- "$@" "" ; continue ;;
    esac
    k=$(printf '%s' "$line" | cut -f1)
    lbl=$(printf '%s' "$line" | cut -f2)
    cmd=$(printf '%s' "$line" | cut -f3-)
    [ -n "$k" ] && [ -n "$cmd" ] && set -- "$@" "$lbl" "$k" "$cmd"
  done <<EOF
$(read_tsv "$ACTIONS")
EOF
  tmux "$@"
  ;;

*)
  printf 'usage: menu.sh [menu|find|run-picked]\n'; exit 1 ;;
esac

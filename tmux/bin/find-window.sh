#!/bin/sh
# Window picker. Default is every window in every project; --project limits to
# the current session. Both bindings ship on purpose and both log here, so
# which one actually gets used is settled by counts rather than impression.
# Heir to kitty/taborg/switcher.sh, which grouped by kind and showed live state.
. "$HOME/.config/tmux/bin/lib.sh"

scope=all
[ "$1" = "--project" ] && scope=project

if [ "$scope" = project ]; then
  list=$(tmux list-windows -F '#{session_name}	#{window_index}	#{window_name}	#{pane_current_command}	#{window_activity}')
  prompt='window (this project) > '
else
  list=$(tmux list-windows -a -F '#{session_name}	#{window_index}	#{window_name}	#{pane_current_command}	#{window_activity}')
  prompt='window (all projects) > '
fi

[ -z "$list" ] && exit 0

# Same definition of "working" as the status line: recent output, not the
# title. Claude keeps a static "* <topic>" in its title whether idle or busy,
# so the title cannot answer this. Comparing the title here also hit a macOS
# BSD awk bug where multibyte strings compare equal, which made every Claude
# window report "ready" regardless.
now=$(date +%s)
rows=$(printf '%s\n' "$list" | LC_ALL=C awk -F'\t' -v now="$now" '
  {
    cmd = $4; state = ""
    if (cmd ~ /^claude/)    state = (now - $5 < 3) ? "working" : "ready"
    else if (cmd ~ /^nvim/) state = "edit"
    printf "%s\t%s\t%s\t%s\t%s\n", $1, $2, $3, state, cmd
  }' | sort -t'\t' -k1,1 -k2,2n)

picked=$(printf '%s\n' "$rows" | fzf \
  --delimiter='\t' --with-nth=1,3,4 \
  --prompt="$prompt" --reverse --border \
  --header='project                window                 state')

[ -z "$picked" ] && exit 0
log_picker "window-$scope"

sess=$(printf '%s' "$picked" | cut -f1)
idx=$(printf '%s' "$picked" | cut -f2)

tmux switch-client -t "=$sess"
tmux select-window -t "=$sess:$idx"

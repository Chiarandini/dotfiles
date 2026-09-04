#!/bin/sh
# Project picker. Lists live sessions first, then every directory under the
# declared roots plus zoxide frecency.
#
# A project is a tmux session. A directory is only how one is born and named:
# once it exists it is its own object, so a session you renamed to something
# with no directory behind it still shows up here and is jumped to, not
# recreated.
# Heir to kitty/scripts/claude-here.sh, which used the same roots+zoxide list.
. "$HOME/.config/tmux/bin/lib.sh"

TAB=$(printf '\t')

live=$(tmux list-sessions -F "session${TAB}●${TAB}#{session_name}#{?session_attached, (attached),}" 2>/dev/null)

roots=$(read_tsv "$CONF_DIR/roots.tsv" | while IFS="$TAB" read -r k r; do
  [ -n "$r" ] || continue
  expand_tilde "$(trim "$r")"
done)

dirs=$(
  IFS='
'
  for r in $roots; do
    [ -d "$r" ] && find "$r" -mindepth 1 -maxdepth 1 -type d ! -name '.*' 2>/dev/null
  done
  printf '%s\n' "$roots"
  zoxide query --list 2>/dev/null
)

dirs=$(printf '%s\n' "$dirs" | awk 'NF && !seen[$0]++' | sed "s|^$HOME|~|" \
       | while IFS= read -r d; do printf 'dir%s %s%s\n' "$TAB" "$TAB" "$d"; done)

picked=$(printf '%s\n%s\n' "$live" "$dirs" | awk 'NF' | fzf \
  --delimiter="$TAB" --with-nth=2,3 \
  --prompt='project > ' --reverse --border \
  --header='● = already open' \
  --preview 'echo {} | cut -f3 | sed "s| (attached)||; s|^~|'"$HOME"'|" | xargs -I{} sh -c "ls -1 {} 2>/dev/null | head -30"' \
  --preview-window=right:45%)

[ -z "$picked" ] && exit 0
log_picker "project"

kind=$(printf '%s' "$picked" | cut -f1)
value=$(printf '%s' "$picked" | cut -f3 | sed 's| (attached)||')

attach() {
  # If another kitty tab is already showing this session, go there instead of
  # attaching a second client, which would make the two tabs mirror each other.
  "$HOME/.config/tmux/bin/focus-client.sh" "$1" && return 0
  if [ -n "$TMUX" ]; then tmux switch-client -t "=$1"; else tmux attach-session -t "=$1"; fi
}

if [ "$kind" = session ]; then
  attach "$value"
  exit 0
fi

dir=$(expand_tilde "$value")
[ -d "$dir" ] || exit 0
name=$(session_name_for_path "$dir")

if ! tmux has-session -t "=$name" 2>/dev/null; then
  tmux new-session -d -s "$name" -c "$dir" -n nvim
  tmux new-window  -d -t "=$name:" -c "$dir" -n claude
  tmux select-window -t "=$name:nvim"
  # Launch only once a client is attached; see bin/bootstrap.sh.
  # No `=` prefix: set-option's -t is a target-*pane*, and `=name` does not
  # resolve as one. It fails with "no such session" and returns 1, which is
  # silent here, and left @bootstrap unset so nothing was ever launched.
  tmux set-option -t "$name" @bootstrap 1
fi

attach "$name"

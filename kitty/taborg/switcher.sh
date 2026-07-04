#!/bin/sh
# Fuzzy-switch across all kitty tabs in every OS window. Shows each tab's kind
# (WKIND) and live state, grouped by kind -- so this doubles as the "find and
# return to a stashed/backstaged tab" view.
# Launched via: kitty @ launch --type=overlay ~/.config/kitty/taborg/switcher.sh
. "$HOME/.config/kitty/taborg/lib.sh"
TABORG_TAG=switcher

[ -z "$SOCK" ] && exit 0

picked=$(K ls | jq -r '
  .[].tabs[] as $t
  | ([$t.windows[].user_vars.WKIND] | map(select(. != null)) | .[0] // "misc") as $kind
  | ([$t.windows[].title] | .[0] // $t.title) as $wt
  | (($wt | explode | .[0]) // 0) as $c
  | (if   ($c >= 10240 and $c <= 10495) then "running"
       elif ($wt | startswith("✳"))      then "ready"
       else "" end) as $state
  | [ ($t.id|tostring), $kind, $state, ($t.title // "(untitled)") ] | @tsv
' | sort -t'	' -k2,2 -k4,4 | fzf \
    --delimiter='\t' \
    --with-nth=2,3,4 \
    --prompt='tab > ' \
    --no-sort \
    --reverse \
    --header='kind      state     title')

[ -z "$picked" ] && exit 0
tab_id=$(printf '%s' "$picked" | cut -f1)
K focus-tab --match "id:$tab_id"

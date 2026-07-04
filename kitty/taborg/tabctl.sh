#!/bin/sh
# User-driven tab actions, bound to keys in kitty.conf:
#   stash      -> tag the focused tab WKIND=stash and move it to Backstage
#   tabled     -> toggle a grey "parked" mark (CAT=tabled) in place
#   reconcile  -> re-route every tab to its home window (manual tidy-up)
. "$HOME/.config/kitty/taborg/lib.sh"
TABORG_TAG=tabctl

[ -z "$SOCK" ] && { log "no kitty socket; abort"; exit 0; }
LS=$(K ls 2>/dev/null) || { log "kitty ls failed"; exit 0; }
ROUTE="$TABORG_DIR/route.sh"

focused_tab() {
  printf '%s' "$LS" | jq -r \
    '.[] | select(.is_focused) | .tabs[] | select(.is_focused) | .id' | head -1
}

active_window_of() {  # $1 = tab id
  printf '%s' "$LS" | jq -r --argjson t "$1" \
    '.[].tabs[] | select(.id==$t)
     | ((.windows[] | select(.is_active) | .id) // .windows[0].id)' | head -1
}

case "${1:-}" in
  stash)
    TAB=$(focused_tab); [ -z "$TAB" ] && { log "stash: no focused tab"; exit 0; }
    for wid in $(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
        '.[].tabs[] | select(.id==$t) | .windows[].id'); do
      K set-user-vars --match "id:$wid" "WKIND=stash" >/dev/null 2>&1
    done
    HOME_TAB=$(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
      '.[].tabs[] | select(.id != $t)
       | select(any(.windows[]; .user_vars.WKIND=="stash")) | .id' | head -1)
    if [ -n "$HOME_TAB" ]; then
      K detach-tab --match "id:$TAB" --target-tab "id:$HOME_TAB" 2>>"$TABORG_LOG"
      log "stash: tab $TAB -> Backstage (tab $HOME_TAB)"
    else
      K detach-tab --match "id:$TAB" 2>>"$TABORG_LOG"
      log "stash: tab $TAB -> new Backstage window"
    fi
    ;;
  tabled)
    TAB=$(focused_tab); [ -z "$TAB" ] && { log "tabled: no focused tab"; exit 0; }
    AW=$(active_window_of "$TAB")
    CUR=$(printf '%s' "$LS" | jq -r --argjson a "$AW" \
      '[.[].tabs[].windows[] | select(.id==$a) | .user_vars.CAT] | .[0] // ""')
    if [ "$CUR" = "tabled" ]; then
      K set-user-vars --match "id:$AW" "CAT=" >/dev/null 2>&1
      log "tabled: tab $TAB unmarked"
    else
      K set-user-vars --match "id:$AW" "CAT=tabled" >/dev/null 2>&1
      log "tabled: tab $TAB marked"
    fi
    ;;
  reconcile)
    N=0
    for wid in $(printf '%s' "$LS" | jq -r \
        '.[].tabs[] | ((.windows[] | select(.is_active) | .id) // .windows[0].id)'); do
      ROUTE_WINDOW_ID="$wid" sh "$ROUTE"
      N=$((N + 1))
    done
    log "reconcile: processed $N tabs"
    ;;
  *)
    log "unknown action: '${1:-}'"
    ;;
esac

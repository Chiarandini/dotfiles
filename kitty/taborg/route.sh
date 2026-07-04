#!/bin/sh
# Route the tab containing $ROUTE_WINDOW_ID into the OS window that holds its
# "kind" (claude / edit / misc). Idempotent: exits early when already correct,
# so it is safe to call on every command-boundary event and to fan out over
# every tab (see tabctl.sh reconcile).
. "$HOME/.config/kitty/taborg/lib.sh"
TABORG_TAG=route

[ -z "$SOCK" ] && { log "no kitty socket; abort"; exit 0; }
WIN="${ROUTE_WINDOW_ID:-$KITTY_WINDOW_ID}"
[ -z "$WIN" ] && { log "no window id; abort"; exit 0; }

LS=$(K ls 2>/dev/null) || { log "kitty ls failed (socket $SOCK)"; exit 0; }

# Tab + OS window containing WIN.
TAB=$(printf '%s' "$LS" | jq -r --argjson w "$WIN" \
  '.[].tabs[] | select([.windows[].id] | index($w)) | .id' | head -1)
[ -z "$TAB" ] && { log "win $WIN not found in any tab"; exit 0; }
OSW=$(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
  '.[] | select([.tabs[].id] | index($t)) | .id' | head -1)

# Kind from any foreground command running anywhere in the tab.
BLOB=$(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
  '.[].tabs[] | select(.id==$t) | .windows[].foreground_processes[].cmdline[]?')
case "$BLOB" in
  *claude*) KIND=claude ;;
  *nvim*)   KIND=edit ;;
  *)        KIND=misc ;;
esac

# Current tag (from any window in the tab).
CUR=$(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
  '[.[].tabs[] | select(.id==$t) | .windows[].user_vars.WKIND]
   | map(select(. != null)) | .[0] // ""')

if [ "$KIND" = "$CUR" ]; then
  log "win=$WIN tab=$TAB kind=$KIND already placed; no-op"
  exit 0
fi

# Tag every window in the tab.
for wid in $(printf '%s' "$LS" | jq -r --argjson t "$TAB" \
    '.[].tabs[] | select(.id==$t) | .windows[].id'); do
  K set-user-vars --match "id:$wid" "WKIND=$KIND" >/dev/null 2>&1
done

# Existing home window for this kind, in a *different* OS window.
HOME_TAB=$(printf '%s' "$LS" | jq -r \
  --argjson t "$TAB" --argjson osw "$OSW" --arg k "$KIND" \
  '.[] | select(.id != $osw) | .tabs[] | select(.id != $t)
   | select(any(.windows[]; .user_vars.WKIND == $k)) | .id' | head -1)

if [ -n "$HOME_TAB" ]; then
  if K detach-tab --match "id:$TAB" --target-tab "id:$HOME_TAB" 2>>"$TABORG_LOG"; then
    log "win=$WIN tab=$TAB kind=$KIND (was '$CUR') -> merged into home tab $HOME_TAB"
  else
    log "win=$WIN tab=$TAB kind=$KIND -> detach to home $HOME_TAB FAILED"
  fi
else
  NTABS=$(printf '%s' "$LS" | jq -r --argjson o "$OSW" \
    '.[] | select(.id==$o) | .tabs | length')
  if [ "${NTABS:-1}" -gt 1 ]; then
    if K detach-tab --match "id:$TAB" 2>>"$TABORG_LOG"; then
      log "win=$WIN tab=$TAB kind=$KIND (was '$CUR') -> seeded new $KIND window"
    else
      log "win=$WIN tab=$TAB kind=$KIND -> seed new window FAILED"
    fi
  else
    log "win=$WIN tab=$TAB kind=$KIND (was '$CUR') -> alone in window, tagged in place"
  fi
fi

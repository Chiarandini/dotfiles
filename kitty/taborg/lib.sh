# Shared helpers for the taborg shell scripts. Source this, do not run it.
#   . "$HOME/.config/kitty/taborg/lib.sh"
PATH=/opt/homebrew/bin:$PATH

TABORG_DIR="$HOME/.config/kitty/taborg"
TABORG_LOG="$TABORG_DIR/taborg.log"

# Resolve THIS kitty instance's remote-control socket. Prefer an explicit
# socket (TABORG_SOCK, passed by the watcher) or the inherited KITTY_LISTEN_ON
# (set in every kitty window and its launched children). Only if neither is
# present do we scan /tmp/mykitty* and pick the instance that actually has
# tabs -- this avoids stray headless kitty instances (e.g. from `open -n`).
_resolve_sock() {
  for cand in "${TABORG_SOCK:-}" "${KITTY_LISTEN_ON:-}"; do
    case "$cand" in
      unix:*) printf '%s' "${cand#unix:}"; return ;;
      ?*)     printf '%s' "$cand"; return ;;
    esac
  done
  best=""; bestn=-1
  for s in /tmp/mykitty*; do
    [ -S "$s" ] || continue
    n=$(kitty @ --to "unix:$s" ls 2>/dev/null | jq -r '[.[].tabs[]]|length' 2>/dev/null)
    [ -z "$n" ] && n=0
    [ "$n" -gt "$bestn" ] && { best="$s"; bestn="$n"; }
  done
  printf '%s' "$best"
}
SOCK=$(_resolve_sock)
K() { kitty @ --to "unix:$SOCK" "$@"; }

# Append a timestamped line to the shared log; self-trims to stay small.
log() {
  if [ -f "$TABORG_LOG" ] && [ "$(wc -l < "$TABORG_LOG" 2>/dev/null || echo 0)" -gt 2000 ]; then
    tail -n 500 "$TABORG_LOG" > "$TABORG_LOG.tmp" 2>/dev/null && mv "$TABORG_LOG.tmp" "$TABORG_LOG"
  fi
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${TABORG_TAG:-taborg}" "$*" >> "$TABORG_LOG" 2>/dev/null
}

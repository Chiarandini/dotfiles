#!/bin/sh
# Shared helpers for the tmux bin scripts. Sourced, never run directly.
PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH
export PATH

CONF_DIR="$HOME/.config/tmux"
STATE_DIR="$HOME/.local/state/tmux"
SERVE_LOG_DIR="$STATE_DIR/serve"
PICKER_LOG="$STATE_DIR/picker-usage.log"

mkdir -p "$SERVE_LOG_DIR"

# Drop whole-line comments and blanks. Only whole-line, so a '#' inside a
# declared server command survives.
read_tsv() {
  [ -f "$1" ] || return 0
  sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$1"
}

expand_tilde() {
  case "$1" in
    "~/"*) printf '%s\n' "$HOME/${1#\~/}" ;;
    *)     printf '%s\n' "$1" ;;
  esac
}

# Trim only the ends. Stripping all whitespace would corrupt real paths:
# "textbooks - BACKUP" is a directory that exists.
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

# tmux reserves . and : in names via the session:window.pane target syntax.
sanitize() { printf '%s\n' "$1" | tr ':.' '--'; }

# Filename-safe form. Session names carry a / (pg/website-nate), which would
# otherwise silently become a directory component and the write would fail.
slug() { printf '%s\n' "$1" | tr ':./' '---'; }

# Longest-root match, so writing/textbooks wins over its parent root.
kind_for_path() {
  _p="$1"
  read_tsv "$CONF_DIR/roots.tsv" | while IFS="$(printf '\t')" read -r k r; do
    [ -n "$r" ] || continue
    r=$(expand_tilde "$(trim "$r")")
    case "$_p/" in
      "$r/"*) printf '%s\t%s\n' "${#r}" "$k" ;;
    esac
  done | sort -rn | head -1 | cut -f2
}

session_name_for_path() {
  _p="$1"
  _k=$(kind_for_path "$_p")
  [ -n "$_k" ] || _k=x
  sanitize "$_k/$(basename "$_p")"
}

log_picker() {
  printf '%s\t%s\n' "$(date +%Y-%m-%dT%H:%M:%S)" "$1" >> "$PICKER_LOG"
}

# serves.tsv is keyed by session name, so renaming a project detaches it from
# its declared servers. This reports only the case that is actually wrong: a
# declared session that is NOT live, whose directory IS open under some other
# session name. A project you simply have not opened yet stays silent, which
# is what keeps this from becoming noise.
#
# Derived from live tmux state and the registry on every call, so there is
# nothing cached to drift.
# Prints: <declared session>\t<server name>\t<live session it looks like>
orphan_serves() {
  _tab=$(printf '\t')
  _live=$(tmux list-sessions -F '#{session_name}' 2>/dev/null)
  [ -n "$_live" ] || return 0
  _paths=$(tmux list-windows -a -F "#{session_name}${_tab}#{pane_current_path}" 2>/dev/null)
  read_tsv "$CONF_DIR/serves.tsv" | while IFS="$_tab" read -r _s _n _cwd _port _cmd; do
    [ -n "$_s" ] || continue
    printf '%s\n' "$_live" | grep -qxF "$_s" && continue
    _d=$(expand_tilde "$(trim "$_cwd")")
    _m=$(printf '%s\n' "$_paths" | awk -F"$_tab" -v d="$_d" '
      $2 != "" && (index(d, $2) == 1 || index($2, d) == 1) { print $1; exit }')
    [ -n "$_m" ] && printf '%s\t%s\t%s\n' "$_s" "$_n" "$_m"
  done
}

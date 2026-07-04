# ~/.config/zsh/functions.zsh
# Shell functions (as opposed to aliases). Sourced from ~/.zshrc.

# ─── zj: project session launcher ────────────────────────────────────────
# Usage: zj <project-name>
#
# - If a zellij session named <project-name> is already running, attach to it.
# - Otherwise, cd into ~/programming/<project-name>, then create a new zellij
#   session using ~/.config/zellij/layouts/<project-name>.kdl if it exists,
#   falling back to zellij's default layout if it doesn't.
#
# Example:
#     zj openclaw           # first call: creates session w/ openclaw layout
#     <do work, Ctrl-O d>   # detach
#     zj openclaw           # reattach, everything's still running
zj() {
    local name="${1:?Usage: zj <project-name>}"
    local layout="$HOME/.config/zellij/layouts/${name}.kdl"
    local proj_dir="$HOME/programming/$name"

    # Refuse to nest — zellij silently degrades --session to attach-only
    # when already inside a session, which produces confusing errors.
    if [[ -n "$ZELLIJ" ]]; then
        echo "zj: already inside a zellij session ('${ZELLIJ_SESSION_NAME:-?}')." >&2
        echo "    Detach first with Ctrl-g, Ctrl-o, d — then run zj again." >&2
        return 1
    fi

    if [[ ! -d "$proj_dir" ]]; then
        echo "zj: no project at $proj_dir" >&2
        return 1
    fi
    builtin cd "$proj_dir" || return 1

    # Strip ANSI color codes from list-sessions before matching.
    if zellij list-sessions 2>/dev/null | sed $'s/\x1b\\[[0-9;]*m//g' | grep -q "^${name}\\b"; then
        zellij attach "$name"
    elif [[ -f "$layout" ]]; then
        # `-n` (--new-session-with-layout) is the right flag for "create new
        # with layout". `--layout` alone means "add layout to existing session
        # as a new tab" — which errors if the session doesn't exist yet.
        zellij --session "$name" -n "$layout"
    else
        zellij --session "$name"
    fi
}

# ─── _rem: tab-completion for the `rem` reminders CLI ─────────────────────
# Completes verbs (ls/add/done/lists) and your actual Reminders list names for
# `rem ls`, `rem add`, and `rem done --list`. List names come from `rem lists`
# (names-only, fast). Cached to a FILE with a 30s TTL — not a shell var, because
# completion calls _rem_lists inside $(...) subshells where var-caching wouldn't
# survive, so zsh-autocomplete's per-keystroke completion would otherwise spawn
# an EventKit process on every key. Calls the wrapper by full path so it doesn't
# depend on the `rem` alias being expanded here.
_rem_bin="$HOME/programming/constellation/mcp-servers/apple-reminders/rem"
_rem_lists() {
    local cache="${TMPDIR:-/tmp}/rem-lists.${UID}.cache" now=0 mtime=0
    zmodload zsh/datetime 2>/dev/null; now=${EPOCHSECONDS:-0}
    zmodload zsh/stat 2>/dev/null
    [[ -f $cache ]] && mtime=$(zstat +mtime "$cache" 2>/dev/null)
    if [[ ! -s $cache || $now -eq 0 || $(( now - mtime )) -ge 30 ]]; then
        "$_rem_bin" lists 2>/dev/null > "$cache"
    fi
    cat "$cache" 2>/dev/null
}
_rem() {
    local state
    _arguments -C '1: :->verb' '*:: :->args' && return
    case $state in
        verb)
            local -a verbs
            verbs=('ls:items in a list' 'add:create a reminder'
                   'done:complete (or fzf picker)' 'lists:print list names')
            _describe 'rem command' verbs ;;
        args)
            local -a lists
            case $words[1] in
                ls)  lists=("${(@f)$(_rem_lists)}"); compadd -a lists ;;
                add) [[ $CURRENT -eq 2 ]] && { lists=("${(@f)$(_rem_lists)}"); compadd -a lists } ;;
                done)
                    if [[ $words[CURRENT-1] == --list ]]; then
                        lists=("${(@f)$(_rem_lists)}"); compadd -a lists
                    else
                        compadd -- --list
                    fi ;;
            esac ;;
    esac
}
(( $+functions[compdef] )) && compdef _rem rem

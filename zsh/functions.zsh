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

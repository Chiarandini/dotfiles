# ~/.config/zsh/aliases.zsh
#
# Shell aliases sourced by ~/.zshrc. Git aliases live in ~/.gitconfig (they
# travel across shells and integrate with git's tab-completion).
#
# Philosophy: every alias here earned its place by appearing in `atuin stats`
# often enough that typing the full form was measurable friction.

# ╔═════════════════════════════════════════════╗
# ║ Docker compose (27+ uses/day, no shortcut)  ║
# ╚═════════════════════════════════════════════╝
alias dc='docker compose'
alias dcu='docker compose up -d'
alias dcd='docker compose down'
alias dcl='docker compose logs -f --tail=200'
alias dce='docker compose exec'
alias dcr='docker compose restart'
alias dcps='docker compose ps'
alias dcb='docker compose build'

# ╔═══════════════════════════════════════════════════╗
# ║ eza — finally surfacing the already-installed ls  ║
# ╚═══════════════════════════════════════════════════╝
# Keep plain `ls` intact (muscle memory, scripts). These are additive.
alias l='eza -lh --git --icons'
alias la='eza -lha --git --icons'
alias lt='eza --tree --level=2 --icons'
alias lt3='eza --tree --level=3 --icons'

# ╔════════════════════════════════════════════════════╗
# ║ bat — cat with syntax highlighting, no paging      ║
# ╚════════════════════════════════════════════════════╝
# Not aliasing `cat` itself (scripts may rely on POSIX cat). Use `b` instead.
alias b='bat --paging=never'
alias bp='bat'  # b + pager if content is long

# ╔═════════════════════════════════════════════╗
# ║ mise tasks — two-letter entry point         ║
# ╚═════════════════════════════════════════════╝
alias mr='mise run'
alias mt='mise tasks'

# ╔════════════════════════════╗
# ║ Quality-of-life tweaks     ║
# ╚════════════════════════════╝
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'


# ╔════════════════════════════╗
# ║   Claude with no session   ║
# ╚════════════════════════════╝
alias claudex='claude --no-session-persistence'

# ╔═════════════════════════════════════════════════════════════╗
# ║ rem — Apple Reminders from the terminal (EventKit, two-way) ║
# ╚═════════════════════════════════════════════════════════════╝
# Human CLI over constellation's EventKit Reminders library — the same source of
# truth the secretary agent's MCP wraps, so terminal + agents + Raycast stay in
# sync (Reminders itself). Verbs:
#   rem                          overview: lists + open counts
#   rem ls <list>                items in a list (fuzzy match)
#   rem add <list> <text>        create  (--due 2026-06-23)
#   rem done <text>              complete by title  (--list to disambiguate)
#   rem --json ...               raw JSON for scripts/pipes
alias rem="$HOME/programming/constellation/mcp-servers/apple-reminders/rem"

# ╔════════════════════════════════════════════════════════════╗
# ║ kitty over ssh — propagate terminfo + kitty-isms to remote ║
# ╚════════════════════════════════════════════════════════════╝
# `kitten ssh` copies kitty's terminfo and enables image/hyperlink protocols
# over the SSH tunnel. Guard with command -v so the alias only activates when
# kitten is on PATH; otherwise plain /usr/bin/ssh is used. Scripts and git's
# internal ssh usage are unaffected — aliases don't expand in non-interactive
# shells.
if command -v kitten >/dev/null 2>&1; then
  alias ssh='kitten ssh'
fi

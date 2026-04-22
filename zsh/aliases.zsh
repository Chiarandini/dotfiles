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

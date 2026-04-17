# ╔══════════════════════════════════════════════════════════════════════╗
# ║ Launch Starship theme (for the extra information in the commandline) ║
# ╚══════════════════════════════════════════════════════════════════════╝
export STARSHIP_LOG="error"
eval "$(starship init zsh)"
eval $(thefuck --alias)


# ╔═════════╗
# ║ plugins ║
# ╚═════════╝
source /opt/homebrew/share/zsh-autocomplete/zsh-autocomplete.plugin.zsh
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# ╔════════════════╗
# ║ Longer history ║
# ╚════════════════╝
# Atuin is the primary history (see below). The raw zsh history file is kept
# large as atuin's backing source and for emergency fallback if atuin breaks.
# HIST_IGNORE_ALL_DUPS removed — atuin dedups with directory/context awareness.
setopt HIST_FIND_NO_DUPS

export HISTSIZE=100000
export SAVEHIST=100000

eval "$(fzf --zsh)"

# ╔══════════════════════════════════╗
# ║ Atuin: searchable shell history  ║
# ╚══════════════════════════════════╝
# Binds Ctrl-R to atuin's fuzzy TUI; Up arrow falls back to per-session history.
# Config at ~/.config/atuin/config.toml.
eval "$(atuin init zsh)"

alias lg=lazygit
alias W='| nvim -c "setlocal buftype=nofile bufhidden=wipe" -c "nnoremap <buffer> q :q!<CR>" -'
alias oil='nvim -c Oil'

# pretty print fzf
pf() {
  fzf --bind ctrl-y:preview-up,ctrl-e:preview-down \
      --bind ctrl-b:preview-page-up,ctrl-f:preview-page-down \
      --bind ctrl-u:preview-half-page-up,ctrl-d:preview-half-page-down \
      --bind ctrl-k:up,ctrl-j:down \
      --preview='(highlight -O ansi -l {} 2> /dev/null || cat {} || tree -C {}) 2> /dev/null' "$@"
}

# auto-pipe fzf to nvim to open. optional "feelin lucky" mode, and cmd saved in shell history
_f_opener() {
  (
    if [ -n "$1" ]; then
      pf --filter "$*" | head -n 1
    else
      pf
    fi
  ) | while read -r file; do
    local cmd="nvim \"$file\""
    print -rs -- "$cmd"
    eval "$cmd"
  done
}

alias n="_f_opener"
alias nvimf="_f_opener"

# ╔════════════════════════╗
# ║  Kitty remote control  ║
# ╚════════════════════════╝
alias jukit_kitty='kitty --listen-on=/tmp/kitty_"$(date +%s%N)" -o allow_remote_control=yes'

# ╔════════════════════════════════════════════════════════════════════╗
# ║ smarter cd — zoxide replaces `cd` entirely                         ║
# ║   `cd foo`  → fuzzy-matches frecent dirs (no more guessing typos)  ║
# ║   `cd`      → still $HOME (preserved)                              ║
# ║   `cd -`    → still previous dir (preserved)                       ║
# ║   `cdi`     → interactive fzf-style picker                         ║
# ╚════════════════════════════════════════════════════════════════════╝
eval "$(zoxide init zsh --cmd cd)"
alias z=cd
alias zi=cdi


# ╔═══════════════════════════════════════════╗
# ║ to launch different neovim configurations ║
# ╚═══════════════════════════════════════════╝
# `nvdn` = NoetherVim Dev — run the in-development personal distro.
# Plain `nvim` uses ~/.config/nvim (main daily driver).
alias nvdn="NVIM_APPNAME=noethervim nvim"

function nvims() {
  items=("default" "noethervim")
  config=$(printf "%s\n" "${items[@]}" | fzf --prompt=" Neovim Config  " --height=~50% --layout=reverse --border --exit-0)
  if [[ -z $config ]]; then
    echo "Nothing selected"
    return 0
  elif [[ $config == "default" ]]; then
    config=""
  fi
  NVIM_APPNAME=$config nvim $@
}

# ╔═════════════════════════════════╗
# ║ Make neovim default text editor ║
# ╚═════════════════════════════════╝
export EDITOR=nvim

# ╔═══════════════════════════════╗
# ║ command to paste to clipboard ║
# ╚═══════════════════════════════╝
copy_to_clipboard() {
  local input=$(cat)
  printf "\e]52;c;$(printf "%s" "$input" | base64 | tr -d '\n')\a"
}
alias pbcopy='copy_to_clipboard'

# ╔══════════════════════════════════════╗
# ║ copy a file (reference) to clipboard ║
# ╚══════════════════════════════════════╝
file-to-clipboard(){ osascript -e{'on run{a}','set the clipboard to posix file a',end} "$(greadlink -f -- "$1")";}

export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.local/share/bob/nvim-bin:$PATH"

# ╔══════════════════════════════════════════════════╗
# ║ Auto-fix yabai SA hash after brew upgrade yabai  ║
# ╚══════════════════════════════════════════════════╝
brew() {
  command brew "$@"
  local ret=$?
  if [[ $ret -eq 0 && ("$1" == "upgrade" || "$1" == "reinstall") ]]; then
    if [[ $# -eq 1 || "$*" == *yabai* ]]; then
      echo "\n==> Detected yabai may have been upgraded, fixing SA hash..."
      fix-yabai-sa
    fi
  fi
  return $ret
}

# ╔══════════════╗
# ║ mise (langs) ║
# ╚══════════════╝
eval "$(mise activate zsh)"

# ╔═══════════════════════════════════════════════════════════════════╗
# ║ direnv: per-directory environment activation on cd                ║
# ║ Must come AFTER `mise activate` so direnv inherits mise's PATH,   ║
# ║ letting `.envrc` use `use mise` to pull in the right runtimes.    ║
# ╚═══════════════════════════════════════════════════════════════════╝
eval "$(direnv hook zsh)"

# ╔══════════════════════════════════════════════════════════╗
# ║ Personal aliases (sourced from ~/.config/zsh/aliases.zsh) ║
# ╚══════════════════════════════════════════════════════════╝
[[ -f ~/.config/zsh/aliases.zsh ]] && source ~/.config/zsh/aliases.zsh

# ╔═════════════════════════════════════════════════════════╗
# ║ Work/machine-specific overrides (not in portable core)  ║
# ╚═════════════════════════════════════════════════════════╝
[[ -f ~/.config/zsh/work.zsh ]] && source ~/.config/zsh/work.zsh

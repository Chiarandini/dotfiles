#!/usr/bin/env bash
# Assert that this machine is actually set up, rather than assuming the
# installer's commands did what they looked like they did.
#
# This exists because the failures that cost the most here were all silent:
# TPM pointed at a path it could not read and found zero plugins for three
# years; tmux-resurrect corrupted a save file whenever a pane title was empty;
# Claude's notification channel defaulted to something that never rang. None
# of them printed an error. Every one is an assertion below.
#
# Run any time:  ~/.config/install-verify.sh
# Exit status is the number of failures, so CI or a wrapper can branch on it.
#
# THE RULE: when a new machine-level requirement is added, add an assertion
# here too. A setup step nobody verifies is how all of the above happened.

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/.config}"
fails=0
warns=0

ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; [ -n "$2" ] && printf '         -> %s\n' "$2"; fails=$((fails + 1)); }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; [ -n "$2" ] && printf '         -> %s\n' "$2"; warns=$((warns + 1)); }

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ── binaries ────────────────────────────────────────────────────────────────
section "Binaries"
for b in tmux fzf zoxide git; do
  if command -v "$b" >/dev/null 2>&1; then ok "$b ($(command -v "$b"))"
  else bad "$b missing" "brew bundle --file=$DOTFILES_DIR/Brewfile"; fi
done
if command -v python3 >/dev/null 2>&1; then ok "python3 ($(python3 --version 2>&1))"
else bad "python3 missing" "the tmux pickers parse kitty's JSON with it"; fi
command -v kitty >/dev/null 2>&1 && ok "kitty" || warn "kitty missing" "fine on a headless box"

# ── tmux config ─────────────────────────────────────────────────────────────
section "tmux configuration"
conf="$DOTFILES_DIR/tmux/tmux.conf"
if [ -f "$conf" ]; then ok "tmux.conf present"
else bad "tmux.conf missing at $conf"; fi

if tmux -f "$conf" -L verify-probe start-server \; kill-server 2>/dev/null; then
  ok "tmux.conf parses with no errors"
else
  bad "tmux.conf failed to parse" "run: tmux -f $conf -L probe start-server"
fi

for opt in "extended-keys on" "status-keys emacs"; do
  name=${opt%% *}; want=${opt##* }
  got=$(grep -oE "^set -[sg]* ?$name [a-z-]+" "$conf" | tail -1 | awk '{print $NF}')
  if [ "$got" = "$want" ]; then ok "$name = $want"
  else bad "$name is '${got:-unset}', expected '$want'" \
        "$name=always breaks snacks.nvim; off breaks Shift+Enter"; fi
done

grep -q "exit-empty off" "$conf" \
  && ok "exit-empty off (server survives a cold restore)" \
  || bad "exit-empty not off" "a cold 'tmux start-server' can exit before continuum restores"

# ── vendored plugins ────────────────────────────────────────────────────────
section "tmux plugins (vendored, see tmux/plugins/VENDORED.md)"
for p in tmux-resurrect tmux-continuum; do
  if [ -f "$DOTFILES_DIR/tmux/plugins/$p/$p.tmux" ] || [ -d "$DOTFILES_DIR/tmux/plugins/$p/scripts" ]; then
    ok "$p vendored"
  else
    bad "$p missing" "it should be committed in this repo, not cloned"
  fi
done

save="$DOTFILES_DIR/tmux/plugins/tmux-resurrect/scripts/save.sh"
if grep -q 'LOCAL PATCH: never emit an empty pane_title' "$save" 2>/dev/null; then
  ok "resurrect empty-pane-title patch applied"
else
  bad "resurrect patch MISSING" \
      "panes with no title restore in the wrong directory; apply tmux/resurrect-empty-pane-title.patch"
fi

# ── shell integration ───────────────────────────────────────────────────────
section "Shell"
for fn in tx nvs; do
  if zsh -ic "whence -w $fn" 2>/dev/null | grep -q function; then ok "$fn resolves"
  else bad "$fn not defined" "check zsh/functions.zsh is sourced from .zshrc"; fi
done
if zsh -ic 'echo $CLAUDE_CODE_TMUX_TRUECOLOR' 2>/dev/null | grep -q 1; then
  ok "CLAUDE_CODE_TMUX_TRUECOLOR set"
else
  warn "CLAUDE_CODE_TMUX_TRUECOLOR unset" "Claude's colours will be muted inside tmux"
fi

# ── Claude Code ─────────────────────────────────────────────────────────────
section "Claude Code"
cs="$HOME/.claude/settings.json"
if [ -L "$cs" ]; then ok "settings.json symlinked into dotfiles"
elif [ -f "$cs" ]; then warn "settings.json is a real file, not a symlink" "install.sh step 3 links it from $DOTFILES_DIR/claude/"
else bad "settings.json missing" "ln -sf $DOTFILES_DIR/claude/settings.json $cs"; fi

if [ -f "$cs" ]; then
  chan=$(python3 -c "import json;print(json.load(open('$cs')).get('preferredNotifChannel',''))" 2>/dev/null)
  if [ "$chan" = "terminal_bell" ]; then ok "preferredNotifChannel = terminal_bell"
  else bad "preferredNotifChannel is '${chan:-unset}'" \
        "the red 'Claude wants you' state will never fire; see tmux/README.md"; fi
fi

# ── state directories ───────────────────────────────────────────────────────
section "State"
for d in "$HOME/.local/state/tmux" "$HOME/.local/share/tmux/resurrect"; do
  [ -d "$d" ] && ok "$d" || warn "$d missing" "created on first use, not an error on a fresh box"
done

# ── summary ─────────────────────────────────────────────────────────────────
printf '\n'
if [ "$fails" -eq 0 ]; then
  printf '\033[32mAll assertions passed\033[0m'
  [ "$warns" -gt 0 ] && printf ' (%d warning(s))' "$warns"
  printf '\n\n'
else
  printf '\033[31m%d failure(s)\033[0m' "$fails"
  [ "$warns" -gt 0 ] && printf ', %d warning(s)' "$warns"
  printf '\n\n'
fi
exit "$fails"

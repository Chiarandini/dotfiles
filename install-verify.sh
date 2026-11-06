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
for b in tmux fzf zoxide git atuin direnv; do
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

gen="$DOTFILES_DIR/tmux/menu.generated.tmux"
if [ -f "$gen" ]; then
  if "$DOTFILES_DIR/tmux/bin/menu.sh" generate 2>/dev/null | diff -q - "$gen" >/dev/null 2>&1; then
    ok "cmd+k menu matches actions.tsv"
  else
    bad "cmd+k menu is stale" \
        "regenerate: $DOTFILES_DIR/tmux/bin/menu.sh generate > $gen"
  fi
else
  bad "menu.generated.tmux missing" "cmd+k will not be bound"
fi

# The cmd+shift+/ cheat sheet is built by reading kitty.conf's own map lines,
# so a binding added without a `#= group|label` is simply invisible on it.
# That is exactly how the retired hand-kept sheet went stale, so it is an
# assertion rather than a convention.
kc="$DOTFILES_DIR/kitty/kitty.conf"
if [ -f "$DOTFILES_DIR/tmux/bin/keys.sh" ] && [ -x "$DOTFILES_DIR/tmux/bin/keys.sh" ]; then
  unlabelled=$(awk '
    /ANNOTATED REGION/ { inreg = 1; next }
    !inreg { next }
    /^#= / { lbl = 1; next }
    /^map / { if (!lbl) print FNR": "$2; lbl = 0; next }
    /^[[:space:]]*$/ { next }
    { lbl = 0 }
  ' "$kc")
  if [ -z "$unlabelled" ]; then ok "every kitty map carries a cheat-sheet label"
  else bad "kitty map(s) missing a '#= group|label' line" \
        "invisible on cmd+shift+/: $(printf '%s' "$unlabelled" | tr '\n' ' ')"; fi
else
  bad "tmux/bin/keys.sh missing or not executable" "cmd+shift+/ will do nothing"
fi

# ── shell integration ───────────────────────────────────────────────────────
section "Shell"
# Every `zsh -ic` probe below closes stdin. Without it an interactive startup
# can block on stdin and never return, and because `grep -q` exits early only
# on a match, the failing path hung forever while the passing path looked fine.
# An assertion that only terminates when it passes is not an assertion; this
# one wedged install-verify.sh here for the whole of 2026-11-05.
for fn in tx nvs; do
  if zsh -ic "whence -w $fn" </dev/null 2>/dev/null | grep -q function; then ok "$fn resolves"
  else bad "$fn not defined" "check zsh/functions.zsh is sourced from .zshrc"; fi
done

# Sentinel-delimited and compared exactly. zsh's session-restore line lands on
# stdout ("Restored session: ... 13:22:30 ..."), so a bare `grep -q 1` can match
# a stray digit in the timestamp and pass for the wrong reason.
tc=$(gtimeout 8 zsh -ic 'echo "TC=[$CLAUDE_CODE_TMUX_TRUECOLOR]"' </dev/null 2>/dev/null \
       | sed -n 's/.*TC=\[\(.*\)\]/\1/p' | tail -1)
if [ "$tc" = "1" ]; then
  ok "CLAUDE_CODE_TMUX_TRUECOLOR set"
else
  warn "CLAUDE_CODE_TMUX_TRUECOLOR is '${tc:-unset}'" "Claude's colours will be muted inside tmux"
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

# ── scripts on PATH ─────────────────────────────────────────────────────────
section "Scripts"
for s in "$DOTFILES_DIR"/scripts/*; do
  [ -f "$s" ] && [ -x "$s" ] || continue
  name=$(basename "$s")
  if [ "$(readlink "$HOME/.local/bin/$name")" = "$s" ]; then ok "$name linked into ~/.local/bin"
  else bad "$name not linked into ~/.local/bin" "ln -sf $s ~/.local/bin/$name"; fi
done

# ── window management ───────────────────────────────────────────────────────
# These are launchd services whose absence nothing else reports. A missing skhd
# looks exactly like "yabai is broken", because every keybinding lives in
# skhdrc and not in yabai — a reboot with no skhd plist on disk cost an evening
# already. The watchdog is worse: yabai keeps tiling without it, right up until
# the IPC wedges and nothing recovers it.
section "Window management"

# Service labels are written by the binaries themselves and do change across
# upstreams (yabai v7 moved koekeishiya -> asmvik and renamed its label), so
# find the agent by the program it launches rather than asserting a name.
agent_for() {
  local p
  for p in "$HOME"/Library/LaunchAgents/*.plist; do
    [ -f "$p" ] || continue
    grep -qF "<string>$1</string>" "$p" && { basename "$p" .plist; return 0; }
  done
  return 1
}
loaded() { launchctl list | awk -v l="$1" '$3 == l { f = 1 } END { exit !f }'; }

for bin in /opt/homebrew/bin/yabai /opt/homebrew/bin/skhd "$HOME/.local/bin/yabai-watchdog"; do
  name=$(basename "$bin")
  if label=$(agent_for "$bin"); then
    if loaded "$label"; then ok "$name service loaded ($label)"
    else bad "$name agent on disk but not loaded" "launchctl bootstrap gui/\$UID ~/Library/LaunchAgents/$label.plist"; fi
  elif [ "$name" = "yabai-watchdog" ]; then
    bad "yabai-watchdog agent not installed" "install.sh step 11 materializes it from $DOTFILES_DIR/launchd/"
  else
    bad "no $name LaunchAgent installed" "$name --start-service"
  fi
done

# ── macOS defaults ──────────────────────────────────────────────────────────
# Nothing errors when these are unset; the machine just feels wrong. Backspace
# crawls, and macOS reorders spaces so every positional cmd+<n> in skhdrc hits
# whichever space happens to sit at that index. Both were re-applied from
# memory on each rebuild until macos-defaults.sh took ownership of them.
section "macOS defaults"

want_default() {   # domain  key  expected  label
  got=$(defaults read "$1" "$2" 2>/dev/null)
  if [ "$got" = "$3" ]; then ok "$4 ($2=$3)"
  else bad "$4: $2 is '${got:-unset}', expected '$3'" "run $DOTFILES_DIR/macos-defaults.sh"; fi
}

want_default NSGlobalDomain KeyRepeat                 1 "fast key repeat"
want_default NSGlobalDomain InitialKeyRepeat         12 "short repeat delay"
want_default NSGlobalDomain ApplePressAndHoldEnabled  0 "hold-to-repeat, not accent picker"
want_default com.apple.dock mru-spaces                0 "spaces do not auto-rearrange"

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

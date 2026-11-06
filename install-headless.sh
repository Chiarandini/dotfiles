#!/usr/bin/env bash
# install-headless.sh
#
# Bootstrap a headless / SSH-only macOS box (no display, no GUI apps).
# Sibling to install.sh, which targets a full desktop machine.
#
# Skipped vs install.sh:
#   - yabai / skhd services and their fix scripts
#   - All cask installs (GUI apps)
#   - LaunchAgents (those are laptop-side automation)
#   - LSP / language-server installs that need a desktop editor
#
# Usage on the headless box (after cloning this repo to ~/.config):
#     bash ~/.config/install-headless.sh
#
# Idempotent — safe to re-run.

set -euo pipefail

echo "==> Headless bootstrap starting..."
sudo -v

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── 1. Xcode Command Line Tools ──────────────────────────────────────────────
if ! xcode-select -p &> /dev/null; then
    echo "==> Installing Xcode Command Line Tools..."
    xcode-select --install
    read -p "Press Enter once Xcode CLI tools have finished installing..."
fi

# ─── 2. Homebrew ──────────────────────────────────────────────────────────────
if ! command -v brew &> /dev/null; then
    echo "==> Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv)"

# ─── 3. Home-dir dotfile symlinks (subset of install.sh step 3) ──────────────
echo "==> Linking home-dir dotfiles..."
ln -sf "$DOTFILES_DIR/.mise.toml"        ~/.mise.toml
ln -sf "$DOTFILES_DIR/.gitconfig"        ~/.gitconfig
ln -sf "$DOTFILES_DIR/.gitignore_global" ~/.gitignore_global
ln -sf "$DOTFILES_DIR/.zshrc"            ~/.zshrc
ln -sf "$DOTFILES_DIR/.zprofile"         ~/.zprofile

# Claude Code settings, identical to install.sh step 3. Omitting this is what
# left preferredNotifChannel unset on this box -- the third silent failure in
# BOOTSTRAP.md, reintroduced by the installer meant to avoid it.
mkdir -p ~/.claude
ln -sf "$DOTFILES_DIR/claude/settings.json" ~/.claude/settings.json

# Every executable in scripts/ goes on PATH -- verbatim from install.sh. This
# step was absent here, so tb, pdf, lib, dirmarks and airdrop were missing on
# any headless box: exactly the by-hand linking install.sh's comment warns
# about. Divergence between the two installers is what produced both bugs, so
# this is a copy, not a variant.
mkdir -p ~/.local/bin
for s in "$DOTFILES_DIR"/scripts/*; do
    [ -f "$s" ] && [ -x "$s" ] || continue
    ln -sf "$s" ~/.local/bin/"$(basename "$s")"
done

# ─── 4. ~/.zshenv: PATH for ~/.local/bin in EVERY shell context ──────────────
# Tailscale SSH and some non-interactive shells don't reliably source .zprofile.
# .zshenv runs for every shell invocation (login, non-login, interactive, not).
mkdir -p ~/.local/bin
if ! grep -q 'HOME/.local/bin' ~/.zshenv 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshenv
fi

# ─── 5. CLI packages ──────────────────────────────────────────────────────────
echo "==> Installing Brewfile.headless..."
brew bundle --file="$DOTFILES_DIR/Brewfile.headless"

# ─── 6. tmux plugins ──────────────────────────────────────────────────────────
# Nothing to install: they are vendored in this repo. This step used to clone
# TPM into a path the tmux config never read. See tmux/plugins/VENDORED.md.

# ─── 7. mise runtimes (pinned in .mise.toml) ──────────────────────────────────
if command -v mise &> /dev/null; then
    echo "==> Installing mise-pinned runtimes (failures are non-fatal)..."
    eval "$(mise activate bash)"
    mise install || echo "    (some runtimes failed to install; continuing)"
fi

# ─── 8. Persistent tmux launcher (m → main session) ──────────────────────────
# Normalizes TERM so tmux starts cleanly from kitty (xterm-kitty) or any other
# client whose terminfo isn't installed on this machine.
if [ ! -f ~/.local/bin/m ]; then
    echo "==> Installing 'm' tmux launcher..."
    cat > ~/.local/bin/m <<'EOF'
#!/bin/bash
exec env TERM=xterm-256color tmux new-session -A -s main
EOF
    chmod +x ~/.local/bin/m
fi

# ─── 9. macOS defaults ───────────────────────────────────────────────────────
# Key repeat and space ordering. No dotfile owns these and nothing errors when
# they are unset, so they were re-applied by hand on every rebuild until this
# step existed. See macos-defaults.sh.
"$DOTFILES_DIR/macos-defaults.sh"

echo
echo "==> Headless bootstrap complete."
echo
echo "Next steps:"
echo "  1. Open a fresh shell:        exec zsh"
echo "  2. Test the tmux launcher:    m"
echo "  3. Authenticate Claude Code:  claude  (then /login)"
echo "  4. If this box needs Tailscale SSH server:"
echo "       sudo brew services start tailscale"
echo "       sudo tailscale up --ssh"

# ─── Verify ───────────────────────────────────────────────────────────────────
# Assert the setup actually worked. Running commands is not evidence they did
# what they looked like they did; see BOOTSTRAP.md.
"$DOTFILES_DIR/install-verify.sh" || {
    echo
    echo "Bootstrap finished but verification found problems (see above)."
    echo "Re-run any time with: $DOTFILES_DIR/install-verify.sh"
}

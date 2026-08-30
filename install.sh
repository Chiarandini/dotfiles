#!/usr/bin/env bash

echo "Starting Mac Bootstrap process..."

# --- ARGUMENT PARSING ---
INSTALL_GAMES=false
if [[ "$1" == "--full" ]]; then
    INSTALL_GAMES=true
    echo "Full installation triggered (Games included)."
fi
# ------------------------

# Ask for administrator password upfront
sudo -v

# Get the exact directory this script is running from
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Install Xcode Command Line Tools
if ! xcode-select -p &> /dev/null; then
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    read -p "Press enter once Xcode CLI tools are installed..."
fi

# 2. Install Homebrew (Skipped if already migrated)
if test ! $(which brew); then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Make sure brew is available in this script's session
eval "$(/opt/homebrew/bin/brew shellenv)"

# 3. Set up Dotfiles FIRST (So configs are present for the rest of the script)
echo "Setting up dotfiles..."
ln -sf "$DOTFILES_DIR/.mise.toml" ~/.mise.toml
ln -sf "$DOTFILES_DIR/.gitconfig" ~/.gitconfig
ln -sf "$DOTFILES_DIR/.gitignore_global" ~/.gitignore_global
ln -sf "$DOTFILES_DIR/.zshrc" ~/.zshrc
ln -sf "$DOTFILES_DIR/.zprofile" ~/.zprofile
ln -sf "$DOTFILES_DIR/.ideavimrc" ~/.ideavimrc
mkdir -p ~/.local/bin
ln -sf "$DOTFILES_DIR/scripts/fix-yabai-sa" ~/.local/bin/fix-yabai-sa
ln -sf "$DOTFILES_DIR/scripts/fix-yabai" ~/.local/bin/fix-yabai
ln -sf "$DOTFILES_DIR/scripts/yabai-watchdog" ~/.local/bin/yabai-watchdog
ln -sf "$DOTFILES_DIR/scripts/airdrop" ~/.local/bin/airdrop

# 4. Install core packages from main Brewfile
echo "Installing core dependencies from Brewfile..."
# NOTE: Added --cleanup to remove old migrated packages not in your new Brewfile!
brew bundle --cleanup --force --file="$DOTFILES_DIR/Brewfile"

# --- OPTIONAL INSTALLATIONS ---
if [ "$INSTALL_GAMES" = true ]; then
    echo "Installing optional games and entertainment..."
    if [ -f "$DOTFILES_DIR/Brewfile.games" ]; then
        brew bundle --file="$DOTFILES_DIR/Brewfile.games"
    else
        echo "⚠️ Brewfile.games not found, skipping."
    fi
fi

# 5. Set up mise and install programming languages
echo "Setting up mise environment..."
# Assuming mise was installed via Brewfile in step 4
eval "$(mise activate bash)"
echo "Installing global language versions via mise..."
mise install

# 6. GLOBAL PACKAGES (Moved to AFTER mise install)
echo "Installing global Node packages..."
# Ensure we are using the mise shim
mise exec node -- npm install -g @anthropic-ai/claude-code react-devtools typescript
mise exec node -- corepack enable

echo "Installing global Python CLI tools via pipx..."
# Assuming pipx was installed via brew in step 4
pipx install yt-dlp

# 7. Install Neovim via bob
echo "Installing Neovim via bob..."
# Assuming bob was installed via brew in step 4
bob install stable
bob use stable

# 8. tmux plugins: nothing to do, they are vendored in this repo.
# This step used to clone TPM into ~/.tmux/plugins/tpm, a path the tmux config
# never read, so it found zero plugins and tmux-resurrect sat inert for three
# years. See tmux/plugins/VENDORED.md.

# 9. Start Background Services
echo "Starting background services..."
yabai --start-service
skhd --start-service

# 10. Configure yabai scripting addition (sudoers hash)
echo "Configuring yabai scripting addition..."
fix-yabai-sa

# 11. Install LaunchAgents from $DOTFILES_DIR/launchd
# Plists use __HOME__ as a placeholder so they're portable across machines.
# We materialize a real copy into ~/Library/LaunchAgents with $HOME substituted,
# then bootstrap each one into the user's GUI launchd domain.
echo "Installing LaunchAgents..."
mkdir -p ~/Library/LaunchAgents
if [ -d "$DOTFILES_DIR/launchd" ]; then
    for src in "$DOTFILES_DIR/launchd"/*.plist; do
        [ -f "$src" ] || continue
        name="$(basename "$src")"
        dst="$HOME/Library/LaunchAgents/$name"
        label="${name%.plist}"
        sed "s|__HOME__|$HOME|g" "$src" > "$dst"
        # Reload: bootout if already loaded (ignore failure on fresh install),
        # then bootstrap. Either step alone isn't enough on subsequent runs.
        launchctl bootout "gui/$UID/$label" 2>/dev/null || true
        launchctl bootstrap "gui/$UID" "$dst"
        echo "  loaded: $label"
    done
fi

echo "Bootstrap complete!"

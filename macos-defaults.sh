#!/usr/bin/env bash
# macos-defaults.sh
#
# macOS `defaults` this setup depends on that live in no dotfile.
#
# These are exactly the class of setting BOOTSTRAP.md is about: nothing errors
# when they are missing. A rebuilt machine just feels subtly wrong -- backspace
# crawls, and cmd+<n> lands on the wrong space -- with no failure to grep for.
# Before this file existed they were re-discovered by hand on every machine.
#
# Called by install.sh and install-headless.sh. Assertions live in
# install-verify.sh, per the rule in BOOTSTRAP.md.
#
# Idempotent -- safe to re-run.

set -euo pipefail

echo "==> Applying macOS defaults..."

# ─── Key repeat ──────────────────────────────────────────────────────────────
# Both values go below what System Settings exposes: the UI's fastest repeat is
# KeyRepeat=2 and its shortest delay is InitialKeyRepeat=15.
#   KeyRepeat=1         -> 15ms between repeats
#   InitialKeyRepeat=12 -> 180ms before repeating starts
# Holding backspace to clear a line is what this is for.
defaults write NSGlobalDomain KeyRepeat -int 1
defaults write NSGlobalDomain InitialKeyRepeat -int 12

# false => holding a key repeats it, instead of opening the accent picker.
defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

# ─── Spaces ──────────────────────────────────────────────────────────────────
# Must be false, or macOS reorders spaces by most-recent-use and every
# positional binding in skhdrc (cmd - 1 .. cmd - 9 -> yabai space --focus N)
# silently targets the wrong space.
#
# Only restart the Dock when the value actually changed: an unconditional
# `killall Dock` on every install run is visible churn for no reason.
if [ "$(defaults read com.apple.dock mru-spaces 2>/dev/null)" != "0" ]; then
    defaults write com.apple.dock mru-spaces -bool false
    killall Dock 2>/dev/null || true
    echo "    mru-spaces disabled (Dock restarted)"
fi

# ─── Brave: ctrl-based tab shortcuts ─────────────────────────────────────────
# ctrl+t / ctrl+w / ctrl+shift+d -> new / close / duplicate tab. These are
# macOS App Shortcuts (System Settings > Keyboard > Keyboard Shortcuts > App
# Shortcuts): each key is a menu-item title and must match Brave's menu text
# exactly, so a Brave update that renames an item silently drops its binding.
# An App Shortcut replaces the item's own shortcut instead of adding a second
# one, so cmd+t / cmd+w no longer reach these items.
# -dict-add merges, so App Shortcuts added by hand in System Settings survive.
defaults write com.brave.Browser NSUserKeyEquivalents -dict-add \
    "New Tab"       '^t' \
    "Close Tab"     '^w' \
    "Duplicate Tab" '^$d'

echo "==> macOS defaults applied."
echo "    Note: applications read the key-repeat values and App Shortcuts at"
echo "    launch, so they reach a running app only when it restarts (Brave"
echo "    needs a full cmd+q). Log out and back in to apply them everywhere."

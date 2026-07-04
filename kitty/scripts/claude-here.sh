#!/bin/sh
# Pick a directory (standard dirs + zoxide frecency), spawn a new tab with claude.
# Launched via: kitty @ launch --type=overlay sh ~/.config/kitty/scripts/claude-here.sh
PATH=/opt/homebrew/bin:$PATH

dir=$( {
  printf '%s\n' \
    "$HOME/.config" \
    "$HOME/programming" \
    "$HOME/Documents" \
    "$HOME"
  zoxide query --list 2>/dev/null
} | awk '!seen[$0]++' | fzf \
    --prompt='claude in > ' \
    --reverse \
    --preview 'ls -1 {} 2>/dev/null | head -20')

[ -z "$dir" ] && exit 0
title=$(basename "$dir")

new_id=$(kitty @ launch --type=tab --cwd="$dir" --tab-title="$title")
[ -z "$new_id" ] && exit 1
printf 'claude\n' | kitty @ send-text --match "id:$new_id" --stdin

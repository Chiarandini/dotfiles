#!/bin/sh
# Toggle the parked mark on the current window. Parked windows draw grey with
# a leading marker, matching taborg's "tabled" state.
cur=$(tmux show-options -wqv @parked)
if [ "$cur" = "1" ]; then
  tmux set-option -w -u @parked
else
  tmux set-option -w @parked 1
fi

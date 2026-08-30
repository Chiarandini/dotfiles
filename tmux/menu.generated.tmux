# GENERATED from actions.tsv by bin/menu.sh generate. Do not edit.
# Regenerate: ~/.config/tmux/bin/menu.sh generate
bind -T root 'C-\' display-menu -T "#[align=centre fg=#F08C3A,bold] cmd+k " -x C -y C \
  "project        fzf roots + zoxide" "p" "display-popup -E -w 80% -h 70% '~/.config/tmux/bin/sessionizer.sh'" \
  "window         this project" "w" "display-popup -E -w 80% -h 70% '~/.config/tmux/bin/find-window.sh --project'" \
  "window         all projects" "W" "display-popup -E -w 80% -h 70% '~/.config/tmux/bin/find-window.sh'" \
  "find action    fuzzy search this menu" "/" "display-popup -E -w 70% -h 60% '~/.config/tmux/bin/menu.sh find' ; run-shell '~/.config/tmux/bin/menu.sh run-picked'" \
  "" \
  "claude         new window" "c" "run-shell '~/.config/tmux/bin/newwin.sh claude'" \
  "editor         new window" "e" "run-shell '~/.config/tmux/bin/newwin.sh nvim'" \
  "terminal       new window" "t" "run-shell '~/.config/tmux/bin/newwin.sh shell'" \
  "" \
  "servers        start declared" "s" "display-popup -E -w 80% -h 70% '~/.config/tmux/bin/serve.sh start'" \
  "logs           follow one" "l" "display-popup -E -w 90% -h 80% -T ' log: F to follow, q to quit ' '~/.config/tmux/bin/serve.sh logs'" \
  "save state now" "S" "run-shell '~/.config/tmux/plugins/tmux-resurrect/scripts/save.sh'" \
  "event log      saves + restores" "L" "display-popup -E -w 90% -h 80% '~/.config/tmux/bin/log-event.sh view'" \
  "" \
  "rename window" "r" "command-prompt -I '#W' 'rename-window -- \"%%\"'" \
  "rename project (session)" "P" "command-prompt -I '#S' 'rename-session -- \"%%\"'" \
  "move window    left" "<" "swap-window -d -t -1" \
  "move window    right" ">" "swap-window -d -t +1" \
  "park toggle" "y" "run-shell '~/.config/tmux/bin/park.sh'" \
  "copy mode" "[" "copy-mode" \
  "detach" "d" "detach-client" \
  "" \
  "key probe      what bytes does a key send" "k" "display-popup -E -w 70% -h 60% '~/.config/tmux/bin/keytest.sh'" \
  "guide          README" "?" "display-popup -E -w 85% -h 85% 'less ~/.config/tmux/README.md'" \
  "reload config" "R" "source-file ~/.config/tmux/tmux.conf ; display-message 'tmux.conf reloaded'"

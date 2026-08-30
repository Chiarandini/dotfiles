#!/bin/sh
# Fuzzy-switch across every kitty tab, tmux and non-tmux alike.
#
# tmux's own pickers only know about tmux. Once some tabs hold projects and
# others hold standalone work, neither layer can see the whole picture; this
# is the one that can. Bound to cmd+shift+p in kitty.conf.
. "$HOME/.config/tmux/bin/lib.sh"

sock="${KITTY_LISTEN_ON:-}"
[ -n "$sock" ] || sock="unix:$(ls -t /tmp/mykitty-* 2>/dev/null | head -1)"

rows=$(kitty @ --to "$sock" ls 2>/dev/null | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for osw in data:
    for tab in osw.get("tabs", []):
        procs = []
        for w in tab.get("windows", []):
            for p in w.get("foreground_processes", []):
                procs.append(" ".join(p.get("cmdline", [])))
        joined = " ".join(procs)
        if "tmux" in joined and "attach" in joined:
            kind = "tmux"
        elif "claude" in joined:
            kind = "claude"
        elif "nvim" in joined:
            kind = "nvim"
        else:
            kind = "shell"
        here = "*" if tab.get("is_focused") else " "
        title = (tab.get("title") or "").strip() or "(untitled)"
        print("%s\t%s\t%s\t%s" % (tab.get("id"), here, kind, title))
')

[ -z "$rows" ] && { printf 'No kitty tabs found.\n\n[enter to close]'; read -r _; exit 0; }

picked=$(printf '%s\n' "$rows" | fzf \
  --delimiter="$(printf '\t')" --with-nth=2,3,4 \
  --prompt='kitty tab > ' --reverse --border \
  --header='  kind    title')

[ -z "$picked" ] && exit 0
log_picker "kitty-tab"

id=$(printf '%s' "$picked" | cut -f1)
kitty @ --to "$sock" focus-tab --match "id:$id" >/dev/null 2>&1

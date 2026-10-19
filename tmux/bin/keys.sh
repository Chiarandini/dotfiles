#!/bin/sh
# The one cheat sheet: cmd+shift+/ from ANY kitty tab.
#
# It is a kitty binding rather than a cmd+k action for the same reason
# promote.sh is: cmd+k is the tmux prefix, so a tab with no tmux in it cannot
# receive one -- and a tab with no tmux in it is exactly where you are least
# able to look a key up. cmd+k ? (the README) stays as the long form.
#
# NOTHING HERE IS WRITTEN BY HAND. The two layers come from the two files that
# already define them, so this cannot drift the way its retired ancestor
# (kitty/taborg/keys.sh) did -- that one still advertised taborg's switcher on
# cmd+shift+p a month after tmux took the key over:
#
#   tmux layer   <- actions.tsv, the same file the cmd+k menu is built from
#   kitty layer  <- the `#= group|label` annotations in kitty.conf, read from
#                   the config that IS the binding, not a copy of it
#
# install-verify.sh asserts every map in kitty.conf's annotated region carries
# a label, so adding a binding and forgetting the cheat sheet is a failure
# rather than a silent omission.
. "$HOME/.config/tmux/bin/lib.sh"

# cmd+k sends 0x1c, which is the terminal's QUIT character. Inside tmux that
# is harmless -- tmux reads the byte itself and matches its `bind -T root
# 'C-\'`, so it never reaches the line discipline. In a plain kitty overlay
# there is no tmux, so the tty generates SIGQUIT and sends it to the whole
# foreground process group. less handles it, but this shell does not, so the
# pipeline below died and the overlay vanished the moment you pressed the one
# key you are most likely to press while reading a list of keys.
#
# An ignored disposition survives exec and is inherited, so this one line
# covers the shell and less both. cmd+k now does nothing here, which is the
# correct answer for a key whose meaning is "open the tmux menu" in a window
# that has no tmux in it.
trap '' QUIT

KITTY_CONF="$HOME/.config/kitty/kitty.conf"
ACTIONS="$CONF_DIR/actions.tsv"
TAB=$(printf '\t')

O='\033[38;2;240;140;58m'   # the cmd+k orange, so the key column matches the menu
B='\033[1m'
D='\033[2m'
R='\033[0m'

# Pull `#= group|label` + the map line that follows it. Emitting the key from
# the map itself is the point: the label can go stale, the key cannot.
#
# kitty spells the punctuation keys out (comma, period, slash), which is what
# its parser wants but not what is printed on the key you are being told to
# press. Rendering `cmd+shift+slash` on a sheet whose whole job is to tell you
# which key to hit would be a small, constant papercut, so they are mapped
# back to their glyphs here.
kitty_keys() {
  awk -v want="$1" '
    function pretty(k,   n, i, p, out) {
      n = split(k, p, "+"); out = ""
      for (i = 1; i <= n; i++) {
        if      (p[i] == "comma")  p[i] = ","
        else if (p[i] == "period") p[i] = "."
        else if (p[i] == "slash")  p[i] = "/"
        else if (p[i] == "minus")  p[i] = "-"
        else if (p[i] == "equal")  p[i] = "="
        out = out (i > 1 ? "+" : "") p[i]
      }
      return out
    }
    /^#= / { split(substr($0, 4), a, "|"); g = a[1]; l = a[2]; next }
    /^map / { if (g == want) printf "%s\t%s\n", pretty($2), l; g = ""; next }
    { g = "" }
  ' "$KITTY_CONF"
}

row() { printf "    ${O}%-14s${R} %s\n" "$1" "$2"; }

{
printf '\n'
printf "  ${B}KEYS${R}${D}                                      cmd+shift+/ shows this${R}\n"

printf "\n\n  ${B}ANY KITTY TAB${R}${D}   work with or without tmux in the tab${R}\n\n"
kitty_keys tab | while IFS="$TAB" read -r k l; do row "$k" "$l"; done

printf "\n\n  ${B}INSIDE TMUX${R}${D}   cmd+k, then:${R}\n\n"
# Separators render as nothing rather than a blank line; the sheet is long
# enough that the grouping is not worth four rows of height.
read_tsv "$ACTIONS" | while IFS= read -r line; do
  [ "$line" = "-" ] && continue
  k=$(printf '%s' "$line" | cut -f1)
  l=$(printf '%s' "$line" | cut -f2)
  [ -n "$k" ] && row "$k" "$l"
done

printf "\n\n  ${B}MOTIONS${R}${D}   no prefix. unshifted = tmux window, shifted = kitty tab${R}\n\n"
kitty_keys motion | while IFS="$TAB" read -r k l; do row "$k" "$l"; done

# The only hand-written block. The glyph vocabulary is one line per state and
# has not changed since it was set; the source is TMUX_GLYPHS in
# kitty/taborg/tabbar.py, which is code rather than a registry and would need
# a Python parser to read reliably. Not worth it for six lines.
printf "\n\n  ${B}GLYPHS${R}${D}   same vocabulary in the kitty tab bar and the tmux status line${R}\n\n"
printf "    \033[38;2;240;140;58m✳\033[0m claude ready     \033[33m⠿\033[0m claude working   \033[31m!\033[0m claude wants you\n"
printf "    \033[32m✎\033[0m nvim             \033[34m›\033[0m shell / other    \033[2m▸\033[0m parked\n"
printf "    \033[2m▏\033[0m left rail on a kitty tab = there is tmux in it\n"

printf "\n${D}  q to close. cmd+k ? is the long version (README).${R}\n\n"
} | less -R

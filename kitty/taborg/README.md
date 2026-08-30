# taborg -- kitty tab organization

Makes one kitty window of many tabs legible at a glance, without moving tabs
around. Current mode: **single window + a colour/glyph tab bar**. (The
window-splitting auto-grouping is built but **off** -- see "Auto-grouping",
below.)

- **Live status glyph + colour** per tab, read from the window's live title so
  it survives a manual rename:
  - orange = Claude idle/ready (`✳`) · yellow = Claude thinking (live spinner)
  - red = Claude wants you (`!`, on bell) · green = nvim (`✎`) · grey = parked
- **Title watcher** repaints the bar on title changes, so even renamed tabs
  show their live thinking/ready state.
- **Keyboard tab moves** (`cmd+shift+,` / `.`) for precise manual reordering --
  no accidental drag-detach into a new window.

## Files

| File | Role |
|------|------|
| `../tab_bar.py` | shim kitty requires at the config root; loads `tabbar.py` fresh each reload |
| `tabbar.py` | custom tab bar drawing (glyph + per-type colour) |
| `watch.py` | title watcher: repaints the bar on title change (redraw-only; no moves) |
| `switcher.sh` | cross-window fuzzy tab finder (shows kind + state) |
| `keys.sh` | the `cmd+shift+/` keybinding cheat sheet |
| `tabctl.sh` | `tabled` mark (live); `stash`/`reconcile` are dormant grouping actions |
| `route.sh` | dormant: the window-grouping router (only runs if you re-enable auto-grouping) |
| `lib.sh` | shared `SOCK` / `K()` / `log()` helpers |
| `taborg.log` | append-only debug log (self-trims at 2000 lines) |

kitty.conf coupling (one delimited block): `tab_bar_style custom`, the dark bar
colours, `watcher`, the bell options, and the `cmd+shift+*` keymaps.

## Keys (all `cmd+shift+*` -- skhd owns `cmd+ctrl+*` and `cmd+<digit>`)

`p` switch tab · `i` rename · `o` new claude in a folder · `,`/`.` move tab
left/right · `y` toggle parked mark · `f5` refresh (reload config + code) ·
`/` cheat sheet.

## Auto-grouping (off by default)

kitty can only auto-group by putting each type in its own **OS window** (it has
no "move tab to position N", only a focus-stealing in-window bubble). That
splitting was disliked, so it's disabled: `watch.py` no longer routes, and the
`stash`/`reconcile` actions are unbound. To opt back in, rebind
`tabctl.sh reconcile`/`stash` and have `watch.py` call `route.sh` on
`on_cmd_startstop` again.

## Debugging

`tail -f ~/.config/kitty/taborg/taborg.log` -- timestamped, `[tag]`-prefixed.
`tabbar.py` logs its version on each load, so you can confirm the live code.

Re-apply after edits: `cmd+shift+f5` (or `kitty @ load-config`). The shim loads
`tabbar.py` fresh each time, so code edits take effect; the watcher attaches to
windows created afterwards.

**Bump `_VERSION` whenever you edit `tabbar.py`.** The log line it writes is
the only way to tell which code is actually live, and it is useless if the
string never changes: a stale build and a fresh one both log `v7`, so the log
looks like proof while proving nothing.

To see what the bar actually decides for a tab, append a line to `taborg.log`
from inside `_glyph_and_colour` with `head`, `_exe(w)` and the branch taken,
reload, then remove it. Note that a probe placed after the tmux branch never
sees tmux tabs, since those return early.

## Resilience

- Built only on kitty's documented custom-tab-bar API, watchers, and remote
  control -- the stable public surface, not internals.
- All state lives in `~/.config/kitty/`, independent of the kitty app bundle:
  reinstalling/upgrading kitty (incl. the Apple-silicon build) keeps it intact.
- Degrades safely: a draw error in `tabbar.py` falls back to kitty's default
  bar; the watcher's failures are swallowed; no script can lose a tab.

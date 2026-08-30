# Custom kitty tab bar: a live status glyph + a per-type colour for each tab.
#
# State (glyph) is read from each tab's active window *live title* -- Claude
# encodes its run-state there (braille spinner = working, U+2733 = ready), and
# this survives a manual tab rename (which otherwise hides it). Type (colour)
# comes from the WKIND user-var set by the routing engine (watch.py/route.sh),
# with a title/exe fallback so a tab is coloured correctly before it is tagged.
#
# Loaded via the thin shim at <config-dir>/tab_bar.py (kitty requires the
# custom tab bar to live there). See README.md.
from kitty.tab_bar import draw_tab_with_separator
from kitty.boss import get_boss

# Version sentinel: logged on every (re)import so we can confirm the live code.
_VERSION = 'v7-fresh-load'
try:
    import os as _os
    import time as _time
    with open(_os.path.expanduser('~/.config/kitty/taborg/taborg.log'), 'a') as _f:
        _f.write('%s [tabbar] module loaded (%s)\n' % (_time.strftime('%H:%M:%S'), _VERSION))
except Exception:
    pass

# Palette chosen by the user; raw 0xRRGGBB (no as_rgb), tuned for a dark bar.
C_WORK = 0xF2D44E    # yellow - claude thinking / working
C_READY = 0xF08C3A   # orange - claude idle / ready
C_ATTN = 0xF24E4E    # red    - claude needs you (bell)
C_EDIT = 0x4FC04F    # green  - nvim (active work)
C_SHELL = 0x79C0FF   # blue   - a tmux session with nothing demanding
C_TABLED = 0x8B949E  # grey   - tabled / parked
C_MISC = None        # shell / other -> leave kitty's default (readable) colour

# A tmux tab reports its child exe as "tmux", so none of the exe/user-var
# rules below can see inside it. Instead tmux computes the session's most
# urgent state itself and puts a leading glyph in the title it sets
# (set-titles-string in ~/.config/tmux/tmux.conf). This maps that vocabulary
# straight to a colour, so the state is derived once, in tmux, and only
# rendered here.
TMUX_GLYPHS = {
    '!': C_ATTN,     # some window wants you
    '⠿': C_WORK,     # some claude is working
    '✳': C_READY,    # some claude is ready
    '✎': C_EDIT,     # nvim, nothing louder
    '›': C_SHELL,    # a tmux session, nothing demanding
}


def _is_braille(ch):
    return bool(ch) and 0x2800 <= ord(ch) <= 0x28FF


# Claude marks "working" in the terminal title with a spinner glyph, and it
# does not use one family. Braille (U+2800-28FF) was what it used when this
# file was written; sampled live in 2026-08 it uses the half-circle family
# instead (U+25D0-25D3, e.g. U+25D1). Match both, and render whichever frame
# is live rather than normalising it, so the tab animates for free and a
# non-tmux Claude is instantly distinguishable from a tmux one, which shows
# tmux's own static "⠿".
def _is_spinner(ch):
    if not ch:
        return False
    return _is_braille(ch) or 0x25D0 <= ord(ch) <= 0x25D3


def _active_window(tab):
    try:
        t = get_boss().tab_for_id(tab.tab_id)
        return t.active_window if t is not None else None
    except Exception:
        return None


def _exe(w):
    try:
        return (w.get_exe_of_child() or '').rsplit('/', 1)[-1]
    except Exception:
        return ''


def _glyph_and_colour(tab):
    w = _active_window(tab)
    title = (getattr(w, 'title', '') or '') if w else ''
    uv = (getattr(w, 'user_vars', None) or {}) if w else {}
    wkind = uv.get('WKIND', '')

    if uv.get('CAT', '') == 'tabled' or wkind == 'stash':
        return '▸', C_TABLED                       # parked

    head = title.lstrip()[:1]

    # Which layer is this tab? A tmux tab's child exe is literally "tmux", so
    # that is the reliable discriminator; without it a bare "✳" is ambiguous
    # between "tmux says a Claude is ready" and "a Claude here is ready".
    if _exe(w).startswith('tmux'):
        # tmux already computed the session's most urgent state and put it in
        # the title. A live bell still wins so a background window can shout.
        if tab.needs_attention:
            return '!', C_ATTN
        if head in TMUX_GLYPHS:
            return head, TMUX_GLYPHS[head]
        return '›', C_SHELL

    is_claude = wkind == 'claude' or _is_spinner(head) or head == '✳'
    if is_claude:
        # Working wins over a (possibly stale) bell: an actively spinning tab
        # is not waiting on you.
        if _is_spinner(head):
            return head, C_WORK
        if tab.needs_attention:
            return '!', C_ATTN
        return '✳', C_READY                         # ready

    if wkind == 'edit' or _exe(w).startswith('nvim'):
        return '✎', C_EDIT

    return '', C_MISC


def _clean_title(title):
    t = (title or '').lstrip()
    if t[:1] in TMUX_GLYPHS or _is_spinner(t[:1]):
        t = t[1:].lstrip()
    return t


def draw_tab(draw_data, screen, tab, before, max_tab_length, index, is_last, extra_data):
    try:
        glyph, colour = _glyph_and_colour(tab)
        title = _clean_title(tab.title)
        tab = tab._replace(title=(glyph + ' ' + title) if glyph else title)
        if colour is not None:
            # Raw 0xRRGGBB (NOT as_rgb -- that byte-shifts the colour). kitty
            # only honours the per-tab colour on inactive tabs; the active tab
            # keeps its readable default styling.
            tab = tab._replace(inactive_fg=colour)
    except Exception:
        pass
    return draw_tab_with_separator(
        draw_data, screen, tab, before, max_tab_length, index, is_last, extra_data)

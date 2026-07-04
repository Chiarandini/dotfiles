# Global kitty watcher: repaint the tab bar whenever any window's title changes,
# so the live status glyph/colour updates even on tabs you have RENAMED. kitty
# only repaints the bar on its own when the *visible* tab title changes, and a
# manual rename pins that -- so a renamed Claude tab would otherwise never show
# its thinking/ready state. This watcher just nudges a redraw; it does NOT move,
# group, or route tabs.
#
# Registered via `watcher ~/.config/kitty/taborg/watch.py` in kitty.conf. It
# attaches to windows created after the config loads; pre-existing tabs keep
# their current behaviour until they are next (re)created.


def on_title_change(boss, window, data):
    try:
        for tab in boss.all_tabs:
            for w in tab:
                if w is window:
                    tab.mark_tab_bar_dirty()
                    return
    except Exception:
        pass

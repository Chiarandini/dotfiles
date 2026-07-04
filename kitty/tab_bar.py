# kitty requires the custom tab bar to live at <config-dir>/tab_bar.py.
# The real implementation -- and the rest of the tab-organization system --
# lives in taborg/. See taborg/README.md.
#
# We load taborg/tabbar.py FRESH from source on every kitty config reload
# (unique module name, no sys.modules caching, no .pyc reuse). importlib.reload
# proved unreliable inside kitty -- it kept serving a stale version -- so we
# build the module from its file spec each time this shim runs.
import os
import importlib.util

_impl = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'taborg', 'tabbar.py')
_spec = importlib.util.spec_from_file_location('taborg_tabbar_live', _impl)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
draw_tab = _mod.draw_tab  # noqa: F401

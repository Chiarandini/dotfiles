-- Personal highlight overrides for NoetherVim.
-- Runs after the colorscheme; re-applied on theme switches by the distro.

-- Gruvbox uses the same green for String and Function, making Python
-- builtins like `print` blend into string literals. Recolor builtins
-- to gruvbox orange. Linking @lsp.type.function.python to the same
-- group defers the LSP semantic token (priority 125) to our color.
require("noethervim.util.colorscheme").tweak({
  ["@function.builtin"]         = { fg = "#fe8019" },
  ["@lsp.type.function.python"] = { link = "@function.builtin" },
})

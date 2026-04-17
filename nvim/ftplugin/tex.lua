-- User Zero personal LaTeX ftplugin
-- These keymaps are personal and not part of the NoetherVim distribution.

local opts = function(desc) return { silent = true, buffer = true, desc = desc } end

-- Edit the sibling .bib file
vim.keymap.set("n", "<leader>eb", ":vs ../*.bib<cr>", opts("edit bibliography"))

-- Inkscape figure creation (castel.dev workflow)
vim.keymap.set("i", "<c-s-f>", function()
  vim.cmd([[silent exec '.!inkscape-figures create "'.getline('.').'" "' . './figures/"']])
  vim.cmd("w")
end, opts("create inkscape figure"))

vim.keymap.set("n", "<c-s-f>", function()
  vim.cmd([[silent exec '!inkscape-figures edit "' . './figures/" > /dev/null 2>&1 &']])
  vim.cmd("redraw!")
end, opts("edit inkscape figure"))

-- Abolish substitutions (personal shorthand)
vim.cmd("Abolish -buffer bc because")

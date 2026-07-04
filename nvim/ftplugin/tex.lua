-- User Zero personal LaTeX ftplugin
-- These keymaps are personal and not part of the NoetherVim distribution.

vim.o.textwidth = 100

local opts = function(desc) return { silent = true, buffer = true, desc = desc } end

-- Edit the sibling .bib file
vim.keymap.set("n", "<leader>eb", ":vs ../*.bib<cr>", opts("edit bibliography"))

-- Inkscape figure creation (castel.dev workflow)
vim.keymap.set("i", "<c-s-f>", function()
  vim.cmd([[silent exec '.!inkscape-figures create "'.getline('.').'" "' . './figures/"']])
  vim.cmd("w")
end, opts("create inkscape figure"))

vim.keymap.set(
  'n',
  '<space>eb',
  '<cmd>vs /Users/nathanaelchwojko-srawkey/Documents/textbooks/.eyntka/shared.bib<cr>',
  opts('edit shard bib')
)

vim.keymap.set("n", "<c-s-f>", function()
  vim.cmd([[silent exec '!inkscape-figures edit "' . './figures/" > /dev/null 2>&1 &']])
  vim.cmd("redraw!")
end, opts("edit inkscape figure"))

-- Abolish substitutions (personal shorthand)
-- Deferred so vim-abolish has finished loading on the session's first tex buffer.
local bufnr = vim.api.nvim_get_current_buf()
vim.schedule(function()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  if vim.fn.exists(":Abolish") ~= 2 then return end
  vim.api.nvim_buf_call(bufnr, function()
    vim.cmd("Abolish -buffer bc because")
  end)
end)

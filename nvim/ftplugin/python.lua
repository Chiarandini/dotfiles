
-- Deferred so vim-abolish has finished loading on the session's first python buffer.
local bufnr = vim.api.nvim_get_current_buf()
vim.schedule(function()
  if not vim.api.nvim_buf_is_valid(bufnr) then return end
  if vim.fn.exists(":Abolish") ~= 2 then return end
  vim.api.nvim_buf_call(bufnr, function()
    vim.cmd("Abolish -buffer bc because")
  end)
end)

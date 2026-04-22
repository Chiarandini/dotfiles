-- User Zero personal debug configuration
-- dap-python adapter: path is machine-specific so lives in user config.

-- Floating toggleable DAP REPL.
-- Supplements the bottom-tray REPL in dap-ui with a centered float that
-- reuses the same dap-repl buffer, so session state persists between toggles.
local float_win

local function toggle_float_repl()
  if float_win and float_win:valid() then
    float_win:close()
    float_win = nil
    return
  end

  local function find_repl_buf()
    for _, b in ipairs(vim.api.nvim_list_bufs()) do
      if vim.api.nvim_buf_is_valid(b) and vim.bo[b].filetype == "dap-repl" then
        return b
      end
    end
  end

  local repl_buf = find_repl_buf()
  if not repl_buf then
    -- Force dap to create the buffer, then drop its auto-opened split.
    require("dap").repl.open()
    require("dap").repl.close()
    repl_buf = find_repl_buf()
  end
  if not repl_buf then
    vim.notify("Could not create DAP REPL buffer", vim.log.levels.WARN)
    return
  end

  float_win = Snacks.win({
    buf       = repl_buf,
    width     = 0.8,
    height    = 0.6,
    border    = "rounded",
    title     = " DAP REPL ",
    title_pos = "center",
    wo        = { winbar = "", number = false, relativenumber = false, signcolumn = "no" },
    keys      = { q = "close" },
  })
  vim.cmd.startinsert()
end

return {
  {
    "mfussenegger/nvim-dap-python",
    config = function()
      -- Change this path if your Python is elsewhere (e.g. a venv).
      require("dap-python").setup("/opt/homebrew/bin/python3")
    end,
  },
  {
    "mfussenegger/nvim-dap",
    keys = {
      { "<leader>dF", toggle_float_repl, desc = "DAP: Toggle Floating REPL" },
    },
  },
}

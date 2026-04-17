-- User Zero personal debug configuration
-- dap-python adapter: path is machine-specific so lives in user config.

return {
  {
    "mfussenegger/nvim-dap-python",
    config = function()
      -- Change this path if your Python is elsewhere (e.g. a venv).
      require("dap-python").setup("/opt/homebrew/bin/python3")
    end,
  },
}

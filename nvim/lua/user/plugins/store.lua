return {
  "alex-popov-tech/store.nvim",
  dependencies = {
    { "OXY2DEV/markview.nvim", opts = {} },
    -- Optional: inline image rendering in README previews (Kitty, Ghostty, WezTerm only)
    { "3rd/image.nvim", opts = { integrations = { markdown = { enabled = false } } } },
  },
  opts = {
    layout = "tab", -- recommended when using image preview
  },
  cmd = "Store",
		keys = {
			-- bibtex citation from insert mode (requires telescope-bibtex.nvim)
			{
				"<space>P",
				"<cmd>Store<cr>",
				desc = "neovim plugin store",
			},
	},
}

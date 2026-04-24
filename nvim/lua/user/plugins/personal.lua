-- Personal / in-development plugins.
-- Not part of the NoetherVim distribution.

return {

	-- ── Personal distro extras ────────────────────────────────────────────────
	-- Removed from NoetherVim core (too niche for public distribution).

	{ -- File encryption/decryption via ccrypt
		"fouladi/ccrypt-wrapper.nvim",
		cmd = { "Encrypt", "Decrypt" },
		config = function()
			require("ccrypt-wrapper").setup({})
		end,
	},

	{ -- Timer / pomodoro
		"nvzone/timerly",
		dependencies = { "nvzone/volt" },
		cmd  = "TimerlyToggle",
	},



	-- LaTeX typo correction
	{
		"latexTypos.nvim",
		ft = { "tex" },
		dev = true,
		config = function()
			require("latexTypos").setup()
		end,
	},

	--for ObsidianTools, load immdeiatly
	-- Obsidian workflow tooling
	{
		"ObsidianTools.nvim",
		-- ft = "markdown",
		event = "VeryLazy", -- load after UI ready so keymaps work in any buffer
		dev = true,
		dependencies = { "obsidian-nvim/obsidian.nvim" },
		config = function()
			require("user.configs.ObsidianTools")
		end,
	},

	-- Website utilities
	{
		"WebsiteTools.nvim",
		lazy = false,
		dev = true,
		config = function()
			require("user.configs.WebsiteTools")
		end,
	},

	-- Telescope PDF browser: dropped 2026-04-23.
	-- Already routed around via Snacks.picker.files in user/plugins/snacks.lua
	-- (<space>fB). See NoetherVim dev-docs/telescope-removal-plan.md §3.1 for
	-- the decision. Reinstate as snacks-pdf-browser.nvim if the PDF preview
	-- (pdfinfo + pdftoppm) turns out to be missed.

	-- Japanese keyboard mode switching
	{
		"KeyboardMode.nvim",
		dev = true,
		keys = {
			{ "<leader>j", function() require("KeyboardMode").toggle() end, desc = "switch to japanese mode" },
		},
		config = function()
			require("KeyboardMode").setup()
		end,
	},

	-- Trilingual dictionary
	{
		"trilingualDict.nvim",
		dev = true,
		config = function()
			require("tridict").setup({ dict_binary = "dict" })
		end,
	},

}

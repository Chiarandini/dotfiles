local Snacks = require('snacks')
return {
	{
		"folke/snacks.nvim",
		keys = {
			-- grep obsidian vault (<space>go is reserved for this in the distro comment)
			{
				"<space>go",
				function()
					Snacks.picker.grep({ cwd = vim.fn.expand("~/Documents/NateObsidianVault/") })
				end,
				desc = "[g]rep [o]bsidian",
			},
			{ "<space>cg", function() require("snacks").picker.grep({ cwd = vim.fn.expand("~/.config/nvim"),              title = "nvim" })       end, desc = "[C]onfig grep" },
			{ "<space>cC", function() require("snacks").picker.files({ cwd = vim.fn.expand("~/.config/"),              title = "Dotfiles" })       end, desc = "[C]onfig dotfiles" },
			{ "<space>cf", function() require("snacks").picker.files({ cwd = vim.fn.stdpath("config") .. "/ftplugin",  title = "User Ftplugins" }) end, desc = "[f]tplugins (user)" },
			{ "<space>cs", function() require("snacks").picker.files({ cwd = vim.fn.stdpath("config") .. "/LuaSnip/",  title = "User Snippets" })  end, desc = "[s]nippets (user)" },
			-- open books directory (previously <space>fB with pdf_browser)
			{
				"<space>fB",
				function()
					Snacks.picker.files({ cwd = vim.fn.expand("~/Documents/Books/") })
				end,
				desc = "[f]ind [B]ooks",
			},
			-- university: current semester
			{
				"<space>fdu",
				function()
					Snacks.picker.files({ cwd = vim.fn.expand("~/Documents/University/PhD/2025-2026/1st semester/") })
				end,
				desc = "[d]oc [u]niversity (semester)",
			},
			-- university: all docs
			{
				"<space>fdU",
				function()
					Snacks.picker.files({ cwd = vim.fn.expand("~/Documents/University/") })
				end,
				desc = "[d]oc [U]niversity (all)",
			},
			-- EYNTKA summary files
			{
				"<space>fde",
				function()
					Snacks.picker.files({ cwd = vim.fn.expand("~/Documents/"), pattern = "EYNTKA" })
				end,
				desc = "[d]oc [e]YNTKA",
			},
			-- homework finder: fd with multi-pattern regex (migrated from telescope)
			{
				"<space>fdh",
				function()
					Snacks.picker.files({
						cwd   = vim.fn.expand("~/Documents/"),
						cmd   = "fd",
						args  = {
							"--type", "f", "--ignore-case",
							"hw|homework|prob.*set|pset|ps|assign|asn|lab|proj|quiz|exam|midterm|final|tut|sheet",
						},
						title = "Find Homework",
					})
				end,
				desc = "[d]oc [h]omework",
			},
		},
	},
}

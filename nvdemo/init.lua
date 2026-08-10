-- NoetherVim capture harness config.
-- Isolated from ~/.config/nvim via NVIM_APPNAME=nvdemo.
-- Loads NoetherVim from the local working tree so captures match HEAD.
--
-- Bundles are selected per-tape:
--   NVDEMO_BUNDLES="languages.latex,ui.tableaux" NVIM_APPNAME=nvdemo nvim

vim.g.mapleader = "\\"
vim.g.maplocalleader = ","
vim.g.mapsearchleader = "<space>"

-- Deterministic captures: no history bleed, no update-check popups.
-- Setting background up front stops nvim probing the terminal for it; the
-- recording pty never answers, and the E1568 timeout lands on the message
-- line right where a still gets taken.
vim.o.background = "dark"
vim.o.shada = ""
vim.o.swapfile = false
vim.o.undofile = false

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
	vim.fn.system({
		"git", "clone", "--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable", lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

local NV = vim.env.NOETHERVIM_SRC or (vim.env.HOME .. "/programming/NoetherVim")
vim.opt.rtp:prepend(NV)

require("noethervim.util").buffer_notify()

local spec = {
	{
		"Chiarandini/NoetherVim",
		dir = NV,
		import = "noethervim.plugins",
		config = function() require("noethervim").setup() end,
	},
}

-- Cmdline completion opens a menu on top of whatever the demo is trying to
-- show, including the / search prompt. Insert-mode completion stays on: the
-- tex demo shows it doing real work.
table.insert(spec, {
	"saghen/blink.cmp",
	opts = { cmdline = { enabled = false } },
})

for b in (vim.env.NVDEMO_BUNDLES or ""):gmatch("[^,%s]+") do
	table.insert(spec, { import = "noethervim.bundles." .. b })
end

-- Extra local plugins under demo. Each entry is "dir" or "dir|setup_module":
--   NVDEMO_LOCAL=~/programming/nvim-plugins/smart-enter.nvim|smart_enter
-- The module form is needed where the repo name does not map to the Lua
-- module name that owns setup().
local extra = vim.env.NVDEMO_LOCAL
if extra and extra ~= "" then
	for entry in extra:gmatch("[^,]+") do
		local dir, mod = entry:match("^([^|]+)|(.+)$")
		dir = dir or entry
		local item = { dir = dir, name = vim.fn.fnamemodify(dir, ":t"), lazy = false }
		if mod then
			item.config = function() require(mod).setup({}) end
		else
			item.opts = {}
		end
		table.insert(spec, item)
	end
end

require("lazy").setup({
	spec = spec,
	install = { colorscheme = { "gruvbox", "habamax" } },
	checker = { enabled = false },
	change_detection = { enabled = false, notify = false },
	performance = {
		rtp = {
			paths = { vim.fn.stdpath("config") },
			disabled_plugins = {
				"gzip", "matchit", "matchparen", "netrwPlugin",
				"tarPlugin", "tutor", "zipPlugin",
			},
		},
	},
})

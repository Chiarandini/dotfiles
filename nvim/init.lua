-- noethervim-template-version: 1
-- NoetherVim user config template.
-- Copy this file to ~/.config/nvim/init.lua
--
-- Quick start (see README):
--
--   mkdir -p ~/.config/nvim
--   cp /path/to/NoetherVim/init.lua.example ~/.config/nvim/init.lua
--   nvim
--
-- Personal overrides go in lua/user/ — see :help noethervim-user-config.
-- To debug without your overrides:  NOETHERVIM_NO_USER=1 nvim



-- ── 1. Leaders — must come before lazy.nvim loads ──────────────────────────
-- Plugins register keymaps at spec-load time using these globals.

vim.g.mapleader         = "\\"       -- <Leader>  — global actions
vim.g.maplocalleader    = ","        -- <LocalLeader> — filetype actions
vim.g.mapsearchleader = "<space>"    -- search/navigation prefix (default: <Space>)

-- ── 2. Bootstrap lazy.nvim and NoetherVim ─────────────────────────────────
-- Both must be on the rtp BEFORE lazy.setup() so that
-- `import = "noethervim.plugins"` resolves on first launch.

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
	vim.fn.system({
		"git", "clone", "--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable",
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

-- Dev mode: if vim.g.noethervim_dev is set (see ~/.config/noethervim/init.lua),
-- use the local working tree instead of cloning from GitHub.
local noethervim_dev = vim.g.noethervim_dev and vim.fn.expand(vim.g.noethervim_dev)
local noethervimpath = noethervim_dev or (vim.fn.stdpath("data") .. "/lazy/NoetherVim")
if not noethervim_dev and not vim.uv.fs_stat(noethervimpath) then
	vim.fn.system({
		"git", "clone", "--filter=blob:none",
		"https://github.com/Chiarandini/NoetherVim.git",
		noethervimpath,
	})
end
vim.opt.rtp:prepend(noethervimpath)

-- ── 3. Start NoetherVim ────────────────────────────────────────────────────

require("lazy").setup({

	spec = {

		-- ── Distro core ──────────────────────────────────────────────────
		-- Installs NoetherVim as a lazy plugin and imports all core plugins.
		-- Update with :Lazy update (or :Lazy sync).
		-- In dev mode (vim.g.noethervim_dev set), uses dir= instead of repo URL.
		vim.tbl_extend("force",
			noethervim_dev
				and { dir = noethervim_dev, name = "NoetherVim" }
				or  { "Chiarandini/NoetherVim" },
			{
				import = "noethervim.plugins",
				opts = {
					colorscheme = "gruvbox",   -- default colorscheme
					-- statusline  = {            -- statusline overrides
					--   colors     = {},
					--   extra_right = {},
					-- },
				},
				config = function(_, opts)
					require("noethervim").setup(opts)
				end,
			}
		),

		-- ── Bundles (opt-in) ─────────────────────────────────────────────
		-- Uncomment the bundles you want. Full list: lua/noethervim/bundles/

		-- Languages
		-- { import = "noethervim.bundles.languages.rust" },        -- rustaceanvim (beyond plain rust-analyzer)
		-- { import = "noethervim.bundles.languages.go" },          -- go.nvim (test gen, struct tags, fill struct)
		-- { import = "noethervim.bundles.languages.java" },        -- nvim-jdtls (proper Java LSP support)
		{ import = "noethervim.bundles.languages.python" },      -- venv-selector (virtual environment switching)
		{ import = "noethervim.bundles.languages.latex" },       -- VimTeX + snippets/textobjects
		{ import = "noethervim.bundles.languages.latex-zotero" }, -- Zotero citation picker (needs Zotero + Better BibTeX)
		{ import = "noethervim.bundles.languages.web-dev" },     -- JS/TS template string + color preview

		-- Tools
		{ import = "noethervim.bundles.tools.debug" },       -- nvim-dap + UI (Python, Lua, JS/TS, Go)
		{ import = "noethervim.bundles.tools.test" },        -- neotest test runner
		{ import = "noethervim.bundles.tools.repl" },        -- iron.nvim REPL
		{ import = "noethervim.bundles.tools.task-runner" }, -- overseer + compiler.nvim
		-- { import = "noethervim.bundles.tools.database" },    -- vim-dadbod + UI + SQL completion
		-- { import = "noethervim.bundles.tools.http" },        -- kulala.nvim HTTP/REST client
		{ import = "noethervim.bundles.tools.git" },         -- Fugit2, diffview, git-conflict
		-- { import = "noethervim.bundles.tools.ai" },          -- CodeCompanion (needs ANTHROPIC_API_KEY)
		-- { import = "noethervim.bundles.tools.refactoring" }, -- extract function/variable/block

		-- Navigation & editing
		-- { import = "noethervim.bundles.navigation.harpoon" },     -- fast per-project file marks
		-- { import = "noethervim.bundles.navigation.flash" },       -- enhanced f/t and / motions
		{ import = "noethervim.bundles.navigation.projects" },    -- project switcher (snacks.picker)
		{ import = "noethervim.bundles.navigation.editing-extras" }, -- argmark + comment boxes

		-- Writing & notes
		{ import = "noethervim.bundles.writing.markdown" },    -- render, preview, tables, math, image paste
		{ import = "noethervim.bundles.writing.obsidian" },    -- Obsidian vault (also enable markdown bundle)
		-- { import = "noethervim.bundles.writing.neorg" },       -- .norg wiki / note-taking
		{ import = "noethervim.bundles.writing.translation" }, -- in-editor translation

		-- Terminal & environment
		{ import = "noethervim.bundles.terminal.better-term" }, -- named terminal windows
		-- { import = "noethervim.bundles.terminal.tmux" },        -- tmux window naming
		-- { import = "noethervim.bundles.terminal.remote-dev" },  -- distant.nvim SSH editing

		-- UI & appearance
		-- { import = "noethervim.bundles.ui.colorscheme" }, -- 10 popular themes + persistence
		{ import = "noethervim.bundles.ui.eye-candy" },   -- animations, scrollbar, block display
		-- { import = "noethervim.bundles.ui.minimap" },     -- sidebar minimap
		{ import = "noethervim.bundles.ui.helpview" },    -- rendered :help pages
		{ import = "noethervim.bundles.ui.tableaux" },    -- 31 mathematical dashboard scenes for snacks.nvim

		-- Practice & utilities
		{ import = "noethervim.bundles.practice.dev-tools" },   -- StartupTime, Luapad
		{ import = "noethervim.bundles.practice.presentation" }, -- presenting.nvim + showkeys
		-- { import = "noethervim.bundles.practice.hardtime" },    -- motion habit trainer

		-- ── Dev-only bundles (loaded only under `nvdn` / vim.g.noethervim_dev) ──
		-- These ride along when you're testing against the local NoetherVim
		-- checkout, but stay off in the production `nvim` config. Built as a
		-- nested spec list so a missing optional bundle (e.g. typst, which
		-- only lives on feat/typst-bundle) doesn't leave a nil hole that
		-- truncates iteration of the outer spec.
		(function()
			if not noethervim_dev then return {} end
			local bundles = {
				{ import = "noethervim.bundles.practice.training" },     -- vim-be-good, speedtyper, typr
				{ import = "noethervim.bundles.tools.smart-actions" }
			}
			if vim.uv.fs_stat(noethervim_dev .. "/lua/noethervim/bundles/typst.lua") then
				table.insert(bundles, { import = "noethervim.bundles.typst" })
			end
			return bundles
		end)(),

		-- ── Your personal plugins & plugin overrides ─────────────────────
		-- Drop .lua files in lua/user/plugins/ to add new plugins or
		-- override existing plugin opts.  See templates/user/plugins/example.lua.
		-- Skipped when NOETHERVIM_NO_USER is set, vim.g.noethervim_no_user is
		-- true, or lua/user/plugins/ doesn't exist.
		not vim.env.NOETHERVIM_NO_USER
			and not vim.g.noethervim_no_user
			and vim.uv.fs_stat(vim.fn.stdpath("config") .. "/lua/user/plugins")
			and { import = "user.plugins" } or nil,

	},

	---@diagnostic disable-next-line: assign-type-mismatch
	dev = {
		path = "~/programming/custom_plugins/",
	},
	-- lazy-lock.json lives in your config dir (the default).
	-- :Lazy update pins versions there; :Lazy restore reverts to them.

	install  = { colorscheme = { "gruvbox", "habamax" } },
	checker  = { enabled = true },

	performance = {
		rtp = {
			-- Keep the user config dir on the rtp after lazy's reset,
			-- so that user.plugins and user.configs are importable.
			paths = { vim.fn.stdpath("config") },
			disabled_plugins = {
				"gzip", "matchit", "matchparen", "netrwPlugin",
				"tarPlugin", "tohtml", "tutor", "zipPlugin",
			},
		},
	},

})

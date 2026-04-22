
vim.keymap.set("n", "<space>fz", "<cmd>Telescope zotero<cr>", { desc = "Zotero citation picker" })

-- Prevent gc from eating gcc (personal preference — gc is the builtin
-- comment operator in Neovim 0.10+, but the timeout before gcc fires
-- can be annoying). Remove this if you use gc{motion} regularly.
vim.keymap.set("n", "gc", "", { desc = "disabled (use gcc)" })

-- ── <C-a>: dial.nvim increment, with "select all" as a fallback ──────────
-- NoetherVim maps <C-a> to dial.nvim (numbers, dates, booleans, …).
-- When the cursor line has nothing to increment, fall back to the classic
-- GUI "select all" so the key isn't wasted.
local function increment_or_select_all()
	-- Force-load dial in case we arrive here before its lazy `keys =` trigger.
	require("lazy").load({ plugins = { "dial.nvim" }, show = false })
	local tick = vim.b.changedtick
	require("dial.map").manipulate("increment", "normal")
	if vim.b.changedtick == tick then
		vim.cmd("normal! ggVG")
	end
end

local function bind_increment_fallback()
	vim.keymap.set("n", "<C-a>", increment_or_select_all,
		{ desc = "increment (fallback: select all)" })
end

bind_increment_fallback()

-- Dial's lazy `keys =` spec rebinds <C-a> on load, overriding ours. Reinstall
-- after LazyLoad fires -- same pattern as the overseer rebind block below.
vim.api.nvim_create_autocmd("User", {
	pattern = "LazyLoad",
	callback = function(args)
		if args.data == "dial.nvim" then
			vim.schedule(bind_increment_fallback)
		end
	end,
})

if package.loaded["dial.map"] then
	vim.schedule(bind_increment_fallback)
end


-- Quick run via overseer (replaces code_runner.nvim <leader>RR)
vim.keymap.set("n", "<leader>RR", "<cmd>OverseerRun<cr>", { desc = "run task (overseer)" })

-- ── Path / file utilities (moved from core keymaps) ──────────
vim.keymap.set("n", "cp",
  ":let @* = expand(\"%:p:h\")<cr>" ..
  "<cmd>lua vim.notify('yanked path ' .. vim.fn.expand('%:p:h'), 'info', {title='Path Yanked!'})<cr>",
  { desc = "copy directory path" })

vim.keymap.set("n", "gp",
  "<cmd>lua vim.notify(vim.fn.expand('%:p:h'), 'info', {title='Echo Path'})<cr>",
  { desc = "echo path" })

vim.keymap.set("n", "cm", function()
  local dir = vim.fn.expand("%:p:h")
  local output = vim.fn.system({ "ls", "-l", dir })
  vim.fn.setreg("*", output)
  vim.notify(output, vim.log.levels.INFO, { title = "Metadata Yanked!" })
end, { desc = "copy file metadata" })

-- ── Quick-open personal config files ──────────────────────────
vim.keymap.set("n", "<space>ev", "<cmd>e $MYVIMRC<cr>",         { desc = "edit vimrc" })
vim.keymap.set("n", "<space>ey", "<cmd>e ~/.yabairc<cr>",       { desc = "edit yabairc" })
vim.keymap.set("n", "<space>ez", "<cmd>e ~/.zshrc<cr>",         { desc = "edit zshrc" })

vim.keymap.set("n", "[n", "<cmd>set hlsearch<cr>",         { desc = "edit zshrc" })
vim.keymap.set("n", "]n", "<cmd>set nohlsearch<cr>",         { desc = "edit zshrc" })

-- ── Personal config navigation ────────────────────────────────
vim.keymap.set("n", "<space>cP", function()
  require("snacks").picker.files({ cwd = vim.fn.stdpath("config") .. "/preamble/" })
end, { desc = "[P]reamble" })

-- ── Personal directory shortcuts ──────────────────────────────
vim.api.nvim_create_user_command("J", function(opts)
  vim.cmd("cd ~/Documents/junk/")
  if opts.args ~= "" then vim.cmd("edit " .. opts.args) end
end, { nargs = "?", desc = "go to junk directory" })

vim.api.nvim_create_user_command("O", function()
  vim.cmd("cd ~/Documents/NateObsidianVault/")
end, { desc = "go to Obsidian vault" })

vim.api.nvim_create_user_command("U", function()
  vim.cmd("cd ~/Documents/University/PhD/2025-2026/1st semester/")
end, { desc = "go to university directory" })



-- ── Dashboard tableaux ────────────────────────────────────────────────────
-- Plugin: noethervim-tableaux (dev mode, see lua/user/plugins/tableaux.lua).
-- The plugin registers <space>ud / <space>uD itself.

-- ── Overseer (run file + side-panel layout + archived history) ────────────
-- Implementation: lua/user/configs/overseer-{layout,history}.lua
local overseer_layout  = require("user.configs.overseer-layout")
local overseer_history = require("user.configs.overseer-history")
vim.keymap.set("n", "<leader>rf",  overseer_layout.run_current_file,
	{ desc = "Run this [f]ile (+ layout)" })
vim.keymap.set("n", "<C-w><C-r>",  overseer_layout.toggle,
	{ desc = "Toggle overseer layout" })
vim.keymap.set("n", "<leader>rH",  overseer_history.browse,
	{ desc = "Browse archived task runs ([H]istory)" })
vim.keymap.set("n", "<leader>rS",  overseer_history.save_latest_pinned,
	{ desc = "Pin latest run with a name ([S]ave)" })

-- NoetherVim's task-runner bundle defines <leader>rf and <C-w><C-r> in a
-- lazy `keys =` spec. When overseer.nvim loads, lazy installs those upstream
-- handlers via vim.keymap.set, overriding the eager bindings above.
-- Rebind them after the plugin loads so our handlers win the race.
local function rebind_overseer_keys()
	vim.keymap.set("n", "<leader>rf", overseer_layout.run_current_file,
		{ desc = "Run this [f]ile (+ layout)" })
	vim.keymap.set("n", "<C-w><C-r>", overseer_layout.toggle,
		{ desc = "Toggle overseer layout" })
end

vim.api.nvim_create_autocmd("User", {
	pattern = "LazyLoad",
	callback = function(args)
		if args.data == "overseer.nvim" then
			vim.schedule(rebind_overseer_keys)
		end
	end,
})

-- If overseer was already loaded before this file ran, the LazyLoad event
-- already fired — rebind right away.
if package.loaded["overseer"] then
	vim.schedule(rebind_overseer_keys)
end

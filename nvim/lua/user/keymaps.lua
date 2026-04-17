
vim.keymap.set("n", "<space>fz", "<cmd>Telescope zotero<cr>", { desc = "Zotero citation picker" })

-- Prevent gc from eating gcc (personal preference — gc is the builtin
-- comment operator in Neovim 0.10+, but the timeout before gcc fires
-- can be annoying). Remove this if you use gc{motion} regularly.
vim.keymap.set("n", "gc", "", { desc = "disabled (use gcc)" })

-- Select all
-- vim.keymap.set("n", "<c-a>", "ggVG", { desc = "select all" })


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

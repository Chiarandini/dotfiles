-- Overseer "run + layout" helpers.
-- Layout:
--   ┌──── current buffer ─────┬─ Output (85%) ─┐
--   │                         ├────────────────┤
--   │                         │  Panel (15%)   │
--   └─────────────────────────┴────────────────┘
--
-- Bound from user/keymaps.lua. Lives outside lua/user/plugins/ because
-- lazy.nvim's import of that directory is unreliable in this config.

local M = {}

local runners = {
	python     = "python3",
	lua        = "lua",
	javascript = "node",
	typescript = "tsx",
	go         = "go run",
	sh         = "sh",
	bash       = "bash",
	zsh        = "zsh",
	ruby       = "ruby",
	julia      = "julia",
	perl       = "perl",
	r          = "Rscript",
	php        = "php",
}

local general_managers = { "mise", "asdf" }
local lang_managers = {
	python3 = { "pyenv" },
	python  = { "pyenv" },
	ruby    = { "rbenv" },
	node    = { "nodenv" },
	go      = { "goenv" },
}

local function try_manager(manager, bin, dir)
	if vim.fn.executable(manager) ~= 1 then return nil end
	local result = vim.system({ manager, "which", bin }, { cwd = dir, text = true }):wait()
	if result.code == 0 and result.stdout ~= "" then
		return vim.trim(result.stdout)
	end
	return nil
end

local function resolve_runner(cmd, dir)
	local bin  = cmd:match("^(%S+)")
	local rest = cmd:sub(#bin + 1)
	for _, manager in ipairs(general_managers) do
		local resolved = try_manager(manager, bin, dir)
		if resolved then return resolved .. rest end
	end
	local specific = lang_managers[bin]
	if specific then
		for _, manager in ipairs(specific) do
			local resolved = try_manager(manager, bin, dir)
			if resolved then return resolved .. rest end
		end
	end
	return cmd
end

local function find_panel_win()
	for _, w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
		local buf = vim.api.nvim_win_get_buf(w)
		if vim.bo[buf].filetype == "OverseerList" then
			return w
		end
	end
	return nil
end

local function find_output_wins()
	local wins = {}
	for _, w in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
		local ok, val = pcall(vim.api.nvim_win_get_var, w, "overseer_layout_output")
		if ok and val then
			table.insert(wins, w)
		end
	end
	return wins
end

local function close_layout()
	for _, w in ipairs(find_output_wins()) do
		pcall(vim.api.nvim_win_close, w, true)
	end
	-- Use overseer's own close so its internal state stays consistent. A bare
	-- nvim_win_close on the panel can leave overseer thinking the window
	-- still exists, which makes the next overseer.open() reuse it (and
	-- ignore our direction = "right").
	pcall(function() require("overseer").close() end)
end

-- Bind `q` in a buffer to close the whole layout (panel + output).
local function bind_q_close(bufnr)
	if not bufnr or not vim.api.nvim_buf_is_valid(bufnr) then return end
	vim.keymap.set("n", "q", close_layout,
		{ buffer = bufnr, nowait = true, silent = true, desc = "Close overseer layout" })
end

-- When follow_cursor is active, overseer's TaskView swaps the output window's
-- buffer on every panel cursor move. A one-shot bind_q_close on the initial
-- buffer therefore stops working after the first hover. This autocmd re-binds
-- `q` on whatever buffer enters the tagged output window.
local q_autocmd_id
local function ensure_q_autocmd()
	if q_autocmd_id then return end
	q_autocmd_id = vim.api.nvim_create_autocmd("BufWinEnter", {
		desc = "Rebind q=close_layout on swapped overseer output buffers",
		callback = function(args)
			for _, w in ipairs(vim.fn.win_findbuf(args.buf)) do
				local ok, val = pcall(vim.api.nvim_win_get_var, w, "overseer_layout_output")
				if ok and val then
					bind_q_close(args.buf)
					return
				end
			end
		end,
	})
end

-- Set overseer's global default direction once, lazily. We do this on first
-- use rather than at module load because requiring overseer.config eagerly
-- would force the plugin to load before lazy.nvim is ready.
local direction_set = false
local function ensure_overseer_default_direction()
	if direction_set then return end
	pcall(function()
		require("overseer.config").task_list.direction = "right"
	end)
	direction_set = true
end

-- Ensures the panel is open on the right (column width = 50% of screen).
-- If `output_bufnr` is given, shows it in a split above the panel sized to
-- 85% of the column height. When `opts.follow_cursor` is true, the output
-- slot tracks the task under the cursor in the panel (same mechanism as
-- overseer's built-in bottom layout). Archived-log views pass false so the
-- static buffer isn't swapped out from under the user.
local function open_layout_with_buffer(output_bufnr, opts)
	opts = opts or {}
	ensure_overseer_default_direction()

	local origin_win = vim.api.nvim_get_current_win()
	close_layout()

	local overseer = require("overseer")
	overseer.open({ enter = false, direction = "right" })

	local panel_win = find_panel_win()
	if not panel_win then return end

	if output_bufnr and vim.api.nvim_buf_is_valid(output_bufnr) then
		vim.api.nvim_set_current_win(panel_win)
		vim.cmd("aboveleft split")
		local output_win = vim.api.nvim_get_current_win()
		vim.api.nvim_win_set_var(output_win, "overseer_layout_output", true)
		vim.api.nvim_win_set_buf(output_win, output_bufnr)

		if opts.follow_cursor then
			require("overseer.task_view").new(output_win, {
				close_on_list_close = true,
				select = function(_, tasks, task_under_cursor)
					return task_under_cursor or tasks[1]
				end,
			})
			ensure_q_autocmd()
		end

		local total = vim.api.nvim_win_get_height(output_win) + vim.api.nvim_win_get_height(panel_win)
		vim.api.nvim_win_set_height(panel_win, math.max(3, math.floor(total * 0.15)))

		bind_q_close(output_bufnr)
	end

	-- Column width: 50% of screen. Setting on panel resizes the whole column
	-- since panel + output share a vsplit column.
	vim.api.nvim_win_set_width(panel_win, math.max(20, math.floor(vim.o.columns * 0.5)))

	bind_q_close(vim.api.nvim_win_get_buf(panel_win))

	if vim.api.nvim_win_is_valid(origin_win) then
		vim.api.nvim_set_current_win(origin_win)
	end
end

local function open_layout(task)
	local overseer = require("overseer")
	task = task or (overseer.list_tasks({ recent_first = true }) or {})[1]
	local bufnr = task and task:get_bufnr() or nil
	open_layout_with_buffer(bufnr, { follow_cursor = true })
end

---Public: place an arbitrary buffer in the layout's Output slot. Opens the
---panel if closed. Used by the history browser to display archived logs.
---@param bufnr integer
function M.show_output_buffer(bufnr)
	open_layout_with_buffer(bufnr)
end

---Public: open the layout and place `task`'s live output in the Output slot.
---Used by the history browser's "replay" action.
---@param task table  overseer.Task
function M.open_for_task(task)
	open_layout(task)
end

function M.toggle()
	if find_panel_win() then
		close_layout()
	else
		open_layout()
	end
end

function M.run_current_file()
	local ft  = vim.bo.filetype
	local cmd = runners[ft]
	if not cmd then
		vim.notify("No runner for filetype: " .. ft, vim.log.levels.WARN)
		return
	end

	local file = vim.fn.shellescape(vim.fn.expand("%:p"))
	local dir  = vim.fn.expand("%:p:h")
	local name = vim.fn.expand("%:t")
	cmd = resolve_runner(cmd, dir)

	local task = require("overseer").new_task({
		name = "Run " .. name,
		cmd  = cmd .. " " .. file,
		cwd  = dir,
		components = {
			"default",
			{ "on_complete_notify", statuses = { "SUCCESS", "FAILURE" } },
			"user.archive_output",
		},
	})
	task:start()
	open_layout(task)
end

return M

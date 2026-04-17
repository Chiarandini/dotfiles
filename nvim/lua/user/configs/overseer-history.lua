-- Persistent history for overseer tasks started through the layout flow.
-- Every finished task is archived to disk, grouped by its cwd:
--
--   <stdpath.data>/overseer-history/<cwd-slug>/
--     <epoch>-<task-id>.json   -- metadata
--     <epoch>-<task-id>.log    -- captured output (ANSI stripped)
--
-- Browsing/replay UI lives in later layers; this module just does the
-- capture and provides a list API.

local M = {}

-- Keep at most this many non-pinned entries per cwd; older ones are pruned
-- after each archive. Pinned entries are never counted or pruned.
M.max_per_cwd = 50

local ANSI_PATTERN = "\27%[[0-9;?]*[a-zA-Z]"

local function data_root()
	return vim.fn.stdpath("data") .. "/overseer-history"
end

local function cwd_slug(cwd)
	cwd = cwd or vim.fn.getcwd()
	local slug = cwd:gsub("^/", ""):gsub("/", "__"):gsub("[^%w_%-%.]", "_")
	if slug == "" then slug = "ROOT" end
	return slug
end

---@param cwd? string  defaults to vim.fn.getcwd()
function M.archive_dir(cwd)
	return data_root() .. "/" .. cwd_slug(cwd)
end

local function read_buffer(bufnr)
	if not bufnr or not vim.api.nvim_buf_is_valid(bufnr) then return "" end
	local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
	return table.concat(lines, "\n")
end

local function write_file(path, content)
	local f, err = io.open(path, "w")
	if not f then return false, err end
	f:write(content)
	f:close()
	return true
end

---Archive a task's metadata + output buffer.
---Called from the `user.archive_output` component on task completion.
---@param task table   overseer.Task
---@param status string
function M.archive(task, status)
	local dir = M.archive_dir(task.cwd)
	vim.fn.mkdir(dir, "p")

	local id = string.format("%d-%d", os.time(), task.id or 0)
	local meta_path = dir .. "/" .. id .. ".json"
	local log_path  = dir .. "/" .. id .. ".log"

	local output = read_buffer(task:get_bufnr())
	output = output:gsub(ANSI_PATTERN, "")

	local meta = {
		id          = task.id,
		name        = task.name,
		cmd         = task.cmd,
		cwd         = task.cwd,
		status      = status,
		finished_at = os.time(),
		log         = log_path,
	}

	write_file(meta_path, vim.json.encode(meta))
	write_file(log_path, output)

	pcall(M.prune, task.cwd)
end

---Delete the on-disk files for an entry.
---@param entry table  must have _meta_path; log path is read from entry.log
---@return boolean ok
function M.delete_entry(entry)
	if entry._meta_path then os.remove(entry._meta_path) end
	if entry.log        then os.remove(entry.log)        end
	return true
end

---Keep at most M.max_per_cwd non-pinned entries for `cwd`. Deletes the
---oldest non-pinned entries beyond the cap. Pinned entries are skipped.
---@param cwd? string
function M.prune(cwd)
	local entries = M.list(cwd)
	local unpinned = {}
	for _, e in ipairs(entries) do
		if not e.pinned then table.insert(unpinned, e) end
	end
	-- M.list returns newest-first, so unpinned[1] is newest. Excess = tail.
	for i = M.max_per_cwd + 1, #unpinned do
		M.delete_entry(unpinned[i])
	end
end

---Start a new task using the saved cmd/cwd/name of `entry` and show it
---in the layout.
---@param entry table
function M.replay(entry)
	local overseer = require("overseer")
	local task = overseer.new_task({
		name = entry.name or "Replay",
		cmd  = entry.cmd,
		cwd  = entry.cwd,
		components = {
			"default",
			{ "on_complete_notify", statuses = { "SUCCESS", "FAILURE" } },
			"user.archive_output",
		},
	})
	task:start()
	require("user.configs.overseer-layout").open_for_task(task)
end

---List archived entries for a cwd, newest-first.
---@param cwd? string  defaults to current cwd
---@return table[]
function M.list(cwd)
	local dir = M.archive_dir(cwd)
	local entries = {}
	if vim.fn.isdirectory(dir) == 0 then return entries end
	for _, f in ipairs(vim.fn.glob(dir .. "/*.json", false, true)) do
		local raw = vim.fn.readfile(f)
		local ok, decoded = pcall(vim.json.decode, table.concat(raw, "\n"))
		if ok and type(decoded) == "table" then
			decoded._meta_path = f
			table.insert(entries, decoded)
		end
	end
	table.sort(entries, function(a, b)
		return (a.finished_at or 0) > (b.finished_at or 0)
	end)
	return entries
end

---Write metadata back out to the entry's .json file.
---@param entry table  must have _meta_path
local function rewrite_meta(entry)
	local path = entry._meta_path
	if not path then return false end
	local clean = vim.deepcopy(entry)
	clean._meta_path = nil
	return write_file(path, vim.json.encode(clean))
end

---Pin the most recent archived entry for the current cwd under `name`.
---@param name string
---@return boolean ok, string? reason
function M.pin_latest(name)
	if not name or name == "" then
		return false, "empty name"
	end
	local entries = M.list()
	if #entries == 0 then
		return false, "no archived runs for this cwd"
	end
	local latest = entries[1]
	latest.pinned      = true
	latest.pinned_name = name
	if not rewrite_meta(latest) then
		return false, "failed to rewrite " .. tostring(latest._meta_path)
	end
	return true
end

---Prompt for a name, then pin the most recent archived entry.
function M.save_latest_pinned()
	vim.ui.input({ prompt = "Pin latest run as: " }, function(input)
		if not input or input == "" then return end
		local ok, reason = M.pin_latest(input)
		if ok then
			vim.notify("Pinned latest run as '" .. input .. "'",
				vim.log.levels.INFO)
		else
			vim.notify("Pin failed: " .. (reason or "?"),
				vim.log.levels.WARN)
		end
	end)
end

local STATUS_GLYPH = {
	SUCCESS  = "✓",
	FAILURE  = "✗",
	CANCELED = "⊘",
	RUNNING  = "…",
}

local function time_ago(t)
	if not t then return "?" end
	local d = os.time() - t
	if d < 60    then return string.format("%ds ago",  d) end
	if d < 3600  then return string.format("%dm ago",  math.floor(d / 60)) end
	if d < 86400 then return string.format("%dh ago",  math.floor(d / 3600)) end
	return string.format("%dd ago", math.floor(d / 86400))
end

---Create a readonly scratch buffer populated from a log file.
---@param entry table  meta entry as returned by M.list
---@return integer bufnr
local function load_log_buffer(entry)
	local bufnr = vim.api.nvim_create_buf(false, true)
	local lines = vim.fn.filereadable(entry.log) == 1
		and vim.fn.readfile(entry.log)
		or { "(log file missing: " .. tostring(entry.log) .. ")" }
	vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
	vim.bo[bufnr].buftype   = "nofile"
	vim.bo[bufnr].bufhidden = "wipe"
	vim.bo[bufnr].modifiable = false
	vim.bo[bufnr].readonly   = true
	local title = string.format("[history] %s (%s)",
		entry.name or "?", entry.status or "?")
	pcall(vim.api.nvim_buf_set_name, bufnr, title)
	return bufnr
end

local function show_entry(entry)
	local bufnr = load_log_buffer(entry)
	require("user.configs.overseer-layout").show_output_buffer(bufnr)
end

local function build_items()
	local entries = M.list()
	-- Sort: pinned first (by pinned_name), then non-pinned by finished_at desc.
	table.sort(entries, function(a, b)
		if a.pinned and not b.pinned then return true  end
		if b.pinned and not a.pinned then return false end
		if a.pinned and b.pinned then
			return (a.pinned_name or "") < (b.pinned_name or "")
		end
		return (a.finished_at or 0) > (b.finished_at or 0)
	end)

	local items = {}
	for _, e in ipairs(entries) do
		local label
		if e.pinned then
			label = string.format("★  %-20s  %s  %s",
				e.pinned_name or "?",
				STATUS_GLYPH[e.status] or "?",
				e.name or "?")
		else
			label = string.format("   %-20s  %s  %s",
				time_ago(e.finished_at),
				STATUS_GLYPH[e.status] or "?",
				e.name or "?")
		end
		table.insert(items, { text = label, entry = e })
	end
	return items
end

---Open a picker of archived runs for the current cwd.
---
---Keymaps inside the picker:
---   <CR>    open the log in the layout's Output slot
---   <C-r>   replay: re-run the task
---   <C-p>   pin and/or rename the entry (prompts)
---   <C-u>   unpin
---   <C-d>   delete the entry from disk
function M.browse()
	if #M.list() == 0 then
		vim.notify("No archived runs for this cwd: " .. vim.fn.getcwd(),
			vim.log.levels.INFO)
		return
	end

	---@diagnostic disable-next-line: undefined-field
	local snacks = _G.Snacks
	if snacks and snacks.picker and snacks.picker.pick then
		snacks.picker.pick({
			source = "overseer_history",
			finder = function() return build_items() end,
			format = function(item) return { { item.text } } end,
			confirm = function(picker, item)
				picker:close()
				if item and item.entry then show_entry(item.entry) end
			end,
			actions = {
				replay = function(picker, item)
					if not (item and item.entry) then return end
					picker:close()
					M.replay(item.entry)
				end,
				pin_rename = function(picker, item)
					if not (item and item.entry) then return end
					vim.ui.input({
						prompt  = "Pin as: ",
						default = item.entry.pinned_name or "",
					}, function(input)
						if not input or input == "" then return end
						item.entry.pinned      = true
						item.entry.pinned_name = input
						rewrite_meta(item.entry)
						picker:find()
					end)
				end,
				unpin = function(picker, item)
					if not (item and item.entry and item.entry.pinned) then
						return
					end
					item.entry.pinned      = nil
					item.entry.pinned_name = nil
					rewrite_meta(item.entry)
					picker:find()
				end,
				delete = function(picker, item)
					if not (item and item.entry) then return end
					M.delete_entry(item.entry)
					picker:find()
				end,
			},
			win = {
				input = {
					keys = {
						["<C-r>"] = { "replay",     mode = { "n", "i" }, desc = "Replay task" },
						["<C-p>"] = { "pin_rename", mode = { "n", "i" }, desc = "Pin / rename" },
						["<C-u>"] = { "unpin",      mode = { "n", "i" }, desc = "Unpin" },
						["<C-d>"] = { "delete",     mode = { "n", "i" }, desc = "Delete entry" },
					},
				},
			},
		})
		return
	end

	-- Fallback: vim.ui.select. Only the default action; no replay/pin/delete.
	vim.ui.select(build_items(), {
		prompt = "Archived runs",
		format_item = function(i) return i.text end,
	}, function(choice)
		if choice and choice.entry then show_entry(choice.entry) end
	end)
end

return M

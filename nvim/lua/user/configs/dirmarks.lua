-- ── dirmarks: named directories, the Neovim half ──────────────────────────
--
-- The `nvim`-then-cd counterpart to the shell's `c`. Both front-ends shell
-- out to ~/.config/scripts/dirmarks, which owns the file format, the $ANCHOR
-- expansion and every mutation — so the two can never drift apart. The data
-- lives in ~/.config/dirmarks.
--
--   :C                 picker over every bookmark
--   :C <name>          :cd there   (exact → unique prefix → unique substring)
--   :C <name>/sub      :cd into a subdirectory of a bookmark
--   :C add [name]      bookmark the cwd (`:C! add` bookmarks the buffer's dir)
--   :C rm <name>       :C mv <old> <new>   :C set <name>   :C note <name> ...
--   :C ls  :C edit  :C check  :C help
--
--   :Ci [name] [depth] "change inside": pick a SUBDIRECTORY of a bookmark
--   :CI                (same command — shift can stay down; shell twin `ci`;
--                      also <Tab> / <C-l> from inside the `:C` picker)
--
--   <space>j           the picker, with per-item actions (see M.pick)
--
-- Editing the list (`:C edit`) opens the real file with ft=dirmarks: columns
-- are realigned by the same formatter on :w, missing directories are painted
-- red, and <CR> on a line cds to it.

local M = {}

-- ~/.local/bin/dirmarks is a symlink to ~/.config/scripts/dirmarks (the
-- tracked original, same convention as fix-yabai and friends). Both are
-- tried, then $PATH, so a missing symlink degrades instead of breaking.
local SCRIPTS = {
	vim.fn.expand("~/.local/bin/dirmarks"),
	vim.fn.expand("~/.config/scripts/dirmarks"),
}

---Absolute path of the dirmarks executable, or nil (with one warning).
local warned = false
local function bin()
	for _, path in ipairs(SCRIPTS) do
		if vim.fn.executable(path) == 1 then return path end
	end
	local found = vim.fn.exepath("dirmarks")
	if found ~= "" then return found end
	if not warned then
		warned = true
		vim.notify("dirmarks: script not found (expected ~/.config/scripts/dirmarks)",
			vim.log.levels.ERROR)
	end
	return nil
end

---Run the script synchronously. Returns stdout (trimmed) or nil, plus stderr.
---@param args string[]
---@return string?, string
local function run(args)
	local exe = bin()
	if not exe then return nil, "" end
	local cmd = { exe }
	vim.list_extend(cmd, args)
	local res = vim.system(cmd, { text = true }):wait()
	local err = vim.trim(res.stderr or "")
	if res.code ~= 0 then return nil, err end
	return (res.stdout or ""):gsub("\n$", ""), err
end

---The data file. Not asked of the script (that would be a process spawn at
---startup); the default and the $DIRMARKS_FILE override are the contract.
function M.file()
	return vim.env.DIRMARKS_FILE or vim.fn.expand("~/.config/dirmarks")
end

-- ── reading ───────────────────────────────────────────────────────────────

---@class user.dirmark
---@field name string
---@field raw string     as written in the file ("$TEXTBOOKS", "~/x")
---@field path string    absolute
---@field exists boolean
---@field note string

local cache = { key = nil, items = nil }

---All bookmarks, cached until the file's mtime changes (every mutation goes
---through the script, so the mtime is a complete invalidation signal).
---@return user.dirmark[]
function M.list()
	local st = vim.uv.fs_stat(M.file())
	local key = st and (st.mtime.sec .. "." .. st.mtime.nsec) or "none"
	if cache.items and cache.key == key then return cache.items end

	local out = run({ "ls", "--raw" })
	local items = {} ---@type user.dirmark[]
	for _, line in ipairs(vim.split(out or "", "\n", { trimempty = true })) do
		local f = vim.split(line, "\t", { plain = true })
		if f[1] and f[1] ~= "" then
			items[#items + 1] = {
				name   = f[1],
				raw    = f[2] or "",
				path   = f[3] or "",
				exists = f[4] == "1",
				note   = f[5] or "",
			}
		end
	end
	cache.key, cache.items = key, items
	return items
end

---Resolve a query (exact → prefix → substring, `name/sub` allowed).
---@return string? path
function M.resolve(query)
	local out = run({ "resolve", query })
	if out and out ~= "" then return out end
	return nil
end

---Subdirectories of a bookmark. Not cached: unlike the bookmark list this
---is a live view of the filesystem, and it is only ever asked for on demand.
---@param depth? integer   default 1
---@return { rel: string, path: string }[]
function M.children(name, depth)
	local out, err = run({ "children", name, tostring(depth or 1) })
	if not out then
		if err ~= "" then vim.notify(err, vim.log.levels.WARN) end
		return {}
	end
	local items = {}
	for _, line in ipairs(vim.split(out, "\n", { trimempty = true })) do
		local rel, path = line:match("^(.-)\t(.*)$")
		if rel then items[#items + 1] = { rel = rel, path = path } end
	end
	return items
end

-- ── acting ────────────────────────────────────────────────────────────────

---@param scope? "cd"|"tcd"|"lcd"
function M.cd(path, scope)
	if vim.fn.isdirectory(path) == 0 then
		vim.notify("dirmarks: no such directory: " .. path, vim.log.levels.WARN)
		return false
	end
	vim.cmd(("%s %s"):format(scope or "cd", vim.fn.fnameescape(path)))
	vim.notify(("%s  %s"):format(scope or "cd", vim.fn.fnamemodify(path, ":~")),
		vim.log.levels.INFO, { title = "dirmarks" })
	return true
end

---Go to a bookmark by name/query.
---@param opts? { scope?: string, edit?: string }
function M.goto_mark(query, opts)
	opts = opts or {}
	local path = M.resolve(query)
	if not path then
		vim.notify("dirmarks: no bookmark matching '" .. query .. "'",
			vim.log.levels.WARN)
		return
	end
	if M.cd(path, opts.scope) and opts.edit and opts.edit ~= "" then
		vim.cmd("edit " .. vim.fn.fnameescape(opts.edit))
	end
end

---Hand a directory back to the parent shell: the zsh `nvim` wrapper cds
---there once Neovim exits (same channel Oil's `gR` uses, minus the command).
function M.shell_follow(path)
	local handoff = vim.env.NVIM_RUN_ON_EXIT
	if not handoff or handoff == "" then
		vim.notify("dirmarks: launch nvim via the zsh wrapper to use this",
			vim.log.levels.WARN)
		return
	end
	vim.fn.writefile({ path }, handoff)
	vim.notify("shell will cd here on exit:\n" .. vim.fn.fnamemodify(path, ":~"),
		vim.log.levels.INFO, { title = "dirmarks" })
end

---Bookmark a directory. Prompts for the name when one isn't given.
---@param dir? string   defaults to the cwd
---@param name? string
function M.add(dir, name)
	dir = dir or vim.fn.getcwd()
	local function commit(n)
		local out, err = run({ "add", n, dir })
		if not out then
			vim.notify("dirmarks: " .. (err ~= "" and err or "add failed"),
				vim.log.levels.ERROR)
			return
		end
		vim.notify(out, vim.log.levels.INFO, { title = "dirmarks" })
	end
	if name and name ~= "" then return commit(name) end
	vim.ui.input({
		prompt  = "Bookmark " .. vim.fn.fnamemodify(dir, ":~") .. " as: ",
		default = vim.fn.fnamemodify(dir, ":t"),
	}, function(input)
		if input and input ~= "" then commit(input) end
	end)
end

function M.edit()
	vim.cmd("edit " .. vim.fn.fnameescape(M.file()))
end

-- ── picker ────────────────────────────────────────────────────────────────

---Everything you can do to a directory once one is highlighted, independent
---of which picker highlighted it. `path_of` adapts the item shape.
---@param path_of fun(item: table): string
local function dir_actions(path_of)
	---Close, then act — so :cd lands on the real window, not the picker's.
	local function with(fn)
		return function(picker, item)
			if not item then return end
			picker:close()
			vim.schedule(function() fn(path_of(item)) end)
		end
	end
	return {
		dm_tcd   = with(function(p) M.cd(p, "tcd") end),
		-- cd AND open Oil, which is what the shell's `cn` does. Looking at a
		-- directory without committing to it is what the preview pane is for.
		dm_oil   = with(function(p)
			if M.cd(p) then vim.cmd("edit " .. vim.fn.fnameescape(p)) end
		end),
		dm_files = with(function(p) require("snacks").picker.files({ cwd = p }) end),
		dm_grep  = with(function(p) require("snacks").picker.grep({ cwd = p }) end),
		dm_shell = with(function(p) M.shell_follow(p) end),
	}, with
end

local DIR_KEYS = {
	["<C-t>"] = { "dm_tcd",   mode = { "n", "i" }, desc = "tcd (this tab)" },
	["<C-o>"] = { "dm_oil",   mode = { "n", "i" }, desc = "cd + open in Oil" },
	["<C-f>"] = { "dm_files", mode = { "n", "i" }, desc = "find files here" },
	["<C-g>"] = { "dm_grep",  mode = { "n", "i" }, desc = "grep here" },
	["<C-s>"] = { "dm_shell", mode = { "n", "i" }, desc = "shell cds here on exit" },
}

local function snacks_picker()
	local ok, Snacks = pcall(require, "snacks")
	if ok and Snacks.picker and Snacks.picker.pick then return Snacks end
	return nil
end

---Pick a bookmark.
---
---   <CR>   cd            <C-t>  tcd (this tab only)
---   <Tab>  go inside     <C-l>  go inside
---   <C-f>  find files    <C-g>  grep
---   <C-o>  cd + Oil      <C-s>  shell cds here when nvim exits
---   <C-a>  add cwd       <C-d>  delete   <C-e>  edit the list
---@param opts? { descend?: boolean }   descend: <CR> goes inside instead
function M.pick(opts)
	opts = opts or {}
	local marks = M.list()
	if #marks == 0 then
		vim.notify("dirmarks: no bookmarks yet — try `:C add`", vim.log.levels.INFO)
		return
	end

	local Snacks = snacks_picker()
	if not Snacks then
		vim.ui.select(marks, {
			prompt = "Directories",
			format_item = function(m) return ("%-16s %s"):format(m.name, m.raw) end,
		}, function(choice)
			if not choice then return end
			if opts.descend then M.pick_children(choice.name) else M.cd(choice.path) end
		end)
		return
	end

	local function finder()
		local items, w_name, w_path = {}, 4, 10
		local all = M.list()
		for _, m in ipairs(all) do
			w_name = math.max(w_name, #m.name)
			w_path = math.max(w_path, #m.raw)
		end
		for _, m in ipairs(all) do
			items[#items + 1] = {
				text   = table.concat({ m.name, m.raw, m.note }, " "),
				file   = m.path,   -- what the directory previewer reads
				mark   = m,
				w_name = w_name,
				w_path = w_path,
			}
		end
		return items
	end

	local actions, with = dir_actions(function(item) return item.mark.path end)
	-- Not built from `with`: descending needs the bookmark's name, not its path.
	actions.dm_into = function(picker, item)
		if not item then return end
		picker:close()
		vim.schedule(function() M.pick_children(item.mark.name) end)
	end
	actions.dm_edit = with(function() M.edit() end)
	actions.dm_add = function(picker)
		M.add(vim.fn.getcwd())
		vim.defer_fn(function() pcall(function() picker:find() end) end, 200)
	end
	actions.dm_delete = function(picker, item)
		if not item then return end
		local out, err = run({ "rm", item.mark.name })
		vim.notify(out or ("dirmarks: " .. err),
			out and vim.log.levels.INFO or vim.log.levels.ERROR)
		picker:find()
	end

	local keys = vim.tbl_extend("force", {}, DIR_KEYS, {
		["<Tab>"] = { "dm_into",   mode = { "n", "i" }, desc = "go inside this one" },
		["<C-l>"] = { "dm_into",   mode = { "n", "i" }, desc = "go inside this one" },
		["<C-a>"] = { "dm_add",    mode = { "n", "i" }, desc = "bookmark the cwd" },
		["<C-d>"] = { "dm_delete", mode = { "n", "i" }, desc = "delete bookmark" },
		["<C-e>"] = { "dm_edit",   mode = { "n", "i" }, desc = "edit the list" },
	})

	Snacks.picker.pick({
		source = "dirmarks",
		title  = opts.descend and "Go inside…" or "Directories",
		finder = finder,
		preview = "directory",   -- snacks' own directory-listing previewer
		-- Stock highlight groups, not SnacksPicker* ones: half of those are
		-- undefined in this snacks version, and these match the colours the
		-- ft=dirmarks edit buffer paints, so both views read the same.
		format = function(item)
			local m = item.mark
			return {
				{ ("%-" .. item.w_name .. "s"):format(m.name), "Identifier" },
				{ "  ", "" },
				{ ("%-" .. item.w_path .. "s"):format(m.raw),
					m.exists and "Directory" or "DiagnosticError" },
				{ "  ", "" },
				{ m.note, "Comment" },
			}
		end,
		confirm = opts.descend and actions.dm_into
			or with(function(p) M.cd(p) end),
		actions = actions,
		win = { input = { keys = keys } },
	})
end

---Pick one of a bookmark's subdirectories and cd there.
---
---Deliberately a single column of relative paths rather than the bookmark
---picker's three: this is browsing a directory, not choosing from the
---curated list, and the two should not look like the same thing.
---@param depth? integer
function M.pick_children(name, depth)
	local kids = M.children(name, depth)
	if #kids == 0 then
		vim.notify("dirmarks: no subdirectories under '" .. name .. "'",
			vim.log.levels.WARN)
		return
	end

	local Snacks = snacks_picker()
	if not Snacks then
		vim.ui.select(kids, {
			prompt = name .. "/",
			format_item = function(k) return k.rel end,
		}, function(choice) if choice then M.cd(choice.path) end end)
		return
	end

	local actions, with = dir_actions(function(item) return item.kid.path end)

	Snacks.picker.pick({
		source = "dirmarks_children",
		title  = name .. "/",
		finder = function()
			local items = {}
			for _, k in ipairs(kids) do
				items[#items + 1] = { text = k.rel, file = k.path, kid = k }
			end
			return items
		end,
		preview = "directory",
		format = function(item) return { { item.kid.rel, "Directory" } } end,
		confirm = with(function(p) M.cd(p) end),
		actions = actions,
		win = { input = { keys = vim.tbl_extend("force", {}, DIR_KEYS) } },
	})
end

-- ── the :C command ────────────────────────────────────────────────────────

-- Kept in sync with DM_RESERVED in the script: these words are subcommands,
-- never bookmark names, and `dirmarks add` refuses to create one.
local VERBS = {
	"add", "rm", "edit", "ls", "mv", "set", "note", "check", "help",
}

---Subcommands that are just a pass-through to the script + a notification.
local PASSTHRU = {
	rm = true, mv = true, set = true, note = true, check = true, help = true,
}

local function complete(arglead)
	-- "<name>/<partial>" → real directories under that bookmark
	local head, tail = arglead:match("^([^/]+)/(.*)$")
	if head then
		local base = M.resolve(head)
		if base then
			local out = {}
			for _, p in ipairs(vim.fn.getcompletion(base .. "/" .. tail, "dir")) do
				out[#out + 1] = head .. "/" .. p:sub(#base + 2)
			end
			return out
		end
		return {}
	end

	local names = {}
	for _, m in ipairs(M.list()) do names[#names + 1] = m.name end
	vim.list_extend(names, VERBS)
	return vim.tbl_filter(function(n) return n:sub(1, #arglead) == arglead end, names)
end

function M.setup()
	vim.api.nvim_create_user_command("C", function(opts)
		local args = vim.split(vim.trim(opts.args), "%s+", { trimempty = true })
		local verb = args[1]

		if not verb then return M.pick() end
		if verb == "ls" then return M.pick() end
		if verb == "edit" then return M.edit() end
		if verb == "add" then
			-- `:C! add` bookmarks the current buffer's directory instead.
			local dir = opts.bang and vim.fn.expand("%:p:h") or vim.fn.getcwd()
			return M.add(dir, args[2])
		end
		if PASSTHRU[verb] then
			local out, err = run(args)
			vim.notify(out or ("dirmarks: " .. err),
				out and vim.log.levels.INFO or vim.log.levels.ERROR,
				{ title = "dirmarks" })
			return
		end
		M.goto_mark(verb, { scope = opts.bang and "tcd" or "cd" })
	end, {
		nargs = "*",
		bang = true,
		complete = complete,
		desc = "cd to a named directory (dirmarks)",
	})

	-- `:Ci` — change *inside*: the shell's `ci`, same reasoning (see the
	-- header). Bare `:Ci` picks the container first.
	--
	-- Registered under both `Ci` and `CI` so the shift key can stay down for
	-- the whole command; they are the same handler, not an alias chain.
	local function inside(opts)
		local args = vim.split(vim.trim(opts.args), "%s+", { trimempty = true })
		if not args[1] then return M.pick({ descend = true }) end
		M.pick_children(args[1], tonumber(args[2]))
	end
	local inside_opts = {
		nargs = "*",
		complete = function(arglead, cmdline)
			-- Only the first argument is a bookmark; the second is a depth.
			if cmdline:match("%S+%s+%S*%s+%S*$") then return {} end
			local names = {}
			for _, m in ipairs(M.list()) do names[#names + 1] = m.name end
			return vim.tbl_filter(function(n) return n:sub(1, #arglead) == arglead end, names)
		end,
		desc = "cd inside a named directory (dirmarks)",
	}
	vim.api.nvim_create_user_command("Ci", inside, inside_opts)
	vim.api.nvim_create_user_command("CI", inside, inside_opts)

	vim.keymap.set("n", "<space>j", function() M.pick() end,
		{ desc = "[j]ump to a named directory" })

	-- The data file gets its own filetype (see ftplugin/dirmarks.lua). Matched
	-- by full path so that the `dirmarks` script itself still opens as zsh.
	vim.filetype.add({ filename = { [M.file()] = "dirmarks" } })

	pcall(function()
		local icons = require("noethervim.util").icons
		require("which-key").add({
			{ "<space>j", icon = { icon = icons.folder or "", color = "azure" } },
		})
	end)
end

-- ── the dirmarks buffer (ft=dirmarks) ─────────────────────────────────────

local ns = vim.api.nvim_create_namespace("user.dirmarks")

---Column spans of one buffer line, 1-indexed and inclusive, or nil for a
---comment/blank. The separator is a tab or two spaces — the same rule the
---script parses by — so a path may contain single spaces.
---
---This is the one place the format is understood on the Lua side: the
---picker reads parsed data from the script, but a buffer being edited has
---no file yet, so its columns have to be found here. Everything in this
---file that needs them goes through this function.
---@return { name: integer[], path: integer[]?, note: integer[]? }?
local function columns(line)
	if line:match("^%s*#") or not line:match("%S") then return nil end
	local name_s, name_e = line:find("%S+")
	if not name_s then return nil end

	local path_s = line:find("%S", name_e + 1)
	if not path_s then return { name = { name_s, name_e } } end

	local a = line:find("  ", path_s, true)
	local b = line:find("\t", path_s, true)
	local sep = math.min(a or math.huge, b or math.huge)
	local path_e = sep < math.huge and sep - 1 or #line
	local note_s = sep < math.huge and line:find("%S", path_e + 1) or nil

	return {
		name = { name_s, name_e },
		path = { path_s, path_e },
		note = note_s and { note_s, #line } or nil,
	}
end

---Column highlighting, plus a red path for any directory that isn't there.
---Display-only: `dirmarks check` on :w is the authoritative verdict.
function M.decorate(buf)
	buf = buf or 0
	if not vim.api.nvim_buf_is_valid(buf) then return end
	vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)

	for i, line in ipairs(vim.api.nvim_buf_get_lines(buf, 0, -1, false)) do
		local row = i - 1
		local function mark(span, hl)
			if span and span[2] >= span[1] then
				pcall(vim.api.nvim_buf_set_extmark, buf, ns, row, span[1] - 1,
					{ end_col = span[2], hl_group = hl })
			end
		end

		local col = columns(line)
		if not col then
			if line:match("^%s*#") then mark({ 1, #line }, "Comment") end
		else
			mark(col.name, "Identifier")
			if col.path then
				local abs = vim.fn.expand(line:sub(col.path[1], col.path[2]))
				mark(col.path,
					vim.fn.isdirectory(abs) == 1 and "Directory" or "DiagnosticError")
			end
			mark(col.note, "Comment")
		end
	end
end

---Realign the buffer through the same formatter every writer uses, so the
---file looks identical whether nvim, `c add`, or your fingers last wrote it.
local function format_buffer(buf)
	local exe = bin()
	if not exe then return end
	local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
	local res = vim.system({ exe, "fmt" },
		{ stdin = table.concat(lines, "\n") .. "\n", text = true }):wait()
	if res.code ~= 0 then return end
	local out = vim.split((res.stdout or ""):gsub("\n$", ""), "\n")
	if vim.deep_equal(out, lines) or #out == 0 then return end
	local view = vim.fn.winsaveview()
	vim.api.nvim_buf_set_lines(buf, 0, -1, false, out)
	vim.fn.winrestview(view)
end

---Called from ftplugin/dirmarks.lua.
function M.on_buffer(buf)
	buf = buf or vim.api.nvim_get_current_buf()

	vim.bo[buf].expandtab = true
	vim.bo[buf].commentstring = "# %s"
	vim.opt_local.wrap = false

	M.decorate(buf)

	local group = vim.api.nvim_create_augroup("user_dirmarks_" .. buf, { clear = true })
	vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI", "InsertLeave" }, {
		group = group, buffer = buf,
		callback = function() M.decorate(buf) end,
	})
	vim.api.nvim_create_autocmd("BufWritePre", {
		group = group, buffer = buf,
		callback = function() format_buffer(buf) end,
	})
	vim.api.nvim_create_autocmd("BufWritePost", {
		group = group, buffer = buf,
		callback = function()
			M.decorate(buf)
			local exe = bin()
			if not exe then return end
			vim.system({ exe, "check" }, { text = true }, function(res)
				local msg = vim.trim((res.stderr or "") .. (res.stdout or ""))
				if res.code ~= 0 and msg ~= "" then
					vim.schedule(function()
						vim.notify(msg, vim.log.levels.WARN, { title = "dirmarks" })
					end)
				end
			end)
		end,
	})

	local function under_cursor()
		local line = vim.api.nvim_get_current_line()
		local col = columns(line)
		if not (col and col.path) then return nil end
		return vim.fn.expand(line:sub(col.path[1], col.path[2]))
	end

	vim.keymap.set("n", "<CR>", function()
		local dir = under_cursor()
		if dir then M.cd(dir) end
	end, { buffer = buf, desc = "cd to this directory" })

	vim.keymap.set("n", "gO", function()
		local dir = under_cursor()
		if dir then vim.cmd("edit " .. vim.fn.fnameescape(dir)) end
	end, { buffer = buf, desc = "open this directory (Oil)" })
end

return M

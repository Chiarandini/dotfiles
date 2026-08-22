-- ── textbook results: jump to any definition/theorem in the corpus ────────
--
-- The Neovim half of a pair that must never drift:
--   • shell    `tb`         (~/.config/scripts/tb)
--   • Neovim   `:Textbook`  (this file)
-- Both shell out to $TEXTBOOKS/.eyntka/scripts/results-search.py, which owns
-- the index, the ranking and the "open in Skim" step, so the two front-ends
-- can only differ in their UI — never in what they find or where they land.
--
-- The ranking is a port of the website's command palette (match tier, then
-- position, then result type: definitions before theorems before examples),
-- so the order you learn in the browser is the order you get here.
--
--   :Textbook                  live picker over all ~12k named results
--   :Textbook yoneda lemma     rank and jump straight to the best match
--   :Textbook! yoneda lemma    same, but open the PDF in Skim instead
--   :Textbook -b category-theory yoneda      scope to one book
--   :Textbook -t definition ideal            scope to one result type
--
-- In the picker:
--   <CR>    jump to the LaTeX source
--   <C-p>   open the compiled PDF in Skim at that result (synctex)
--   <C-y>   yank a reference to it — \cref{..} inside its own book,
--           \cite[Title]{NateX} from anywhere else (the backend decides)

local M = {}

-- ── locating the corpus ───────────────────────────────────────────────────

local root_cache = nil

---Absolute path of $TEXTBOOKS, or nil (with one warning).
---A GUI Neovim inherits no shell env, so fall back to sourcing paths.env —
---the same single source of truth the shell reads, rather than a second
---hard-coded copy of the path that would rot when the corpus moves.
---@return string?
function M.root()
	if root_cache ~= nil then
		return root_cache ~= false and root_cache or nil
	end
	local env = os.getenv("TEXTBOOKS")
	if env and env ~= "" and vim.fn.isdirectory(env) == 1 then
		root_cache = env
		return env
	end
	local res = vim.system(
		{ "zsh", "-c", 'source "$HOME/.config/paths.env" 2>/dev/null && printf %s "$TEXTBOOKS"' },
		{ text = true }
	):wait()
	local path = vim.trim(res.stdout or "")
	if path ~= "" and vim.fn.isdirectory(path) == 1 then
		root_cache = path
		return path
	end
	root_cache = false
	vim.notify("textbook: cannot resolve $TEXTBOOKS (see ~/.config/paths.env)", vim.log.levels.ERROR)
	return nil
end

---@return string? backend absolute path to results-search.py
local function backend()
	local root = M.root()
	if not root then return nil end
	local path = root .. "/.eyntka/scripts/results-search.py"
	if vim.fn.filereadable(path) == 0 then
		vim.notify("textbook: backend missing at " .. path, vim.log.levels.ERROR)
		return nil
	end
	return path
end

---The book directory the current buffer lives in, if any. Passed to the
---backend as --from so a reference to the book you are *in* comes out as
---`\cref`, and everything else as a `\cite` carrying the title as locator.
---@return string?
local function current_book()
	local root = M.root()
	local buf = vim.api.nvim_buf_get_name(0)
	if not root or buf == "" then return nil end
	local prefix = root .. "/"
	if buf:sub(1, #prefix) ~= prefix then return nil end
	return buf:sub(#prefix + 1):match("^([^/]+)")
end

---Run the backend synchronously and return stdout, or nil.
---@param args string[]
---@return string?
local function run(args)
	local exe = backend()
	if not exe then return nil end
	local cmd = { "python3", exe }
	vim.list_extend(cmd, args)
	local res = vim.system(cmd, { text = true }):wait()
	if res.code ~= 0 then
		local err = vim.trim(res.stderr or "")
		if err ~= "" then vim.notify("textbook: " .. err, vim.log.levels.WARN) end
		return nil
	end
	return res.stdout
end

-- ── display ───────────────────────────────────────────────────────────────

-- Groups chosen so the three columns stay distinguishable in any colourscheme
-- without inventing new highlights.
local TYPE_HL = {
	definition = "String",
	axiom = "String",
	theorem = "Function",
	proposition = "Function",
	lemma = "Function",
	corollary = "Function",
	conjecture = "WarningMsg",
	example = "Constant",
	aside = "Comment",
}

---@param item table
---@return table[] chunks
local function format_item(item)
	local out = {}
	local function add(text, hl)
		out[#out + 1] = { text, hl }
	end
	add(("%-30s"):format(item.label or ""), "Identifier")
	add(" ", nil)
	add(("%-11s"):format(item.rtype or ""), TYPE_HL[item.rtype] or "Normal")
	add(" ", nil)
	local where = (item.codename or "") .. (item.number ~= "" and (" " .. item.number) or "")
	add(("%-26s"):format(where), "Comment")
	add(" ", nil)
	add(item.title or "", "Normal")
	return out
end

-- ── the picker ────────────────────────────────────────────────────────────

---@param opts? { book?: string, type?: string, query?: string }
function M.pick(opts)
	opts = opts or {}
	local exe = backend()
	local root = M.root()
	if not exe or not root then return end
	local from = current_book()

	-- Ensure the cache is current ONCE, before the picker opens. Every finder
	-- call below passes --no-refresh, so a keystroke costs only the ~70ms
	-- search and never the staleness sweep over ~2000 files.
	run({ "--ensure" })

	Snacks.picker({
		title = "Textbook results",
		-- `live` hands each keystroke to the finder instead of filtering
		-- locally, and `fuzzy = false` + sorting on `idx` keeps the backend's
		-- order intact — re-ranking here is exactly the drift this design is
		-- meant to prevent.
		live = true,
		supports_live = true,
		matcher = { fuzzy = false, sort_empty = false },
		sort = { fields = { "idx" } },
		preview = "file",
		format = format_item,
		finder = function(_, ctx)
			local args = { exe, "--no-refresh", "--tsv", "--limit", "200" }
			if opts.book then vim.list_extend(args, { "--book", opts.book }) end
			if opts.type then vim.list_extend(args, { "--type", opts.type }) end
			vim.list_extend(args, { "--", ctx.filter.search or "" })
			return require("snacks.picker.source.proc").proc(
				ctx:opts({
					cmd = "python3",
					args = args,
					notify = false,
					transform = function(item)
						local f = vim.split(item.text, "\t", { plain = true })
						if #f < 8 then return false end
						item.book, item.label, item.rtype = f[1], f[2], f[3]
						item.codename, item.number = f[4], f[5]
						item.file = root .. "/" .. f[6]
						item.pos = { tonumber(f[7]) or 1, 0 }
						item.title = f[8]
						-- `text` is what snacks would match on; with fuzzy off
						-- it is display/debug only, but keep it meaningful.
						item.text = f[8] .. " " .. f[2]
					end,
				}),
				ctx
			)
		end,
		actions = {
			textbook_pdf = function(_, item)
				if not item then return end
				run({ "--no-refresh", "--pdf", item.label, "--book", item.book })
			end,
			textbook_yank = function(_, item)
				if not item then return end
				local args = { "--no-refresh", "--ref", item.label, "--book", item.book }
				if from then vim.list_extend(args, { "--from", from }) end
				local ref = run(args)
				if not ref or ref == "" then return end
				vim.fn.setreg('"', ref)
				vim.fn.setreg("+", ref)
				vim.notify("yanked  " .. ref)
			end,
		},
		win = {
			input = {
				keys = {
					["<c-p>"] = { "textbook_pdf", mode = { "n", "i" } },
					["<c-y>"] = { "textbook_yank", mode = { "n", "i" } },
				},
			},
			list = {
				keys = {
					["p"] = "textbook_pdf",
					["y"] = "textbook_yank",
				},
			},
		},
	})
end

-- ── the direct jump ───────────────────────────────────────────────────────

---Rank `query` and act on the single best match.
---@param query string
---@param opts? { book?: string, type?: string, pdf?: boolean }
function M.jump(query, opts)
	opts = opts or {}
	local root = M.root()
	if not root then return end

	local args = { "--json", "--limit", "1" }
	if opts.book then vim.list_extend(args, { "--book", opts.book }) end
	if opts.type then vim.list_extend(args, { "--type", opts.type }) end
	vim.list_extend(args, { "--", query })

	local out = run(args)
	if not out then return end
	local ok, hits = pcall(vim.json.decode, out)
	if not ok or type(hits) ~= "table" or #hits == 0 then
		vim.notify("textbook: no result for " .. query, vim.log.levels.WARN)
		return
	end
	local e = hits[1]

	if opts.pdf then
		run({ "--no-refresh", "--pdf", e.label, "--book", e.book })
		vim.notify(("%s  %s — %s"):format(e.label, e.titlePlain, e.codename))
		return
	end

	vim.cmd.edit(vim.fn.fnameescape(root .. "/" .. e.file))
	local line = math.min(tonumber(e.line) or 1, vim.api.nvim_buf_line_count(0))
	vim.api.nvim_win_set_cursor(0, { line, 0 })
	vim.cmd("normal! zz")
	vim.notify(("%s  %s — %s"):format(e.label, e.titlePlain, e.codename))
end

-- ── :Textbook ─────────────────────────────────────────────────────────────

---Split `-b BOOK` / `-t TYPE` off the front; everything else is the query.
---@param argstr string
---@return { book?: string, type?: string }, string
local function parse(argstr)
	local opts, words = {}, vim.split(vim.trim(argstr), "%s+")
	local i = 1
	while i <= #words do
		local w = words[i]
		if (w == "-b" or w == "--book") and words[i + 1] then
			opts.book, i = words[i + 1], i + 2
		elseif (w == "-t" or w == "--type") and words[i + 1] then
			opts.type, i = words[i + 1], i + 2
		else
			break
		end
	end
	return opts, table.concat(words, " ", i)
end

vim.api.nvim_create_user_command("Textbook", function(a)
	local opts, query = parse(a.args)
	if query == "" then
		M.pick(opts)
	else
		opts.pdf = a.bang
		M.jump(query, opts)
	end
end, {
	nargs = "*",
	bang = true,
	desc = "Find a definition/theorem in $TEXTBOOKS (no args: picker; ! opens the PDF)",
})

return M

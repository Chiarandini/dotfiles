-- Local dev override for smart-actions.nvim.
-- Uses the local working tree instead of the GitHub clone, so iterations
-- don't require a push → :Lazy update round-trip.
--
-- Also registers a NoetherVim-specific context provider so grA prompts
-- are aware of bundle conventions when working inside this distribution.
--
-- Delete this file (or rename the dir) to fall back to the GitHub clone.

-- ─── Status-report popup ──────────────────────────────────────────────
-- Opens a floating window showing in-flight smart-actions requests
-- (scope, category, provider, elapsed, time-to-first-byte, bytes
-- received). Refreshes every 500ms while open; `c` cancels the active
-- request; `q`/<Esc> close.

local function format_elapsed(ms)
	if ms < 1000 then return string.format("%dms", ms) end
	return string.format("%.1fs", ms / 1000)
end

local function render_lines(requests)
	local lines = { "  smart-actions — in-flight requests", "" }
	if #requests == 0 then
		lines[#lines + 1] = "  (no requests in flight)"
		lines[#lines + 1] = ""
		lines[#lines + 1] = "  q / <Esc>: close"
		return lines
	end
	local now = (vim.uv or vim.loop).now()
	for i, r in ipairs(requests) do
		if i > 1 then lines[#lines + 1] = "" end
		local relfile = r.file ~= "" and vim.fn.fnamemodify(r.file, ":.") or "[nofile]"
		local pos = ""
		if r.cursor_row then
			pos = string.format(":%d:%d", r.cursor_row + 1, (r.cursor_col or 0) + 1)
		end
		lines[#lines + 1] = string.format("  scope     %s", r.scope_label)
		lines[#lines + 1] = string.format("  file      %s%s", relfile, pos)
		lines[#lines + 1] = string.format("  category  %s", r.category_id)
		lines[#lines + 1] = string.format("  provider  %s", r.provider_id)
		lines[#lines + 1] = string.format("  state     %s", r.state)
		lines[#lines + 1] = string.format("  elapsed   %s", format_elapsed(now - r.started_at))
		if r.first_chunk_at then
			lines[#lines + 1] = string.format("  ttfb      %s", format_elapsed(r.first_chunk_at - r.started_at))
			lines[#lines + 1] = string.format("  received  %d bytes", r.bytes)
		else
			lines[#lines + 1] = "  ttfb      (awaiting first byte)"
		end
	end
	lines[#lines + 1] = ""
	lines[#lines + 1] = "  q / <Esc>: close    c: cancel request"
	return lines
end

local function show_status()
	local ok, status = pcall(require, "smart_actions.status")
	if not ok then
		vim.notify("[smart-actions] status module unavailable — plugin older than this config",
			vim.log.levels.WARN)
		return
	end

	local buf = vim.api.nvim_create_buf(false, true)
	vim.bo[buf].bufhidden = "wipe"
	vim.bo[buf].filetype = "smart-actions-status"

	local function redraw()
		local lines = render_lines(status.list())
		vim.bo[buf].modifiable = true
		vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
		vim.bo[buf].modifiable = false
		return #lines
	end

	local height = math.max(6, redraw())
	local width  = 56
	local win = vim.api.nvim_open_win(buf, true, {
		relative  = "editor",
		width     = width,
		height    = height,
		row       = math.max(1, math.floor((vim.o.lines - height) / 2)),
		col       = math.max(1, math.floor((vim.o.columns - width) / 2)),
		style     = "minimal",
		border    = "rounded",
		title     = " smart-actions ",
		title_pos = "center",
	})

	local closed = false
	local timer
	local function close()
		if closed then return end
		closed = true
		if timer then pcall(function() timer:stop(); timer:close() end) end
		if vim.api.nvim_win_is_valid(win) then
			vim.api.nvim_win_close(win, true)
		end
	end

	vim.keymap.set("n", "q",     close, { buffer = buf, nowait = true, silent = true })
	vim.keymap.set("n", "<Esc>", close, { buffer = buf, nowait = true, silent = true })
	vim.keymap.set("n", "c", function()
		require("smart_actions").cancel()
		redraw()
	end, { buffer = buf, nowait = true, silent = true, desc = "cancel smart-actions request" })

	timer = vim.uv.new_timer()
	timer:start(500, 500, vim.schedule_wrap(function()
		if closed or not vim.api.nvim_win_is_valid(win) then
			close()
			return
		end
		redraw()
	end))
end

-- Register a richer busy-component override that also wires click →
-- status popup. Last-write-wins: this loads after the distro bundle, so
-- it takes priority over the label/colour-only override there.
pcall(function()
	local sl = require("noethervim.statusline")
	if not sl.register_busy_override then return end
	sl.register_busy_override(function()
		local ok, status = pcall(require, "smart_actions.status")
		if not ok then return nil end
		local rec = status.current()
		if not rec then return nil end
		local palette = require("noethervim.util.palette").resolve()
		return {
			label    = rec.state == "pending" and "ai…" or "ai",
			hl       = { fg = palette.purple or "#c678dd", bold = true },
			on_click = show_status,
		}
	end)
end)

return {
	{
		"Chiarandini/smart-actions.nvim",
		dir = vim.fn.expand("~/programming/custom_plugins/smart-actions.nvim"),
		opts = {
			-- Opt-in speculative run: quickfix starts in background when an
			-- explain stream finishes, so `a`/<CR> in the float opens the
			-- picker with minimal wait. Dismiss (`q`/<Esc>) cancels it.
			-- Trade-off: ~2× token cost whenever the explain is dismissed
			-- before the background quickfix completes. See
			-- |smart-actions-eager|.
			eager_action_after_explain = true,
			max_payload_chars = 60000,
			context = { max_chars = 8000 },
			-- Pin plugin requests to Sonnet 4.6 — faster than Opus for
			-- scope-bounded edits, leaves the global Claude Code /model
			-- alone for chat.
			provider_config = {
				claude_code = { extra_args = { "--model", "claude-sonnet-4-6" } },
				anthropic   = { model = "claude-sonnet-4-6" },
			},
		},
		 keys = {
			{ "grA", mode = { "n", "x" }, desc = "smart code [A]ction" },
			{ "grE", function() require("smart_actions").explain()  end, desc = "smart action: [E]xplain" },
			{ "grS", function() require("smart_actions").suppress() end, desc = "smart action: [S]uppress diagnostic" },
			{ "grR", function() require("smart_actions").refactor() end, desc = "smart action: [R]efactor" },
			{ "grT", function() require("smart_actions").tests()    end, desc = "smart action: generate [T]est" },
			{ "grV", function() require("smart_actions").review()   end, desc = "smart action: re[V]iew" },
		  },
		config = function(_, opts)
			require("smart_actions").setup(opts)
			require("smart_actions.context").register({
				id       = "noethervim",
				priority = 200,
				detect   = function(root)
					return vim.uv.fs_stat(root .. "/lua/noethervim/init.lua") ~= nil
				end,
				gather = function(_)
					return table.concat({
						"You are working on the NoetherVim distribution.",
						"Bundles live at lua/noethervim/bundles/ (lazy.nvim specs).",
						"When adding a bundle, also update: inspect.lua,",
						"init.lua.example, doc/noethervim.txt, README.md.",
						"Architecture principles: minimal abstraction, opts-first,",
						"last-write-wins, update safety.",
					}, "\n")
				end,
			})
		end,
	},
}

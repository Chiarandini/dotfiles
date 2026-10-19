-- Neovim 0.12 leaks memory when diagnostics are set on an unloaded buffer: each
-- vim.diagnostic.set() and each display handler registers a new BufRead autocmd
-- that holds that call's diagnostics, and none are dropped until the buffer is
-- read. texlab republishing diagnostics for an unopened .bib grew one nvim to
-- 14 GB. Fixed upstream in 0.13 (neovim#40869), not backported to 0.12. This
-- keeps only the newest pending callback per buffer, call site and namespace.
if vim.fn.has("nvim-0.13") == 1 then
	return
end

local set = vim.diagnostic.set
local idx
for i = 1, math.huge do
	local name = debug.getupvalue(set, i)
	if name == nil then
		return
	end
	if name == "once_buf_loaded" then
		idx = i
		break
	end
end

local pending = {} ---@type table<string, integer>

local function key(bufnr, fn)
	local parts = { bufnr, debug.getinfo(fn, "S").linedefined }
	for i = 1, math.huge do
		local name, value = debug.getupvalue(fn, i)
		if name == nil then
			break
		end
		if name == "namespace" or name == "ns" or name == "autocmd_key" then
			parts[#parts + 1] = tostring(value)
		end
	end
	return table.concat(parts, ":")
end

debug.setupvalue(set, idx, function(bufnr, fn)
	if vim.api.nvim_buf_is_loaded(bufnr) then
		fn()
		return
	end
	local k = key(bufnr, fn)
	if pending[k] then
		pcall(vim.api.nvim_del_autocmd, pending[k])
	end
	local id
	id = vim.api.nvim_create_autocmd("BufRead", {
		buf = bufnr,
		once = true,
		callback = function()
			if pending[k] == id then
				pending[k] = nil
			end
			fn()
		end,
	})
	pending[k] = id
end)

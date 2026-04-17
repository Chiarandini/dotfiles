-- Generic LuaSnip helper functions for non-tex snippets.
-- LaTeX-specific helpers live in noethervim-tex.luasnip_helper.

local ls = require("luasnip")
local sn = ls.snippet_node
local t  = ls.text_node
local i  = ls.insert_node

local M = {}

--- Returns the visual selection as a text node, or an empty insert node.
function M.get_visual_node(args, parent)
	if #parent.snippet.env.LS_SELECT_RAW > 0 then
		return sn(nil, t(parent.snippet.env.LS_SELECT_RAW))
	else
		return sn(nil, i(1))
	end
end

--- Returns the visual selection as an editable insert node, or an empty one.
function M.get_visual_insert_node(args, parent)
	if #parent.snippet.env.LS_SELECT_RAW > 0 then
		return sn(nil, i(1, parent.snippet.env.LS_SELECT_RAW))
	else
		return sn(nil, i(1))
	end
end

--- Condition: cursor is at the start of a line (only whitespace before it).
function M.line_start(_, _)
	return (vim.api
		.nvim_get_current_line()
		:sub(1, vim.api.nvim_win_get_cursor(0)[2])
		:gsub('%w*', '')
		:match('^$') ~= nil)
end

return M

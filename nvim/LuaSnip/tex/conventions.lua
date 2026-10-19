---@diagnostic disable: undefined-global, unused-local
-- Snippets that depend on this config's preamble conventions.
--
-- These shipped in noethervim-tex until its always-on set was reduced to what
-- compiles in any LaTeX document. Both emit something only ~/.config/nvim/
-- preamble/ declares: `equivEnumerate` with its `\Rw` arrow, and the
-- `\placeholder` marker. That makes them mine rather than the plugin's.
--
-- Everything they need comes from the plugin's public helper API, so this
-- file is also the working example of a personal snippet file sitting
-- alongside a plugin's own.
local ls = require("luasnip")
local s = ls.snippet
local t = ls.text_node
local d = ls.dynamic_node
local fmta = require("luasnip.extras.fmt").fmta
local helper = require("noethervim-tex.luasnip_helper")

return
--  ┌                                                          ┐
--  │                     manual triggers                      │
--  └                                                          ┘
{
	s(
		{ trig = "ph", wordTrig = true, name = "place holder" },
		t("\\placeholder"),
		{
			show_condition = helper.at_line_start,
		}
	),
},
--  ┌                                                          ┐
--  │                       autotriggers                       │
--  └                                                          ┘
{
	s(
		{ trig = "EEE", name = "equivEnumerate" },
		fmta(
			[[
			\begin{equivEnumerate}
				\item[($\Rw$)] <>
			\end{equivEnumerate}
			]],
			{ d(1, helper.get_visual_insert_node) }
		)
	),
}

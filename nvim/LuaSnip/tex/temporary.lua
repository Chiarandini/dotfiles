---@diagnostic disable: undefined-global, unused-local
-- Personal tex snippets (moved from noethervim-tex plugin)
local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local d = ls.dynamic_node
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local rep = require("luasnip.extras").rep
local line_begin = require("luasnip.extras.expand_conditions").line_begin
local helper = require('noethervim-tex.luasnip_helper')
local get_visual = helper.get_visual_node
local get_visual_insert = helper.get_visual_insert_node
local tex_utils = helper.tex_utils


return
{

},
{
	s({trig = 'HRR', snippetType = 'autosnippet', name='Hirzebruch Riemann Roch'},
		{
			t({ [[Hirzebruch Riemann Roch]] })
		}
	),

	s('bcorm', {t('by compatibility of Riemann metric')},{} ),

	s({trig = 'GRR', snippetType = 'autosnippet', name='Grothendieck Riemann Roch'},
		{
			t({ [[Grothendieck Riemann Roch]] })
		}
	),
	s(
		{ trig = "cc", dscr = "\\code" },
		fmta([[
		\code{<>}<>
		]], {
			d(1, get_visual_insert),
			i(0),
		})),

	s({trig='COM', dscr='comment'}, fmta([[
	\textcolor{red}{<> -- <>}
	]],
	{
		d(1, get_visual_insert),
		f(function()
			return os.date()
		end)
	}) ),

	-- Personal typo corrections (shift-comma → comma, shift-dot → dot)
	s(
		{trig = "<", name ="shift comma"},
		{t(",")},
		{
			condition = tex_utils.in_text
		}
	),
	s(
		{trig = ">", name ="shift dot"},
		{t(".")},
		{
			condition = tex_utils.in_text
		}
	),

	-- Personal debugging marker
	s(
		{trig = 'RRR', name = 'ref:HERE'},
		t('\\textcolor{red}{ref:HERE}')
	),
}

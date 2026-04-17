local ls = require("luasnip")
local s = ls.snippet
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local d = ls.dynamic_node
local sn = ls.snippet_node
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local helper = require('user.utils.luasnip-helper-func')
local get_visual = helper.get_visual_node
local line_begin = require("luasnip.extras.expand_conditions").line_begin

--
-- snippet box "Box"
-- `!p snip.rv = '┌' + '─' * (len(t[1]) + 2) + '┐'`
-- │ $1 │
-- `!p snip.rv = '└' + '─' * (len(t[1]) + 2) + '┘'`
-- $0
-- endsnippet

local function CreateUpperBox(
	args,  -- text from i(2) in this example i.e. { { "456" } }
	parent, -- parent snippet or parent node
	user_args -- user_args from opts.user_args
)
	return "-- ┌" .. string.rep('─', string.len(args[1][1])+2) .. "┐"
end

local function CreateLowerBox(
	args,  -- text from i(2) in this example i.e. { { "456" } }
	parent, -- parent snippet or parent node
	user_args -- user_args from opts.user_args
)
	return "-- └" .. string.rep('─', string.len(args[1][1])+2) .. "┘"
end


return { --manual snippets
	s(
		"snipt",
		fmt( [[ <>(<>, {t('<>')}<> <>)<>,]],
			{
				c(1, { t("s"), t("autosnippet") }),
				c(2, { i(nil, "trig"), sn(nil, { t("{trig='"), i(1), t("'}") }) }),
				i(3, "text"),
				i(4, "opts"),
				i(5),
				i(0),
			},
			{ delimiters = "<>" }
		)
	),
	s(
		"keymap",
		{ t("vim.keymap.set("), i(1, "mode"), t(", "), i(2, "lhs"), t(", "), i(3, "rhs"), t(", "), i(4, "opts"), t(" )") }
	),

		-- { trig = "i", wordTrig = true, name = 'italic'},
	s({trig='func', name='create function', description='create function'},
		fmta([[
		function(<>)
			<>
		end<>
		]],
		{
			i(1),
			d(2, get_visual),
			i(0)
		})
	),
	s("Box", {
		f(
			CreateUpperBox,                          -- callback (args, parent, user_args) -> string
			{ 1 },                       -- node indice(s) whose text is passed to fn, i.e. i(2)
			{} -- opts
		),
		t({ '','-- │ ' }), i(1), t({ ' │', '' }),
		f(
			CreateLowerBox,
			{1},
			{}
		),
		t({ '','' }),
		i(0)
		},
		{condition = line_begin}
	),

	-- s(
	-- 	'Box',
	-- 	{
	-- 		f(function(args, snip)
	-- 			local res, env = {}, snip.env
	-- 			table.insert(res, "Selected Text (current line is " .. env.TM_LINE_NUMBER .. "):")
	-- 			for _, ele in ipairs(env.LS_SELECT_RAW) do
	-- 				table.insert(res, ele)
	-- 			end
	-- 			return res
	-- 		end, {})
	-- 	}
	-- )
}, { --auto-snippets
	-- here
}

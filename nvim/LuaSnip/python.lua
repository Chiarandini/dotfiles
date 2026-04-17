---@diagnostic disable: unused-local
local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local isn = ls.indent_snippet_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local d = ls.dynamic_node
local r = ls.restore_node
local events = require("luasnip.util.events")
local ai = require("luasnip.nodes.absolute_indexer")
local extras = require("luasnip.extras")
local l = extras.lambda
local rep = extras.rep
local p = extras.partial
local m = extras.match
local n = extras.nonempty
local dl = extras.dynamic_lambda
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local conds = require("luasnip.extras.expand_conditions")
local postfix = require("luasnip.extras.postfix").postfix
local types = require("luasnip.util.types")
local parse = require("luasnip.util.parser").parse_snippet
local helper = require('user.utils.luasnip-helper-func')
local get_visual = helper.get_visual_node
local get_visual_insert = helper.get_visual_insert_node

return
{ -- manual snippets
	s(
		{trig = 'initmain', wordtrig = 'true', name = 'if init == main'},
		fmta(
		[[
		if __name__ == "__main__":
			<>
		]],
		{
			i(0)
		}
		),
		{
			show_condition = helper.line_start
		}
	),
	s(
		{trig = 'var', wordtrig = 'true', name = 'create variable'},
		fmta(
		[[
		# <>
		<>
		]],
		{
			i(1, '[DESCRIPTION]'),
			i(0),
			-- d(0, get_visual_insert)
		}
		),
		{}
	),
	s(
		{trig = 'try', wordtrig = 'true', name = 'if init == main'},
		fmta(
		[[
		try:
			<>
		except:
			<>
		]],
		{
			d(1, get_visual_insert),
			i(0,'pass')
		}
		),
		{}
	),
	s(
		{trig = 'namemain', wordtrig = 'true', name = 'if init == main'},
		fmta(
		[[
		if __name__ == "__main__":
			<>
		]],
		{
			i(0)
		}
		),
		{
			show_condition = helper.line_start
		}
	),
	  postfix(".if", {
			  l("if " .. l.POSTFIX_MATCH .. ":"),
			  t({"", "\t"})
	  }),
	  postfix(".p", {
			  l("print(" .. l.POSTFIX_MATCH .. ")"),
	  }),
	  postfix(".str", {
			  l("str(" .. l.POSTFIX_MATCH .. ")"),
	  }),
	s(
		{trig = 'elif', wordtrig = 'true', name = 'elif:'},
		fmta(
		[[
		elif <>:
			<>
		]],
		{
			i(1),
			i(0)
		}
		),
		{
		}
	),
	s(
		{trig = 'if', wordtrig = 'true', name = 'elif:'},
		fmta(
		[[
		if <>:
			<>
		]],
		{
			i(1),
			i(0)
		}
		),
		{
			helper.line_start
		}
	),
	s(
		{trig = 'else', wordtrig = 'true', name = 'else:'},
		fmta(
		[[
		else:
			<>
		]],
		{
			i(0)
		}
		),
		{
			helper.line_start
		}
	),
	s(
		{trig = 'def', wordtrig = 'true', name = 'method'},
		fmt(
		[[
		def {}({}){}:
			{}
		]],
		{
			i(1),
			i(2),
			c(3, {
				i(1),
				sn( nil,
				{
					t(' -> '),
					i(1),
					t(':')
				})
			}),
			d(4, get_visual_insert)
		}
		),
		{
			helper.line_start
		}
	),
	s({trig = 'while', wordtrig='true', name = 'create while loop'},
		fmt(
		[[
		while {}:
			{}
		]],
		{
			i(1),
			i(0)
		}
		)
	),
	s(
		{trig = 'class', wordtrig = 'true', name = 'create object'},
		fmt(
		[[
		class {}{}:
			# NOTE: Don't forget to generate doc by doing <leader>c on the class name.


			def __init__(self, {}):
				{}

			def __str__(self):
				{}
		]],
		{
			i(1, 'Name'),
			i(2, '(extends)'),
			i(3),
			i(4),
			i(0, 'print(self.__dict__)'),
		}
		),
		{
			helper.line_start
		}
	),
	s(
		{trig = 'for', wordtrig = 'true', name = 'for loop'},
		fmta(
		[[
		for <> in <>:
			<>
		]],
		{
			c(1, {
				i(1, 'i'),
				i(1, 'j'),
				i(1, 'key'),
			}),
			c(2, {
				r(1, ''),
				sn( nil,
				{
					t('range(1,'),
					r(1,''),
					t(')')
				})
			}),
			i(0)
		}
		),
		{
			helper.line_start
		}
	),
	-- {todo_comment_snippets, { type = 'snippets', key = 'todo_comments' }},

}

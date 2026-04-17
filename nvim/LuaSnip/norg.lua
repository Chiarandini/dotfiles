local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local t = ls.text_node
local c = ls.choice_node
local i = ls.insert_node
local f = ls.function_node
local d = ls.dynamic_node
local fmta = require("luasnip.extras.fmt").fmta
local helper = require('user.utils.luasnip-helper-func')
local get_visual = helper.get_visual_node

return {
	s(
		'@code',
		{t'@code', i(1, 'language'), t({'',''}), i(0), t({'', '@end'})}
	),
	-- italic
	s(
		{ trig = "i", wordTrig = true, name = 'italic'},
		fmta("/<>/", {
			d(1, get_visual),
		})),
	-- bold
	s(
		{ trig = "b", wordTrig = true, name = 'bold'},
		fmta("*<>*", {
			d(1, get_visual),
		})),
	-- image
	s(
		{ trig = "@image", wordTrig = true, name = 'iamge'},
		fmta(
			[[
			@image <>
			<>
			@end
			]],
			{
				c(1, {
					t('png'),
					t('svg'),
					t('jpg'),
				}),
			d(2, get_visual),
			}
		)
	),
},
{
	s({trig =' nn', wordTrig= false}, {t(' neural network')} ),
	s({trig =' NN', wordTrig= false}, {t(' Neural network')} ),
	s({trig =' ppl', wordTrig= false}, {t(' people')} ),
	s({trig =' bc', wordTrig= false}, {t(' because')} ),
	s({trig ='idk', wordTrig= false}, {t("I don't konw")} ),
}

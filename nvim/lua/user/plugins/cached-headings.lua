-- EYNTKA textbooks define \bonuschapter, \bonussection, \bonussubsection
-- (.eyntka/shared_preamble.tex) as wrappers around the standard commands.

return {
	{
		"Chiarandini/snacks-cached-headings.nvim",
		opts = {
			latex_headings = {
				bonuschapter    = 2,
				bonussection    = 3,
				bonussubsection = 4,
			},
		},
	},
}

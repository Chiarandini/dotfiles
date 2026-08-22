-- Dev override for noethervim-tex.
-- nvdn (vim.g.noethervim_dev set): loads the local working tree from
-- ~/programming/nvim-plugins/ via lazy's dev.path.
-- Plain nvim: uses the GitHub clone, so unpushed local work surfaces as
-- missing -- exactly like production.  Set `dev = true` to opt in.

return {
	{
		"Chiarandini/NoetherVim-Tex",
		dev = vim.g.noethervim_dev ~= nil,
		opts = {
			-- Both default off in the plugin, because they only make sense
			-- against a preamble the reader may not have (conventions) or a
			-- vocabulary that is not theirs (acronyms). Both are mine.
			snippets = { conventions = true, acronyms = true },
			-- Swap the two paragraph objects: `ip` becomes the writing
			-- paragraph and `ig` keeps the plain blank-line one. `vip` is the
			-- motion my hands already know, and in a tex document
			-- blank-line-only boundaries are wrong far more often than they
			-- are right -- but the old behavior is still one key away when a
			-- paragraph really does run through an equation.
			--
			-- Note `iP`/`aP` is vimtex's section object, so it is not the
			-- place to put the displaced paragraph.
			paragraph = { override_paragraph = true },
		},
	},
}

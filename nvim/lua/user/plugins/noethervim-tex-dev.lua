-- Dev override for noethervim-tex.
-- nvdn (vim.g.noethervim_dev set): loads the local working tree from
-- ~/programming/nvim-plugins/ via lazy's dev.path.
-- Plain nvim: uses the GitHub clone, so unpushed local work surfaces as
-- missing -- exactly like production.  Set `dev = true` to opt in.

return {
	{
		"Chiarandini/NoetherVim-tex",
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
			-- The abbreviations that shorten an auto-generated label:
			-- "Cohomology" to "Cohom", and seventy more. The plugin ships
			-- none, because that is a writing style rather than anything
			-- LaTeX requires, so the vocabulary lives here.
			ref_tag = require("user.configs.tex_ref_tag"),
			-- Acronyms title-casing would otherwise render "Dvr", "Pid",
			-- "Ufd". Only DVR was handled before, and only in the title;
			-- PID and UFD were repaired in the generated label but not in
			-- the name the reader sees.
			titlecase = { acronyms = { "DVR", "PID", "UFD" } },
			-- Fills `<<author>>` in the preamble templates, for :NoetherTexNew
			-- and WebsiteTools alike.
			preamble = { vars = { author = "Nathanael Chwojko-Srawley" } },
		},
	},
}

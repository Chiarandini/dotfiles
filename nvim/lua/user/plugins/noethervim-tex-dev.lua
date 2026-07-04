-- Local dev override for noethervim-tex.
-- Uses the local working tree instead of the GitHub clone, so iterations
-- don't require a push -> :Lazy update round-trip.
--
-- Delete this file (or rename the dir) to fall back to the GitHub clone.

return {
	{
		"Chiarandini/NoetherVim-Tex",
		dir = vim.fn.expand("~/programming/nvim-plugins/noethervim-tex"),
	},
}

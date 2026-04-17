-- Removed from NoetherVim distribution (too niche for public distro).

return {
	{ "dundalek/bloat.nvim", cmd = "Bloat" },
	{
		"aikhe/wrapped.nvim",
		dependencies = { "nvzone/volt" },
		cmd          = "WrappedNvim",
		opts         = {},
	},
}

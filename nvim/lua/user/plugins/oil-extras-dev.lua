-- Dev override for oil-extras.
-- nvdn (vim.g.noethervim_dev set): loads the local working tree from
-- ~/programming/nvim-plugins/ via lazy's dev.path.
-- Plain nvim: uses the GitHub clone, so unpushed local work surfaces as
-- missing, exactly like production.

return {
	{ "Chiarandini/oil-extras.nvim", dev = vim.g.noethervim_dev ~= nil },
}

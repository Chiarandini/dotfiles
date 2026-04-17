-- Arcade games removed from NoetherVim distribution.
-- Training-focused games (vim-be-good, speedtyper, typr) remain
-- in the distro as the "training" bundle.

return {
	{ "alec-gibson/nvim-tetris",   cmd = "Tetris" },
	{
		"alanfortlink/blackjack.nvim",
		cmd          = "BlackJackNewGame",
		dependencies = { "nvim-lua/plenary.nvim" },
	},
	{
		"jim-fx/sudoku.nvim",
		cmd    = "Sudoku",
		config = true,
	},
	{ "seandewar/nvimesweeper",    cmd = "Nvimesweeper" },
	{
		"seandewar/killersheep.nvim",
		cmd    = "KillKillKill",
		opts = {
			gore    = false,
			keymaps = {
				move_left  = "h",
				move_right = "l",
				shoot      = "<Space>",
			},
		},
	},
	{
		"rktjmp/playtime.nvim",
		cmd    = "Playtime",
		config = true,
	},
	{ "efueyo/td.nvim",                        cmd = "TDStart" },
	{ "rhysd/vim-syntax-christmas-tree",       cmd = "MerryChristmas" },
	{ "vuciv/golf",                            cmd = "GolfToday" },
}

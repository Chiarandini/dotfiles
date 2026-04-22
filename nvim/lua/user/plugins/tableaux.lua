-- Personal opts for the noethervim-tableaux bundle.
-- The bundle (lua/noethervim/bundles/tableaux.lua in NoetherVim) handles
-- installation; this spec just deep-merges personal config into it.
--
-- For local plugin development, set `dev = true` here and lazy will load the
-- working tree at ~/programming/custom_plugins/noethervim-tableaux/ instead
-- of the GitHub clone.
return {
	"Chiarandini/noethervim-tableaux",
	-- dev = true,
	opts = {
		quotes = require("user.data.math_quotes"),
		vault  = {
			path      = "~/Documents/NateObsidianVault/",
			today_cmd = ":ObsidianToday",
		},
	},
}

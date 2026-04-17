-- Archive the task's metadata + output on completion.
-- Paired with lua/user/configs/overseer-history.lua.

return {
	desc = "Archive task metadata + captured output to disk on completion",
	constructor = function()
		return {
			on_complete = function(_, task, status)
				pcall(function()
					require("user.configs.overseer-history").archive(task, status)
				end)
			end,
		}
	end,
}

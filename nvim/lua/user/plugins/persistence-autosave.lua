-- persistence.nvim saves the session on exit only (see NoetherVim
-- lua/noethervim/plugins/persistence.lua). A crash means nvim never exits, so
-- nothing is written: that is exactly how the open buffers were lost on
-- 2026-08-29. Save periodically and on write instead, so the worst case is
-- losing the last couple of minutes.
--
-- tmux-resurrect reopens these sessions through the `nvs` shell function.
return {
	"folke/persistence.nvim",
	init = function()
		local function save()
			pcall(function()
				require("persistence").save()
			end)
		end

		vim.api.nvim_create_autocmd({ "BufWritePost", "FocusLost" }, {
			group = vim.api.nvim_create_augroup("user_persistence_autosave", { clear = true }),
			callback = save,
		})

		local timer = vim.uv.new_timer()
		timer:start(120000, 120000, vim.schedule_wrap(save))

		vim.api.nvim_create_autocmd("VimLeavePre", {
			group = "user_persistence_autosave",
			callback = function()
				pcall(function()
					timer:stop()
					timer:close()
				end)
			end,
		})
	end,
}

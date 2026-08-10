-- Personal smart-enter.nvim rules, and the local dev-tree override. The
-- plugin, its global <S-CR>, and the markdown/latex presets come from
-- NoetherVim core (plugins/editing.lua) and the latex bundle. This fragment
-- only adds personal rules and, under nvdn, loads the local working tree.

-- Continue a line comment on <S-CR>: read the leader from 'commentstring',
-- repeat it on the next line, and clear the line (exit) when the comment is
-- empty. Line comments only. Applied to every filetype via the ["*"] entry, so
-- <CR> can stay plain (formatoptions without "r") while <S-CR> continues a
-- comment on demand.
local comment_rule = {
	match = function(ctx)
		local cs = vim.bo[ctx.buf].commentstring or ""
		local lead = cs ~= "" and cs:match("^%s*(.-)%s*%%s") or nil
		if not lead then
			return nil
		end
		lead = vim.trim(lead)
		if lead == "" then
			return nil
		end
		if ctx.line:gsub("^%s*", ""):sub(1, #lead) == lead then
			return { lead = lead }
		end
		return nil
	end,
	handle = function(ctx, m)
		local indent = ctx.line:match("^(%s*)")
		local rest = ctx.line:match("^%s*" .. vim.pesc(m.lead) .. "%s*(.-)%s*$")
		if rest == nil or rest == "" then
			ctx.replace_line(indent) -- empty comment line -> stop commenting
		else
			ctx.split("", indent .. m.lead .. " ")
		end
	end,
}

return {
	{
		"Chiarandini/smart-enter.nvim",
		dev = vim.g.noethervim_dev ~= nil,
		opts = {
			filetypes = {
				tex = {
					rules = {
						-- Exercise and Answer entries are \Question.
						{ envs = { "Exercise", "Answer" }, item = "\\Question " },
						-- An equivalence list of right arrow entries.
						{ env = "equivEnumerate", item = "\\item[($\\Rw$)] " },
						-- A lettered steps list, a) then b) then c).
						{ env = "steps", item = { text = "\\item[{})] ", counter = "alpha" } },
						-- Keep continuing an empty \item in enumerate (overrides
						-- the preset's exit-on-empty for enumerate).
						{ env = "enumerate", item = { text = "\\item ", exit_empty = false } },
					},
				},
				-- Continue comments on <S-CR> in every filetype.
				["*"] = { rules = { comment_rule } },
			},
		},
		config = function(_, opts)
			require("smart_enter").setup(opts)
			-- Debug helper: run :SmartEnterInspect with the cursor where <S-CR>
			-- misbehaves to see the filetype, the Treesitter environment chain,
			-- and which configured rules match.
			vim.api.nvim_create_user_command("SmartEnterInspect", function()
				require("smart_enter").inspect()
			end, { desc = "smart-enter: inspect env chain and rule matches at cursor" })
		end,
	},
}

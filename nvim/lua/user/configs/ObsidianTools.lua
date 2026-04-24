---@module "ObsidianTools"
local obsidianTools = require("ObsidianTools")


obsidianTools.setup(
{
	workspacePath = "~/Documents/NateObsidianVault/",
	tagListsFile = vim.fn.stdpath("config") .. "/lua/user/configs/obsidian_tag_lists.lua",
}
)

-- Function to write tag lists to file
local function write_tag_lists(tag_lists)
	local file = io.open(obsidianTools.tagListsFile, "w")
	if not file then
		vim.notify("Failed to open file for writing: " .. obsidianTools.tagListsFile, vim.log.levels.ERROR)
		return false
	end

	file:write("-- Auto-generated tag lists file\n")
	file:write("return {\n")

	for key, tags in pairs(tag_lists) do
		file:write(string.format('\t["%s"] = { ', key:gsub('"', '\\"')))
		for i, tag in ipairs(tags) do
			file:write(string.format('"%s"', tag:gsub('"', '\\"')))
			if i < #tags then
				file:write(", ")
			end
		end
		file:write(" },\n")
	end

	file:write("}\n")
	file:close()
	return true
end


-- Function to create floating window for input
local function create_input_window(title, prompt, callback)
	local buf = vim.api.nvim_create_buf(false, true)
	local width = 60
	local height = 6

	-- Calculate window position (center of screen)
	local row = math.ceil((vim.o.lines - height) / 2)
	local col = math.ceil((vim.o.columns - width) / 2)

	-- Create window
	local win = vim.api.nvim_open_win(buf, true, {
		relative = "editor",
		width = width,
		height = height,
		row = row,
		col = col,
		style = "minimal",
		border = "rounded",
		title = title,
		title_pos = "center",
	})

	-- Set buffer content
	vim.api.nvim_buf_set_lines(buf, 0, -1, false, {
		"",
		prompt,
		"",
		"Press ENTER <cr> to continue, and <ESC> to cancel",
		"",
		"",
	})

	-- Position cursor on input line
	vim.api.nvim_win_set_cursor(win, {6, 0})

	-- Set up keymaps
	local function cleanup()
		if vim.api.nvim_win_is_valid(win) then
			vim.api.nvim_win_close(win, true)
		end
	end

	vim.keymap.set("n", "<Esc>", cleanup, { buffer = buf })
	vim.keymap.set("n", "<CR>", function()
		local input = vim.api.nvim_get_current_line()
		cleanup()
		callback(input)
	end, { buffer = buf })

	vim.keymap.set("i", "<Esc>", cleanup, { buffer = buf })
	vim.keymap.set("i", "<CR>", function()
		local input = vim.api.nvim_get_current_line()
		cleanup()
		callback(input)
	end, { buffer = buf })

	-- Enter insert mode
	vim.cmd("startinsert")
end

-- Modified function to create floating window for input with pre-filled content
local function create_input_window_with_content(title, prompt, initial_content, callback)
	local buf = vim.api.nvim_create_buf(false, true)
	local width = 60
	local height = 6

	-- Calculate window position (center of screen)
	local row = math.ceil((vim.o.lines - height) / 2)
	local col = math.ceil((vim.o.columns - width) / 2)

	-- Create window
	local win = vim.api.nvim_open_win(buf, true, {
		relative = "editor",
		width = width,
		height = height,
		row = row,
		col = col,
		style = "minimal",
		border = "rounded",
		title = title,
		title_pos = "center",
	})

	-- Set buffer content
	vim.api.nvim_buf_set_lines(buf, 0, -1, false, {
		"",
		prompt,
		"",
		"Press ENTER <cr> to continue, and <ESC> to cancel",
		"",
		initial_content,
	})

	-- Position cursor at end of input line
	vim.api.nvim_win_set_cursor(win, {6, #initial_content})

	-- Set up keymaps
	local function cleanup()
		if vim.api.nvim_win_is_valid(win) then
			vim.api.nvim_win_close(win, true)
		end
	end

	vim.keymap.set("n", "<Esc>", cleanup, { buffer = buf })
	vim.keymap.set("n", "<CR>", function()
		local input = vim.api.nvim_get_current_line()
		cleanup()
		callback(input)
	end, { buffer = buf })

	vim.keymap.set("i", "<Esc>", cleanup, { buffer = buf })
	vim.keymap.set("i", "<CR>", function()
		local input = vim.api.nvim_get_current_line()
		cleanup()
		callback(input)
	end, { buffer = buf })

	-- Enter insert mode
	vim.cmd("startinsert")
end

-- Function to add new tag group
local function add_new_tag_group()
	create_input_window("New Tag Group", "Please input the name of the Tag group:", function(group_name)
		if group_name == "" then
			vim.notify("Tag group name cannot be empty", vim.log.levels.WARN)
			return
		end

		-- Convert spaces to underscores
		local processed_group_name = group_name:gsub(" ", "_")

		-- Check if tag group already exists
		local existing_tags = obsidianTools.tagList[group_name]
		local prompt_text
		local existing_tags_string = ""

		if existing_tags then
			-- Tag group exists, prepare existing tags string
			existing_tags_string = table.concat(existing_tags, ", ")
			prompt_text = "Tag group " .. processed_group_name .. " already exists! You can modify the tags below:"
		else
			-- New tag group
			prompt_text = "Please input the desired tags for the group " .. processed_group_name .. ":"
		end

		-- Create input window with existing tags pre-filled if they exist
		create_input_window_with_content("Tags for " .. processed_group_name, prompt_text, existing_tags_string, function(tags_input)
			if tags_input == "" then
				vim.notify("Tags cannot be empty", vim.log.levels.WARN)
				return
			end

			-- Parse comma-separated tags
			local tags = {}
			for tag in string.gmatch(tags_input, "([^,]+)") do
				-- Trim whitespace
				tag = tag:match("^%s*(.-)%s*$")
				if tag ~= "" then
					-- Replace spaces with underscores in the tag
					tag = tag:gsub(" ", "_")
					table.insert(tags, tag)
				end
			end

			if #tags == 0 then
				vim.notify("No valid tags found", vim.log.levels.WARN)
				return
			end

			-- Add/update tag_lists
			obsidianTools.tagList[group_name] = tags

			-- Write to file
			if write_tag_lists(obsidianTools.tagList) then
				local action = existing_tags and "updated" or "added"
				vim.notify("Tag group '" .. group_name .. "' " .. action .. " successfully with " .. #tags .. " tags", vim.log.levels.INFO)
			else
				vim.notify("Tag group added to memory but failed to save to file", vim.log.levels.WARN)
			end
		end)
	end)
end


vim.api.nvim_create_user_command("Diary", function(opts)
  local Note = require("obsidian.note")

  local title = opts.args
  local date = os.date("%Y-%m-%d")
  local suffix

  if title and title ~= "" then
    suffix = title:gsub(" ", "-"):gsub("[^A-Za-z0-9-]", ""):lower()
  else
    suffix = "untitled"
    title = "Untitled"
  end

  local note_id = date .. "_" .. suffix

  -- Create the note
  local note = Note.create({
    id = note_id,
    title = title,
    dir = obsidianTools.workspacePath .. "/diary/",
  })

  -- Add metadata
  note:add_tag("diary")
  if title and title ~= "Untitled" then
    note:add_alias(title)
  end

  -- Save and Open
  note:save()
  Note.open(note)

end, { nargs = "?" })


vim.keymap.set("n", "<leader>onn", function() obsidianTools.create_obsidian_note('') end, { desc = "Create Note" })
vim.keymap.set("n", "<leader>onm", function() obsidianTools.create_obsidian_note('MathVault') end, { desc = "Create Math Note" })
vim.keymap.set("n", "<leader>onp", function() obsidianTools.create_obsidian_note('philosophyVault') end, { desc = "Create Obsidian Note" })
vim.keymap.set("n", "<leader>ot", obsidianTools.addTags, { desc = "add tags" })
vim.keymap.set("n", "<space>oo", "<cmd>Obsidian search<cr>", { desc = "[o]bsidian search" })
vim.keymap.set("n", "<space>ot", "<cmd>Obsidian tags<cr>", { desc = "[o]bsidian [t]ags" })
vim.keymap.set("n", "<leader>oT", function() obsidianTools.addTagsFromList(obsidianTools.tagList) end, { desc = "add tags to list" })
vim.keymap.set("n", "<leader>oN", add_new_tag_group, { desc = "add New tag group" })
vim.keymap.set('n', "<space>og",
function()
	require("snacks").picker.grep({
		cwd   = vim.fn.expand("~/Documents/NateObsidianVault/"),
		title = "[o]bsidian [g]rep",
	})
end,
{desc = "[o]bsidian [g]rep"})
vim.keymap.set('n', '<leader>oh', '<cmd> e ~/Documents/NateObsidianVault/index.md<cr>', {desc = "Obsidian index page"})
vim.api.nvim_create_user_command('ConvertHashtags', obsidianTools.convert_hashtags, {})

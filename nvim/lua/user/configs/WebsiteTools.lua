---@module "WebsiteTools"
local websiteTools = require("WebsiteTools")
local config_dir = vim.fn.stdpath("config")

websiteTools.setup({
	blog_source_code_url = "~/website-nate/nate-website/src/assets/latex",
	blog_webpage_url = "~/website-nate/nate-website/src/app/components/blog/blog.component.ts",
	blog_public_post_url = "~/website-nate/nate-website/src/assets/pdfs/blogs",
	blog_latex_template = config_dir .. "/preamble/blog_preamble.tex",

	books_pdf_url = "~/website-nate/nate-website/src/assets/pdfs/books",
	books_webpage_url = "~/website-nate/nate-website/src/app/components/books/books.component.ts",
	books_latex_template = config_dir .. "/preamble/books_preamble.tex",

	notes_source_code_url = "~/website-nate/nate-website/src/assets/latex/notes",
	notes_pdf_url = "~/website-nate/nate-website/src/assets/pdfs/notes",
	notes_webpage_url = "~/website-nate/nate-website/src/app/components/notes/notes.component.ts",
	notes_latex_template = config_dir .. "/preamble/notes_preamble.tex",

	website_dir = "~/website-nate/nate-website"
})

local function complete_display_mode(arg_lead, cmd_line, cursor_pos)
    local options = {"float", "tab", "split", "vsplit", "horizontal", "vertical", "tabnew"}
    local matches = {}

    for _, option in ipairs(options) do
        if option:find("^" .. arg_lead) then
            table.insert(matches, option)
        end
    end

    return matches
end

local templates = {
    {
        names = {"EditBlogTemplate", "EditBlogPreamble"},
        func = function(display_mode)
            websiteTools.editBlogTemplate(display_mode)
        end,
        desc = "Edit blog template"
    },
    {
        names = {"EditNotesTemplate", "EditNotesPreamble"},
        func = function(display_mode)
            websiteTools.editNotesTemplate(display_mode)
        end,
        desc = "Edit notes template"
    },
    {
        names = {"EditBooksTemplate", "EditBooksPreamble"},
        func = function(display_mode)
            websiteTools.editBooksTemplate(display_mode)
        end,
        desc = "Edit books template"
    }
}

for _, template in ipairs(templates) do
    for _, command_name in ipairs(template.names) do
        vim.api.nvim_create_user_command(command_name, function(opts)
            template.func(opts.args)
        end, {
            nargs = "?",
            complete = complete_display_mode,
            desc = template.desc .. " (float|tab|split|vsplit|horizontal|vertical|tabnew)"
        })
    end
end

vim.api.nvim_create_user_command("CreateBlog",          function() websiteTools.createNewBlog()         end, {})
vim.api.nvim_create_user_command("CreateNote",          function() websiteTools.createNewNote()         end, {})
vim.api.nvim_create_user_command("CreateBook",          function() websiteTools.createNewBook()         end, {})
vim.api.nvim_create_user_command("PublishToWebsite",    function() websiteTools.publishToWebsite()      end, {})
vim.api.nvim_create_user_command("CopyBookToWebsite",   function() websiteTools.copyBooksToWebsite()    end, {})
vim.api.nvim_create_user_command("CopyNotesToWebsite",  function() websiteTools.copyNotesToWebsite()    end, {})
vim.api.nvim_create_user_command("CopyBlogToWebsite",   function() websiteTools.copyBlogToWebsite()     end, {})
vim.api.nvim_create_user_command("UpdateBooksPage",     function() websiteTools.updateBooksPage()       end, {})
vim.api.nvim_create_user_command("UpdateBlogPage",      function() websiteTools.updateBlogPage()        end, {})
vim.api.nvim_create_user_command("UpdateNotesPage",     function() websiteTools.updateNotesPage()       end, {})

---@module "WebsiteTools"
local websiteTools = require("WebsiteTools")
local config_dir = vim.fn.stdpath("config")

websiteTools.setup({
	blog_source_code_url = "~/Documents/academic/blogs",
	-- The post list lives in blog-posts.ts, not the component; likewise the book
	-- entries live in book-descriptions.ts. Both were split out of their
	-- components and these paths were left pointing at the old files, so
	-- :UpdateBlogPage / :UpdateBooksPage opened the wrong buffer to paste into.
	blog_webpage_url = "~/programming/website-nate/nate-website/src/app/components/blog/blog-posts.ts",
	blog_public_post_url = "~/programming/website-nate/nate-website/src/assets/pdfs/blogs",
	blog_latex_template = config_dir .. "/preamble/blog_preamble.tex",

	books_pdf_url = "~/programming/website-nate/nate-website/src/assets/pdfs/books",
	books_webpage_url = "~/programming/website-nate/nate-website/src/app/components/books/book-descriptions.ts",
	books_latex_template = config_dir .. "/preamble/books_preamble.tex",

	notes_source_code_url = "~/Documents/academic/notes",
	notes_pdf_url = "~/programming/website-nate/nate-website/src/assets/pdfs/notes",
	notes_webpage_url = "~/programming/website-nate/nate-website/src/app/components/notes/notes.component.ts",
	notes_latex_template = config_dir .. "/preamble/notes_preamble.tex",

	website_dir = "~/programming/website-nate/nate-website",
	textbooks_dir = (os.getenv("TEXTBOOKS") or vim.fn.expand("~/Documents/academic/textbooks")),
	series_map_dir = (os.getenv("TEXTBOOKS") or vim.fn.expand("~/Documents/academic/textbooks")) .. "/.eyntka/series-map"
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
vim.api.nvim_create_user_command("PublishToWebsite",    function(o) websiteTools.publishToWebsite({ skip_textbooks = o.bang }) end, {
    bang = true,
    desc = "Publish website; syncs every PDF from source and runs the checks first (! skips both)",
})
vim.api.nvim_create_user_command("CopyBookToWebsite",   function() websiteTools.copyBooksToWebsite()    end, {})
vim.api.nvim_create_user_command("CopyNotesToWebsite",  function() websiteTools.copyNotesToWebsite()    end, {})
vim.api.nvim_create_user_command("CopyBlogToWebsite",   function() websiteTools.copyBlogToWebsite()     end, {})
vim.api.nvim_create_user_command("UpdateBooksPage",     function() websiteTools.updateBooksPage()       end, {})
vim.api.nvim_create_user_command("UpdateBlogPage",      function() websiteTools.updateBlogPage()        end, {})
vim.api.nvim_create_user_command("UpdateNotesPage",     function() websiteTools.updateNotesPage()       end, {})

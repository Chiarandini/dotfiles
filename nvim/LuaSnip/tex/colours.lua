-- Colour-wrapping snippets.
--
-- Moved out of noethervim-tex: these need `xcolor`, which nothing in the
-- plugin's preamble snippets loads, so shipping them meant a distribution
-- user could expand one and get an undefined control sequence. Personal is
-- the right home -- the colours themselves are a private convention.
local ls = require("luasnip")
local s = ls.snippet
local i = ls.insert_node
local d = ls.dynamic_node
local fmta = require("luasnip.extras.fmt").fmta
local get_visual_insert = require("noethervim-tex.luasnip_helper").get_visual_insert_node

--- One \textcolor wrapper. No padding inside the [[ ]]: Lua strips a newline
--- directly after `[[` but not a space, which is what put a stray space on
--- each side of the wrapped text.
local function colour(trig, name)
  return s({ trig = trig, dscr = "xcolor " .. name },
    fmta([[\textcolor{<>}{<>}<>]], {
      require("luasnip").text_node(name),
      d(1, get_visual_insert),
      i(0),
    }))
end

-- Returned as AUTOsnippets (second return value), which is what they were in
-- the plugin: the workflow is select, <Tab>, type RED -- and a manual
-- snippet would sit there waiting for a completion menu instead of firing.
return {}, {
  colour("RED", "red"),
  colour("GREEN", "green"),
  colour("BLUE", "blue"),
}

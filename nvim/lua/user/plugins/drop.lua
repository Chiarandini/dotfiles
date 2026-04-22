-- Override noethervim's drop.nvim with custom themes and context-aware dispatch.
-- Priority (highest first): birthday > tex (dynamic) > time-of-day > weather (rainy) > seasonal calendar.

-- ── Tweakables ────────────────────────────────────────────────────────
local BIRTHDAY = { month = 4, day = 24, year = nil } -- year unlocks age-digit symbol
local WEATHER_LOCATION        = ""      -- empty = wttr.in IP geolocation; or "Toronto"
local WEATHER_CACHE_SECONDS   = 60 * 30 -- refetch at most every 30 min

return {
	{
		"folke/drop.nvim",
		config = function(_, opts)
			local themes = require("drop.themes")

			-- ── Custom themes ──────────────────────────────────────────────
			themes.tex = {
				symbols = {
					"∫", "∑", "∏", "√", "∞", "π", "α", "β", "γ",
					"Δ", "Ω", "ℝ", "ℤ", "ℚ", "§", "¶", "⊢", "⊨",
					"📐", "📝", "✒️", "📖",
				},
				colors = { "#F5F5DC", "#8B0000", "#191970", "#2F4F4F", "#DAA520" },
			}

			themes.dawn = {
				symbols = { "☕", "🌅", "🐦", "🥐", "📰", "🌄", "🌤️", "🍞" },
				colors  = { "#FFB88C", "#FF8C69", "#FFCBA4", "#FFDAB9", "#FFD700", "#F4A460" },
			}

			themes.twilight = {
				symbols = { "🌆", "🦇", "🌙", "💫", "✨", "🌃", "🏙️", "🕯️" },
				colors  = { "#4B0082", "#6A5ACD", "#483D8B", "#9370DB", "#FFB6C1", "#FF6347" },
			}

			themes.insomnia = {
				symbols = { "☕", "🌙", "👁️", "💻", "🦉", "⌨️", "📟", "🕯️", "🥱" },
				colors  = { "#4682B4", "#5F9EA0", "#708090", "#778899", "#B0C4DE", "#FFFFFF" },
			}

			themes.rainy_day = {
				symbols = { "☔", "💧", "🌧️", "🍵", "📖", "🌫️", "⛈️", "🌂", "🍂" },
				colors  = { "#708090", "#778899", "#B0C4DE", "#D3D3D3", "#DEB887", "#CD853F" },
			}

			themes.foggy = {
				symbols = { "🌫️", "🌁", "💭", "☁️", "🌥️", "🕯️", "👻", "🏚️" },
				colors  = { "#BDBDBD", "#9E9E9E", "#CFD8DC", "#ECEFF1", "#78909C" },
			}

			themes.heatwave = {
				symbols = { "🌞", "🔥", "🥵", "🌵", "🍉", "🧊", "🍦", "💦" },
				colors  = { "#FF4500", "#FF8C00", "#FFD700", "#FFA07A", "#DC143C" },
			}

			themes.birthday = {
				symbols = {
					"🎂", "🎈", "🎁", "🎉", "🎊", "🥳", "🍰", "🎆", "✨", "💝", "🌟",
					function()
						if not (BIRTHDAY.year and BIRTHDAY.month and BIRTHDAY.day) then
							return "🎂"
						end
						local t = os.date("*t")
						local age = t.year - BIRTHDAY.year
						if t.month < BIRTHDAY.month
							or (t.month == BIRTHDAY.month and t.day < BIRTHDAY.day) then
							age = age - 1
						end
						local digit = { ["0"] = "0️⃣", ["1"] = "1️⃣", ["2"] = "2️⃣",
							["3"] = "3️⃣", ["4"] = "4️⃣", ["5"] = "5️⃣",
							["6"] = "6️⃣", ["7"] = "7️⃣", ["8"] = "8️⃣", ["9"] = "9️⃣" }
						return table.concat(vim.tbl_map(function(c)
							return digit[c] or c
						end, vim.fn.split(tostring(age), "")))
					end,
				},
				colors = { "#FF69B4", "#FFD700", "#FF4500", "#00CED1", "#9370DB" },
			}

			-- ── Baseline opts (matches noethervim bundle defaults) ─────────
			opts = vim.tbl_deep_extend("force", {
				max         = 40,
				interval    = 150,
				screensaver = (1000 * 60) * 8,
				filetypes   = {},
				winblend    = 90,
			}, opts or {})

			-- Seasonal calendar = fallback when no override hits.
			opts.themes = {
				{ theme = "new_year",            month = 1,  day = 1 },
				{ theme = "valentines_day",      month = 2,  day = 14 },
				{ theme = "st_patricks_day",     month = 3,  day = 17 },
				{ theme = "easter",              holiday = "easter" },
				{ theme = "april_fools",         month = 4,  day = 1 },
				{ theme = "us_independence_day", month = 7,  day = 4 },
				{ theme = "halloween",           month = 10, day = 31 },
				{ theme = "us_thanksgiving",     holiday = "us_thanksgiving" },
				{ theme = "xmas",   from = { month = 12, day = 20 }, to = { month = 12, day = 25 } },
				{ theme = "leaves", from = { month = 9,  day = 22 }, to = { month = 11, day = 30 } },
				{ theme = "snow",   from = { month = 12, day = 21 }, to = { month = 3,  day = 19 } },
				{ theme = "spring", from = { month = 3,  day = 20 }, to = { month = 6,  day = 20 } },
				{ theme = "summer", from = { month = 6,  day = 21 }, to = { month = 9,  day = 21 } },
			}

			-- ── Startup override: birthday > time-of-day ───────────────────
			local now = os.date("*t")
			local picked

			if BIRTHDAY.month and BIRTHDAY.day
				and now.month == BIRTHDAY.month and now.day == BIRTHDAY.day then
				picked = "birthday"
			end

			if not picked then
				local h = now.hour
				if h >= 1 and h < 5 then     picked = "insomnia"
				elseif h >= 5 and h < 8 then picked = "dawn"
				elseif h >= 18 and h < 21 then picked = "twilight"
				elseif h >= 21 or h < 1 then picked = "stars" -- keep existing late-night
				end
			end

			if picked then opts.theme = picked end

			require("drop").setup(opts)

			-- ── Runtime theme switching helpers ────────────────────────────
			local function set_theme(name)
				local cfg = require("drop.config")
				cfg.options.theme = name
				cfg.colors()
			end

			-- Dynamic: tex-family buffers swap to the tex theme. Lowest-priority
			-- override — birthday/insomnia/etc stay if already picked.
			local LOCKED = { birthday = true, insomnia = true, dawn = true, twilight = true }
			vim.api.nvim_create_autocmd("FileType", {
				pattern = { "tex", "plaintex", "latex" },
				callback = function()
					if not LOCKED[require("drop.config").options.theme] then
						set_theme("tex")
					end
				end,
			})

			-- ── Weather API (wttr.in, free, no key) ────────────────────────
			-- Format tokens: %C = condition text, %t = temp.  We fetch "%C|%t"
			-- so one request covers both condition and temperature routing.
			local cache_path = vim.fn.stdpath("cache") .. "/drop_weather.txt"
			local uv = vim.uv or vim.loop

			local function read_cache()
				local st = uv.fs_stat(cache_path)
				if not st then return nil end
				if os.time() - st.mtime.sec > WEATHER_CACHE_SECONDS then return nil end
				local f = io.open(cache_path, "r")
				if not f then return nil end
				local data = f:read("*a")
				f:close()
				return data
			end

			local function write_cache(s)
				local f = io.open(cache_path, "w")
				if not f then return end
				f:write(s)
				f:close()
			end

			-- Route wttr.in condition text to a theme name (or nil = don't override).
			local function weather_theme(raw)
				local cond, temp_str = raw:match("^(.-)|(.*)$")
				cond = (cond or raw or ""):lower()
				local temp = tonumber((temp_str or ""):match("(-?%d+)"))

				if cond:match("rain") or cond:match("drizzle")
					or cond:match("shower") or cond:match("thunder")
					or cond:match("storm") then
					return "rainy_day"
				elseif cond:match("snow") or cond:match("sleet")
					or cond:match("blizzard") or cond:match("ice") then
					return "snow" -- built-in theme
				elseif cond:match("fog") or cond:match("mist") or cond:match("haze") then
					return "foggy"
				elseif temp and temp >= 30 then -- °C heat threshold
					return "heatwave"
				end
				return nil
			end

			local function apply_weather(raw)
				local name = weather_theme(raw or "")
				if not name then return end
				local cur = require("drop.config").options.theme
				if LOCKED[cur] then return end
				if cur == "tex" then return end
				set_theme(name)
			end

			local cached = read_cache()
			if cached then
				apply_weather(cached)
			else
				vim.system(
					{ "curl", "-s", "--max-time", "3",
						string.format("wttr.in/%s?format=%%C|%%t", WEATHER_LOCATION) },
					{ text = true },
					vim.schedule_wrap(function(res)
						if res.code ~= 0 or not res.stdout then return end
						local raw = vim.trim(res.stdout)
						if raw == "" or raw:lower():match("unknown location") then return end
						write_cache(raw)
						apply_weather(raw)
					end)
				)
			end
		end,
	},
}

-- hyphenate ---------------------------------------------------------------------------------------

local PAT = "data/en-us.pat"
local HYP = "data/en-us.hyp"

local l = lang.new(0)
l.clear_patterns(l)
l.clear_hyphenation(l)

local function load_lines(path)
    local tmp = {}
    for line in io.lines(path) do
        tmp[#tmp + 1] = line:match("^%s*(.-)%s*$")
    end
    return table.concat(tmp, " ")
end

l.patterns(l, load_lines(PAT))
l.hyphenation(l, load_lines(HYP))

-- solve -------------------------------------------------------------------------------------------

local SRC = "data/paras"
local DST = assert(io.open("scripts/build/solve/golden", "w"))
local MET = assert(io.open("scripts/build/solve/metrics", "w"))
local GLYPH, GLUE, HLIST, DISC = node.id("glyph"), node.id("glue"), node.id("hlist"), node.id("disc")
local INF_BADNESS = 10000

-- Ligatures and kerns are off, so a run of glyphs is worth the sum of its parts. That is what lets
-- the fixture ship one width per character instead of one width per fragment.
local widths = {}
local space = nil

-- tex.web 108. The harness runs the same integer approximation, so "did TeX have to force a break"
-- is decided identically on both sides.
local function badness(t, s)
    if t == 0 then return 0 end
    if s <= 0 then return INF_BADNESS end
    local r
    if t <= 7230584 then
        r = (t * 297) // s
    elseif s >= 1663497 then
        r = t // (s // 297)
    else
        r = t
    end
    if r > 1290 then return INF_BADNESS end
    return (r * r * r + 131072) // 262144
end

luatexbase.add_to_callback("pre_linebreak_filter", function(head)
    if not space then
        for n in node.traverse_id(GLUE, head) do
            if n.subtype ~= 15 then -- 15 = \parfillskip
                space = { n.width, n.stretch }
                break
            end
        end
    end
    return head
end, "golden_space")

luatexbase.add_to_callback("post_linebreak_filter", function(head)
    local hsize, emergency = tex.hsize, tex.emergencystretch
    local lines, forced = {}, false

    for line in node.traverse_id(HLIST, head) do
        local chars, stretch, fil = {}, 0, false
        for n in node.traverse(line.head) do
            if n.id == GLYPH then
                chars[#chars + 1] = utf8.char(n.char)
                widths[n.char] = n.width
            elseif n.id == DISC then
                -- An unbroken disc keeps its replace text inside the sublist, where traverse does
                -- not go. A broken one has already been flattened into pre/post glyphs by TeX.
                for g in node.traverse_id(GLYPH, n.replace) do
                    chars[#chars + 1] = utf8.char(g.char)
                    widths[g.char] = g.width
                end
            elseif n.id == GLUE then
                if n.stretch_order == 0 then stretch = stretch + n.stretch else fil = true end
            end
        end
        lines[#lines + 1] = table.concat(chars)

        -- TeX never fails: when nothing is feasible it breaks anyway. Those paragraphs are the ones
        -- where the solver is supposed to return null instead, so they are marked, not dropped.
        local natural = node.dimensions(line.head)
        if natural > hsize then
            forced = true
        elseif not fil and badness(hsize - natural, stretch + emergency) > tex.tolerance then
            forced = true
        end
    end

    DST:write(string.format("%d\t%d\t%s\t%s\n",
        hsize, emergency, forced and "forced" or "ok", table.concat(lines, "|")))
    return head
end, "golden_lines")

-- corpus ------------------------------------------------------------------------------------------

-- TeX scales the stretch of a space by the preceding character's space factor, which is 999 after
-- an uppercase letter. Goldilocks has one uniform glue, so the oracle is levelled to match.
for code = 0, 0x2FFF do tex.setsfcode("global", code, 1000) end

-- #, $, %, &, ^, _, {, }, ~
local CATCODES = ("\\catcode%d=12 "):rep(9):format(35, 36, 37, 38, 94, 95, 123, 125, 126)

-- One measure per paragraph, cycled: 25916 paragraphs cover the range far better than a handful of
-- paragraphs at every width would, and the fixture stays one line per paragraph.
local HSIZES = {}
for hs = 100, 440, 20 do HSIZES[#HSIZES + 1] = hs end

local i = 0
for line in io.lines(SRC) do
    local para = line:match("^%s*(.-)%s*$")
    if #para > 0 then
        local hs = HSIZES[i % #HSIZES + 1]
        i = i + 1
        tex.print(string.format("\\hsize=%dpt \\emergencystretch=%dpt \\begingroup%s%s\\endgroup\\par",
            hs, hs // 4, CATCODES, para))
    end
end

luatexbase.add_to_callback("wrapup_run", function()
    MET:write(string.format("G\t%d\t%d\n", space[1], space[2]))
    local codes = {}
    for code in pairs(widths) do codes[#codes + 1] = code end
    table.sort(codes)
    for _, code in ipairs(codes) do MET:write(string.format("C\t%d\t%d\n", code, widths[code])) end
    MET:close()
    DST:close()
end, "golden_close")

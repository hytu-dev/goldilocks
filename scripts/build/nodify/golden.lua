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

-- nodify ------------------------------------------------------------------------------------------

local SRC = "data/paras"
local DST = assert(io.open("scripts/build/nodify/golden", "w"))
local GLYPH, GLUE, DISC = node.id("glyph"), node.id("glue"), node.id("disc")

local function is_letter(code)
    return (code >= 65 and code <= 90) or (code >= 97 and code <= 122) or
        (code >= 0xC0 and code <= 0x024F and code ~= 0xD7 and code ~= 0xF7)
end

local function extract_text(head)
    local tmp = {}
    for n in node.traverse(head) do
        if n.id == GLYPH then tmp[#tmp + 1] = unicode.utf8.char(n.char) end
    end
    return table.concat(tmp)
end

luatexbase.add_to_callback("pre_linebreak_filter", function(head)
    local out, tmp, last_is_letter = {}, {}, nil

    local function flush()
        if #tmp > 0 then
            out[#out + 1] = "B:" .. table.concat(tmp)
            tmp, last_is_letter = {}, nil
        end
    end

    for n in node.traverse(head) do
        if n.id == GLYPH then
            if last_is_letter ~= nil and is_letter(n.char) ~= last_is_letter then flush() end
            tmp[#tmp + 1], last_is_letter = unicode.utf8.char(n.char), is_letter(n.char)
        elseif n.id == GLUE then
            if n.subtype ~= 15 then
                flush()
                out[#out + 1] = "G"
            end
        elseif n.id == DISC then
            flush()
            if n.subtype == 2 then
                local txt = n.replace and extract_text(n.replace) or "-"
                out[#out + 1] = "B:" .. txt
                out[#out + 1] = "P:f"
            else
                out[#out + 1] = "P:t"
            end
        end
    end
    flush()

    DST:write(table.concat(out, "|") .. "\n")
    return head
end, "golden_nodify")

local CATCODES = ("\\catcode%d=12 "):rep(9):format(35, 36, 37, 38, 94, 95, 123, 125, 126)

for line in io.lines(SRC) do
    local para = line:match("^%s*(.-)%s*$")
    if #para > 0 then
        -- #, $, %, &, ^, _, {, }, ~
        tex.print("\\begingroup" .. CATCODES .. para .. "\\endgroup\\par")
    end
end

luatexbase.add_to_callback("wrapup_run", function()
    if DST then DST:close() end
end, "close_golden")

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
    local out, chars, item_discs, last_is_letter = {}, {}, {}, nil

    local function flush()
        if #chars == 0 then return end
        local entry = "I:" .. table.concat(chars)
        if #item_discs > 0 then
            entry = entry .. "[" .. table.concat(item_discs, ";") .. "]"
        end
        out[#out + 1] = entry
        chars, item_discs, last_is_letter = {}, {}, nil
    end

    local function has_content_after(n)
        local nxt = n.next
        while nxt do
            if nxt.id == GLYPH then return true end
            if nxt.id == GLUE and nxt.subtype ~= 15 then return false end
            nxt = nxt.next
        end
        return false
    end

    for n in node.traverse(head) do
        if n.id == GLYPH then
            local is_let = is_letter(n.char)
            if #chars > 0 and last_is_letter ~= nil and is_let ~= last_is_letter then
                flush()
            end
            chars[#chars + 1] = unicode.utf8.char(n.char)
            last_is_letter = is_let
        elseif n.id == GLUE then
            if n.subtype ~= 15 then
                flush()
                out[#out + 1] = "G"
            end
        elseif n.id == DISC then
            if n.subtype == 2 then
                -- explicit hyphen: ends the current item, becomes its own item
                flush()
                local rep = n.replace and extract_text(n.replace) or "-"
                if has_content_after(n) then
                    out[#out + 1] = "I:" .. rep .. "[" .. #rep .. ",,,]"
                else
                    out[#out + 1] = "I:" .. rep
                end
            else
                -- implicit hyphenation: stay inside the current item, record offset
                local offset                = #chars
                local pre                   = n.pre and extract_text(n.pre) or ""
                local post                  = n.post and extract_text(n.post) or ""
                local rep                   = n.replace and extract_text(n.replace) or ""
                item_discs[#item_discs + 1] = offset .. "," .. pre .. "," .. post .. "," .. rep
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

os.setlocale("C")

local CASES, RULES, WORDS = "ext/en-us/cases", "ext/en-us/rules", "ext/en-us/words"
local LMIN, RMIN          = 2, 3
local G, D                = node.id("glyph"), node.id("disc")


local function slurp(path)
    local fh = assert(io.open(path, "rb"), "cannot read " .. path)
    local body = fh:read("a")
    fh:close()
    return body
end


local function crypt(body)
    return (sha2.digest256(body):gsub(".", function(c)
        return string.format("%02x", c:byte())
    end))
end


local rules, cases, words = slurp(RULES), slurp(CASES), slurp(WORDS)


local l = lang.new()
l:patterns(rules)
l:hyphenation(cases)
local FONT, LANG = font.current(), l:id()


local function hyphenate(word)
    local head, tail
    for _, code in utf8.codes(word) do
        local g = node.new(G)
        g.subtype, g.char, g.font, g.lang = 1, code, FONT, LANG
        if head then
            tail.next, g.prev, tail = g, tail, g
        else
            g.left, g.right = LMIN, RMIN
            head, tail = g, g
        end
    end

    head = lang.hyphenate(head, tail)

    local pieces = {}
    for n in node.traverse(head) do
        if n.id == G then
            pieces[#pieces + 1] = utf8.char(n.char)
        elseif n.id == D then
            pieces[#pieces + 1] = "-"
        end
    end
    node.flush_list(head)

    return table.concat(pieces)
end


local buffer = {}
for w in words:gmatch("%S+") do
    buffer[#buffer + 1] = hyphenate(w)
end

local data = table.concat(buffer, "\n") .. "\n"
local hash = crypt(data)

local major, minor = status.luatex_version // 100, status.luatex_version % 100
local patch = status.luatex_revision

local meta = table.concat({
    "---",
    "name: Liang's Hyphenation Oracle (LHO)",
    "lang: en-us",
    "date: " .. os.date("!%Y-%m-%d"),
    "build_sha256: " .. hash,
    "",
    "creator: Hung-Yuan Tu (hytu)",
    "license: CC-BY-4.0",
    "license_url: https://creativecommons.org/licenses/by/4.0/",
    "",
    "source: https://github.com/hytu-dev/goldilocks",
    "inputs: ext/en-us/{cases, rules, words}",
    "",
    "engine: LuaTeX " .. major .. "." .. minor .. "." .. patch,
    "lmin: " .. LMIN,
    "rmin: " .. RMIN,
    "",
    "cases_sha256: " .. crypt(cases),
    "rules_sha256: " .. crypt(rules),
    "words_sha256: " .. crypt(words),
    "---",
}, "\n") .. "\n"


local fh = assert(io.open(("ref/en-us/lho/LHO-%s"):format(hash:sub(1, 8)), "wb"))
fh:write(meta)
fh:write(data)
fh:close()

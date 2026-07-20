local PAT = "data/en-us.pat"
local HYP = "data/en-us.hyp"
local SRC = "data/words"

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

callback.register("ligaturing", false)

for line in io.lines(SRC) do
    local word = line:match("^%s*(.-)%s*$")
    tex.print("\\showhyphens{" .. word .. "}")
end

local PAT = "data/en-us.pat"
local HYP = "data/en-us.hyp"

local l = lang.new(0)
lang.clear_patterns(l)
lang.clear_hyphenation(l)

local pats = {}
for line in io.lines(PAT) do
    local p = line:match("^%s*(.-)%s*$")
    pats[#pats + 1] = p
end
lang.patterns(l, table.concat(pats, " "))

local hyps = {}
for line in io.lines(HYP) do
    local h = line:match("^%s*(.-)%s*$")
    hyps[#hyps + 1] = h
end
lang.hyphenation(l, table.concat(hyps, " "))

callback.register("ligaturing", function(head) return head end)

local INPUT = "data/words"

for line in io.lines(INPUT) do
    local word = line:match("^%s*(.-)%s*$")
    tex.print("\\showhyphens{" .. word .. "}")
end

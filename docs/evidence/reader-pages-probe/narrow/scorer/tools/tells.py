import re,sys,subprocess
sys.argv_vt=sys.argv[1]
def text_of(path):
    if path.endswith('.vue'):
        out=subprocess.run(['python3','-I',sys.argv_vt,path],capture_output=True,text=True).stdout
        lines=[re.sub(r'^\d+: ','',l) for l in out.split('\n')[1:]]
        return '\n'.join(l for l in lines if not re.match(r'^(<|\{\{|:|@|v-)',l))
    t=open(path).read(); t=re.sub(r'^---.*?---','',t,flags=re.S); t=re.sub(r'```.*?```','',t,flags=re.S)
    return t
P={
 'notXbutY':r"\b(not|n't)\b[^.;\n]{1,50}\bbut\b|\w, not (a |an |the )?\w+[^.]{0,20}\.|\brather than\b",
 'emdash':r"—",
 'aiword':r"\b(delve|leverage|robust|seamless(ly)?|crucial|pivotal|landscape|tapestry|foster|showcase|underscore|streamline|comprehensive|vital|elevate|empower|unlock)\b",
 'sales':r"\b(powerful|effortless(ly)?|blazing|best-in-class|cutting-edge|game-?chang)",
 'boldlabel':r"^\s*[-*]?\s*\*\*[^*]{1,40}[.:]\*\*",
 'selfref':r"\b(this (lesson|page|section|guide|document)|the (table|figure) below|earlier draft|source confirms|comes from the|defines this|does not come from)\b",
 'fragment':r"(?:(?<=^)|(?<=[.!?]\s))[A-Z][^.!?\n]{0,22}\.(?=\s|$)",
}
print(f"{'page':48}"+''.join(f"{k:>10}" for k in P)+f"{'words':>7}")
for p in sys.argv[2:]:
    t=text_of(p); w=len(re.findall(r"[A-Za-z]+",t))
    row=[len(re.findall(v,t,flags=re.M|re.I if k!='fragment' else re.M)) for k,v in P.items()]
    print(f"{p.split('/src/')[-1][-48:]:48}"+''.join(f"{c:>10}" for c in row)+f"{w:>7}")

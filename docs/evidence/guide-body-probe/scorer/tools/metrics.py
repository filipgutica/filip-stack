import re,sys,subprocess
def syl(w):
    w=w.lower(); w=re.sub(r'[^a-z]','',w)
    if not w: return 0
    v=re.findall(r'[aeiouy]+',w); n=len(v)
    if w.endswith('e') and n>1 and not w.endswith('le'): n-=1
    return max(1,n)
def text_of(path):
    if path.endswith('.vue'):
        out=subprocess.run(['python3','-I',sys.argv[1],path],capture_output=True,text=True).stdout
        lines=[re.sub(r'^\d+: ','',l) for l in out.split('\n')[1:]]
        lines=[l for l in lines if not re.match(r'^(<|\{\{|:|@|v-)',l)]
        return '\n'.join(lines)
    t=open(path).read()
    t=re.sub(r'^---.*?---','',t,flags=re.S)
    t=re.sub(r'```.*?```','',t,flags=re.S)
    t=re.sub(r'^\s*\|.*$','',t,flags=re.M)
    t=re.sub(r'\[!\[.*?\]\(.*?\)\]\(.*?\)','',t)
    t=re.sub(r'\[([^\]]*)\]\([^)]*\)',r'\1',t)
    t=re.sub(r'[#*`>]','',t)
    return t
print(f"{'page':58} {'words':>6} {'sents':>5} {'w/sent':>6} {'FKgrade':>7} {'long>25':>7}")
for p in sys.argv[2:]:
    t=text_of(p)
    t2=re.sub(r'\s+',' ',t)
    sents=[s for s in re.split(r'(?<=[.!?])\s+',t2) if len(s.split())>2]
    words=re.findall(r"[A-Za-z][A-Za-z'-]*",t2)
    if not sents or not words: continue
    sy=sum(syl(w) for w in words)
    fk=0.39*len(words)/len(sents)+11.8*sy/len(words)-15.59
    long=sum(1 for s in sents if len(s.split())>25)
    print(f"{p.split('/src/')[-1][:58]:58} {len(words):6} {len(sents):5} {len(words)/len(sents):6.1f} {fk:7.1f} {long:7}")

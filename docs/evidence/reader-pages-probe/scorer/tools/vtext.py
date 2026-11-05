import re,sys
# print reader-visible text from a .vue template with source line numbers
for path in sys.argv[1:]:
    src=open(path).read().split('\n')
    intpl=False; depth=0
    print(f"### {path}")
    for i,l in enumerate(src,1):
        if l.startswith('<template'): intpl=True; continue
        if l.startswith('</template>'): intpl=False; continue
        if not intpl: continue
        t=re.sub(r'<[^>]*>',' ',l)
        t=re.sub(r'\s+',' ',t).strip()
        if t and not re.fullmatch(r'[/>"\'=\w:-]*',t) or (t and len(t)>25):
            if re.search(r'[A-Za-z]{3,}',t) and not re.match(r'^(class|v-|:|@|href|aria)',t):
                print(f"{i}: {t}")

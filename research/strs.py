import re,collections,sys,pickle
res={}
for n in ['racadv','racbas','rmebas','rstbas']:
    c=collections.Counter()
    for suffix in ['global','part']:
        b=open(f'out/{n}_{suffix}.raw','rb').read()
        for m in re.finditer(rb'(?:[\x20-\x7e]\x00){4,}',b):
            c[m.group().decode('utf-16le')]+=1
    res[n]=c; print(n,len(c))
pickle.dump(res,open('strs.pkl','wb'))

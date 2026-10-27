import struct, sys
class Ole:
    def __init__(s, path):
        s.f = open(path,'rb'); h = s.f.read(512)
        assert h[:8]==bytes.fromhex('D0CF11E0A1B11AE1')
        s.ss = 1<<struct.unpack('<H',h[30:32])[0]
        s.mss = 1<<struct.unpack('<H',h[32:34])[0]
        nfat,dirstart,_,cutoff,minifat,nmini,difat,ndifat = struct.unpack('<IIIIIIII',h[44:76]) if False else (None,)*8
        nfat = struct.unpack('<I',h[44:48])[0]; dirstart=struct.unpack('<I',h[48:52])[0]
        s.cutoff=struct.unpack('<I',h[56:60])[0]; minifat=struct.unpack('<I',h[60:64])[0]
        difat=struct.unpack('<I',h[68:72])[0]; ndifat=struct.unpack('<I',h[72:76])[0]
        dl = list(struct.unpack('<109I',h[76:512]))
        while difat<0xFFFFFFFA and ndifat:
            sec = s.sec(difat); n=s.ss//4
            v=struct.unpack('<%dI'%n,sec); dl+=v[:-1]; difat=v[-1]; ndifat-=1
        dl=[x for x in dl if x<0xFFFFFFFA]
        s.fat=[]
        for x in dl: s.fat+=struct.unpack('<%dI'%(s.ss//4),s.sec(x))
        d = s.chain(dirstart)
        s.ents=[]
        for i in range(len(d)//128):
            e=d[i*128:(i+1)*128]
            nl=struct.unpack('<H',e[64:66])[0]
            name=e[:max(nl-2,0)].decode('utf-16le','ignore')
            typ=e[66]; l,r,c=struct.unpack('<III',e[68:80]); st=struct.unpack('<I',e[116:120])[0]; sz=struct.unpack('<Q',e[120:128])[0]
            s.ents.append(dict(name=name,typ=typ,l=l,r=r,c=c,st=st,sz=sz))
        s.mini=b''
        if minifat<0xFFFFFFFA:
            mf=s.chain(minifat); s.minifat=struct.unpack('<%dI'%(len(mf)//4),mf)
            s.mini=s.chain(s.ents[0]['st'])[:s.ents[0]['sz']]
    def sec(s,i):
        s.f.seek((i+1)*s.ss if s.ss>512 else 512+i*s.ss); return s.f.read(s.ss)
    def chain(s,st):
        out=[]; seen=0
        while st<0xFFFFFFFA:
            out.append(s.sec(st)); st=s.fat[st]
        return b''.join(out)
    def read(s,e):
        if e['sz']<s.cutoff and s.mini:
            out=[];st=e['st']
            while st<0xFFFFFFFA:
                out.append(s.mini[st*s.mss:(st+1)*s.mss]); st=s.minifat[st]
            return b''.join(out)[:e['sz']]
        return s.chain(e['st'])[:e['sz']]
    def walk(s,i=None,path=''):
        if i is None: i=s.ents[0]['c']; 
        res=[]
        def rec(i,path):
            if i==0xFFFFFFFF: return
            e=s.ents[i]; rec(e['l'],path)
            p=path+'/'+e['name']; res.append((p,e))
            if e['typ']==1: rec(e['c'],p)
            rec(e['r'],path)
        rec(s.ents[0]['c'],''); return res

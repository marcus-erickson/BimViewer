import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ole import Ole
import os
for p in sys.argv[1:]:
    print("=====",os.path.basename(p)); o=Ole(p)
    for path,e in o.walk():
        if e['typ']==2: print("  %-40s %9d"%(path,e['sz']))
    bf=[e for pth,e in o.walk() if pth=='/BasicFileInfo'][0]
    print(o.read(bf).decode('utf-16le','ignore')[:1500])

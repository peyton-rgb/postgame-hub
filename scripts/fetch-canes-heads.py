#!/usr/bin/env python3
import json, urllib.parse, urllib.request, os, re
from PIL import Image, ImageDraw, ImageFont

OUT = "public/run-of-show/heads"
os.makedirs(OUT, exist_ok=True)
def slug(s): return re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')

# (display_name, gender W/M, school keyword, search_override_or_None)
FETCH = [
 ("Ahnay Adams","W","miami",None),("Kennedy Lee","W","san diego",None),
 ("Ian Jackson","M","st. john",None),("Taryn Sides","W","kansas state",None),
 ("Hannah Hidalgo","W","notre dame",None),("Wes Enis","M","south florida",None),
 ("Mercy Miller","M","houston",None),("Daniel Jacobsen","M","purdue",None),
 ("Karter Knox","M","arkansas",None),("Janae Kent","W","texas a&m",None),
 ("Connor Essegian","M","nebraska",None),("Taylor Charles","W","princeton",None),
 ("Kennedy Smith","W","usc",None),("John Mobley Jr","M","ohio state","John Mobley"),
 ("Jordana Acodio","W","seton hall","Jordana Codio"),
 ("Jermaine O'Neil Jr","M","smu","Jermaine O'Neal"),
 ("Billy Richmond","M","arkansas",None),("Blake Buchanan","M","iowa state",None),
 ("Isaac Williams","M","baylor",None),("Jalynn Bristow","W","texas tech",None),
 ("Boogie Fland","M","florida",None),("Madison Booker","W","texas",None),
 ("Kylee Kitts","W","ohio state",None),("Zoom Diallo","M","washington",None),
 ("Amari Whiting","W","oklahoma state",None),("Tajianna Roberts","W","louisville",None),
 ("Nic Anderson","M","loyola",None),("Derek Dixon","M","north carolina",None),
 ("Acaden Lewis","M","villanova",None),("Addy Brown","W","",None),
]
PLACEHOLDERS = ["Nylah Wilson","Cruz Davis","Taylen Kinney","KJ Lewis","Trey Autry"]

def espn_players(q):
    url="https://site.web.api.espn.com/apis/search/v2?limit=15&query="+urllib.parse.quote(q)
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    d=json.load(urllib.request.urlopen(req,timeout=20)); acc=[]
    def walk(o):
        if isinstance(o,dict):
            if o.get('type')=='player' and o.get('sport')=='basketball': acc.append(o)
            for v in o.values(): walk(v)
        elif isinstance(o,list):
            for v in o: walk(v)
    walk(d); return acc

def placeholder(name, path):
    ini="".join(w[0] for w in name.split()[:2]).upper()
    im=Image.new("RGB",(400,360),(7,7,10)); dr=ImageDraw.Draw(im)
    try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",150)
    except: f=ImageFont.load_default()
    bb=dr.textbbox((0,0),ini,font=f)
    dr.text(((400-(bb[2]-bb[0]))/2-bb[0],(360-(bb[3]-bb[1]))/2-bb[1]-20),ini,font=f,fill=(215,63,9))
    try: f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",26)
    except: f2=ImageFont.load_default()
    b2=dr.textbbox((0,0),"ADD PHOTO",font=f2)
    dr.text(((400-(b2[2]-b2[0]))/2,300),"ADD PHOTO",font=f2,fill=(150,150,150))
    im.save(path)

real=0
for name,g,kw,q in FETCH:
    want='NCAAW' if g=='W' else 'NCAAM'; path=f"{OUT}/{slug(name)}.png"
    try:
        acc=espn_players(q or name)
        cands=[p for p in acc if p.get('description')==want]
        pick=next((p for p in cands if kw and kw in (p.get('subtitle','') or '').lower()), None) \
             or (cands[0] if cands else (acc[0] if acc else None))
        img=(pick.get('image') or {}).get('default') if pick and isinstance(pick.get('image'),dict) else None
        if img:
            req=urllib.request.Request(img,headers={'User-Agent':'Mozilla/5.0'})
            open(path,'wb').write(urllib.request.urlopen(req,timeout=20).read())
            print(f"OK  {name:<20} <- {pick.get('subtitle')}"); real+=1
        else:
            placeholder(name,path); print(f"PH  {name:<20} (no ESPN image)")
    except Exception as e:
        placeholder(name,path); print(f"PH  {name:<20} ({e})")

for name in PLACEHOLDERS:
    placeholder(name,f"{OUT}/{slug(name)}.png"); print(f"PH  {name:<20} (forced)")

# contact sheet for human review
files=sorted(os.listdir(OUT))
cols=5; cell=200; lbl=24; rows=(len(files)+cols-1)//cols
sheet=Image.new("RGB",(cols*cell,rows*(cell+lbl)),(245,243,240)); dr=ImageDraw.Draw(sheet)
try: f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",12)
except: f=ImageFont.load_default()
for i,fn in enumerate(files):
    r,c=divmod(i,cols); x,y=c*cell,r*(cell+lbl)
    im=Image.open(f"{OUT}/{fn}").convert("RGBA"); im.thumbnail((cell-16,cell-16))
    bg=Image.new("RGBA",(cell-16,cell-16),(255,255,255,255)); bg.alpha_composite(im,((bg.width-im.width)//2,(bg.height-im.height)//2))
    sheet.paste(bg.convert("RGB"),(x+8,y+8)); dr.text((x+8,y+cell-6),fn.replace(".png",""),fill=(20,20,20),font=f)
sheet.save("public/run-of-show/_contact_sheet.png")
print(f"\n{real}/{len(FETCH)} real headshots + {len(PLACEHOLDERS)} forced placeholders")
print("Review: open public/run-of-show/_contact_sheet.png")

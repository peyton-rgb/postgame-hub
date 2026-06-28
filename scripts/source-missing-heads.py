#!/usr/bin/env python3
"""One-off: source the 5 ESPN-miss headshots from official school roster pages
(Sidearm og:image), square-crop upper-biased to the face, write 400x400 PNGs into
public/run-of-show/heads/. Builds a contact sheet for human review before staging."""
import urllib.request, io, os
from PIL import Image, ImageDraw, ImageFont

OUT = "public/run-of-show/heads"
os.makedirs(OUT, exist_ok=True)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# (file_slug, display, source_label, og:image url)
# Only the 3 current-school headshots are applied. Cruz Davis (Texas Tech) and
# Trey Autry (Wisconsin) are not yet on their new-school roster pages; their only
# official headshots are prior-school, so per review they stay placeholders. The
# prior-school URLs are kept here for the record if their new photos never land:
#   Trey Autry (George Washington): https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fgwsports.com%2Fimages%2F2025%2F10%2F24%2FAutry.jpg&width=1600&type=jpeg
#   Cruz Davis  (Hofstra):          https://gohofstra.com/images/2025/10/29/Headshots_2526_Davis.jpg
SRC = [
 ("nylah_wilson", "Nylah Wilson", "West Virginia (current)",
  "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fwvuni.sidearmsports.com%2Fimages%2F2026%2F6%2F8%2Fwilson-nylah-CROP.png&width=1600&type=jpeg"),
 ("taylen_kinney", "Taylen Kinney", "Kansas (current)",
  "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fukansas.sidearmsports.com%2Fimages%2F2026%2F6%2F22%2FKinney_Taylen.jpg&width=1600&type=jpeg"),
 ("kj_lewis", "KJ Lewis", "USC (current)",
  "https://images.sidearmdev.com/resize?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fusctrojans.com%2Fimages%2F2026%2F6%2F2%2F2627MBB-02-LEWIS_-KJ.jpg&width=1600&type=jpeg"),
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read()))

def square_upper(im, bias=0.12):
    """Largest square, horizontally centered; for portrait images bias the crop
    toward the top so it lands on the face, not the torso/jersey."""
    im = im.convert("RGB")
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = int((h - s) * bias) if h > s else 0
    return im.crop((left, top, left + s, top + s)).resize((400, 400), Image.LANCZOS)

results = []
for slug, disp, label, url in SRC:
    try:
        im = square_upper(fetch(url))
        im.save(f"{OUT}/{slug}.png")
        results.append((slug, disp, label, True))
        print(f"OK  {disp:<16} <- {label}")
    except Exception as e:
        results.append((slug, disp, label, False))
        print(f"FAIL {disp:<16} ({e})")

# contact sheet
cols = len(results); cell = 220; lbl = 40
sheet = Image.new("RGB", (cols * cell, cell + lbl), (245, 243, 240))
dr = ImageDraw.Draw(sheet)
try:
    fb = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
    fr = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
except Exception:
    fb = fr = ImageFont.load_default()
for i, (slug, disp, label, ok) in enumerate(results):
    x = i * cell
    if ok:
        th = Image.open(f"{OUT}/{slug}.png"); th.thumbnail((cell - 20, cell - 20))
        sheet.paste(th, (x + 10, 10))
    else:
        dr.rectangle((x + 10, 10, x + cell - 10, cell - 10), outline=(200, 0, 0), width=2)
        dr.text((x + 24, cell // 2), "FAILED", fill=(200, 0, 0), font=fb)
    dr.text((x + 10, cell + 2), disp, fill=(15, 15, 15), font=fb)
    dr.text((x + 10, cell + 20), label, fill=(120, 60, 20) if "PRIOR" in label else (60, 60, 60), font=fr)
sheet.save("public/run-of-show/_headshot_check.png")
print("\nReview: open public/run-of-show/_headshot_check.png")

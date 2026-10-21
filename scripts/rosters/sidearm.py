#!/usr/bin/env python3
"""Scrape every roster on one Sidearm athletics site -> JSON lines (new + classic layouts).
D1 run 2026-10-20: 334 schools, 143,649 athletes, 24% with an Instagram handle on the roster page.
Usage: sidearm.py <athletics domain> <out.jsonl>"""
import re, sys, json, html as H, time, urllib.request
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sidearm_classic import parse_classic  # older Sidearm layout + follows 308 redirects
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36"
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.geturl(), r.read().decode("utf8", "ignore")
def clean(s): return " ".join(H.unescape(re.sub(r"<[^>]+>", " ", s)).split())
FIELDS = ["Position", "Academic Year", "Height", "Weight", "Hometown", "Last School", "Previous School"]
def parse_card(p):
    p = p[:25000]
    m = re.search(r'aria-label="([^"]+?) full bio"', p)
    if not m: return None
    name = re.sub(r"\s+jersey number\s+\S+$", "", H.unescape(m.group(1))).strip()
    num = re.search(r"jersey number\s+(\S+)", m.group(1))
    ig = re.findall(r"instagram\.com/(?:https?://(?:www\.)?instagram\.com/)?@?([A-Za-z0-9_.]+)", p)
    t = clean(" ".join(re.findall(r"s-person-details__bio-stats[^>]*>(.*?)Full Bio", p, re.S)))
    out = {"name": name, "jersey": num.group(1) if num else None, "instagram": ig[0].lower().strip(".") if ig else None}
    for i, f in enumerate(FIELDS):
        nxt = "|".join(re.escape(x) for x in FIELDS[i+1:]) or "$^"
        mm = re.search(re.escape(f) + r"\s+(.*?)(?=\s+(?:" + nxt + r")\s|$)", t)
        out[f.lower().replace(" ", "_")] = mm.group(1).strip() if mm else None
    if out.get("previous_school"): out["previous_school"] = out["previous_school"].replace("Previous:", "").strip()
    return out
def main(domain, outp):
    base = "https://" + domain.replace("https://", "").replace("http://", "").strip("/")
    _, home = get(base + "/")
    sports = sorted(set(re.findall(r'href="(?:https?://[^"/]+)?/sports/([a-z0-9-]+)/roster', home)))
    if not sports:  # FALLBACK: splash/ad home pages hide the nav, try standard Sidearm sport slugs
        sports = ["baseball","football","mens-basketball","womens-basketball","softball","womens-volleyball","mens-volleyball",
          "mens-soccer","womens-soccer","mens-cross-country","womens-cross-country","mens-track-and-field","womens-track-and-field",
          "cross-country","track-and-field","mens-golf","womens-golf","mens-tennis","womens-tennis","mens-swimming-and-diving",
          "womens-swimming-and-diving","swimming-and-diving","womens-lacrosse","mens-lacrosse","field-hockey","wrestling",
          "womens-gymnastics","gymnastics","beach-volleyball","womens-beach-volleyball","mens-ice-hockey","womens-ice-hockey",
          "womens-rowing","rowing","bowling","womens-bowling","equestrian","rifle","fencing","water-polo","womens-water-polo","mens-water-polo"]
    n = 0
    with open(outp, "w") as f:
        for s in sports:
            try:
                url, h = get(f"{base}/sports/{s}/roster")
            except Exception as e:
                print("ERR", s, e, file=sys.stderr); continue
            cards = re.split(r'<div[^>]+class="s-person-card s-person-card--list', h)[1:]
            players = [c for c in (parse_card(x) for x in cards) if c and c.get("academic_year")] if cards else [c for c in parse_classic(h) if c.get("academic_year")]
            import collections as _c
            _d=_c.Counter(p["instagram"] for p in players if p["instagram"])
            for p in players:
                if p["instagram"] and _d[p["instagram"]]>1: p["instagram"]=None
            season = re.search(r'"season"\s*:\s*\{[^}]*"title"\s*:\s*"([^"]+)"', h)
            for pl in players:
                pl.update({"school_domain": domain, "sport": s, "roster_url": url, "season": season.group(1) if season else None})
                f.write(json.dumps(pl) + "\n"); n += 1
            print(f"{s}: {len(players)} players, {sum(1 for p in players if p['instagram'])} with IG", file=sys.stderr)
            time.sleep(0.4)
    print("TOTAL", n, file=sys.stderr)
if __name__ == "__main__": main(sys.argv[1], sys.argv[2])

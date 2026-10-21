#!/usr/bin/env python3
"""Roster scraper — WMT (Learfield) athletics sites. Table layout + card layout.
Usage: wmt.py <domain> <out.jsonl>"""
import re, sys, json, html as H, time, urllib.request, collections
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36"
class R308(urllib.request.HTTPRedirectHandler):
    def http_error_308(self, req, fp, code, msg, hdrs): return self.http_error_301(req, fp, 301, msg, hdrs)
urllib.request.install_opener(urllib.request.build_opener(R308))
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=40) as r:
        return r.geturl(), r.read().decode("utf8", "ignore")
def T(s): return " ".join(H.unescape(re.sub(r"<[^>]+>", " ", s or "")).split()) or None
def cell(row, k):
    m = re.search(r'roster-table-cell--' + k + r'[^"]*"[^>]*>(.*?)</t[dh]>', row, re.S)
    return T(m.group(1)) if m else None
def ig_of(s):
    m = re.findall(r'instagram\.com/@?([A-Za-z0-9_.]+)', s)
    return m[0].lower().strip(".") if m else None
def parse_table(h):
    out = []
    for row in re.split(r"<tr[ >]", h)[1:]:
        if "table__roster-name" not in row: continue
        nm = re.search(r'class="table__roster-name"[^>]*>(.*?)</a>', row, re.S)
        out.append({"name": T(nm.group(1)), "jersey": cell(row, "jersey-number"),
            "position": cell(row, "player-position"), "height": cell(row, "height"), "weight": cell(row, "weight"),
            "academic_year": cell(row, "class-level") or cell(row, "academic-year"),
            "hometown": cell(row, "hometown"), "last_school": cell(row, "high-school"),
            "previous_school": cell(row, "previous-school"), "instagram": ig_of(row)})
    return out
def parse_cards(h):
    out = []
    for c in h.split('class="roster-card-item"')[1:]:
        c = c[:8000]
        nm = re.search(r'roster-card-item__title[^>]*>(.*?)</a>', c, re.S)
        if not nm: continue
        basic = [T(x) for x in re.findall(r'profile-field__value--basic[^>]*>(.*?)</span>', c, re.S)]
        yr = next((b for b in basic if b and re.search(r"fresh|soph|junior|senior|grad|redshirt|^(fr|so|jr|sr|gr)\b", b, re.I)), None)
        lab = lambda k: T((re.search(r'profile-field__value--' + k + r'[^>]*>(.*?)</span>', c, re.S) or [None, None])[1])
        out.append({"name": T(nm.group(1)), "jersey": T((re.search(r'__jersey-number[^>]*>(.*?)<', c) or [None, None])[1]),
            "position": T((re.search(r'__position[^>]*>(.*?)<', c) or [None, None])[1]),
            "height": next((b for b in basic if b and re.search(r"\d\s*[′']", b)), None), "weight": None,
            "academic_year": yr, "hometown": lab("hometown"), "last_school": lab("school"),
            "previous_school": lab("previous-school"), "instagram": ig_of(c)})
    return out
def scrape(domain):
    base = "https://" + domain.strip("/")
    _, home = get(base + "/")
    rx = r'href="(?:https?://[^"/]+)?/sports/([a-z0-9-]+)/roster"'
    sports = sorted(set(re.findall(rx, home)))
    for probe in ("football", "mens-basketball", "womens-basketball"):
        if sports: break
        try: sports = sorted(set(re.findall(rx, get(f"{base}/sports/{probe}/roster")[1])))
        except Exception: pass
    for s in sports:
        try: url, h = get(f"{base}/sports/{s}/roster")
        except Exception as e: print("ERR", s, e, file=sys.stderr); continue
        rows = parse_table(h) or parse_cards(h)
        rows = [r for r in rows if r["name"] and r["academic_year"]]
        d = collections.Counter(r["instagram"] for r in rows if r["instagram"])
        for r in rows:
            if r["instagram"] and d[r["instagram"]] > 1: r["instagram"] = None
            r.update({"school_domain": domain, "sport": s, "roster_url": url, "has_instagram": bool(r["instagram"]), "platform": "wmt"})
            yield r
        print(f"{s}: {len(rows)} athletes, {sum(1 for r in rows if r['instagram'])} with IG", file=sys.stderr)
        time.sleep(0.4)
if __name__ == "__main__":
    n = 0
    with open(sys.argv[2], "w") as f:
        for r in scrape(sys.argv[1]): f.write(json.dumps(r) + "\n"); n += 1
    print("TOTAL", n, file=sys.stderr)

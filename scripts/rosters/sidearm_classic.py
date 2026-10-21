import re, html as H, urllib.request
class R308(urllib.request.HTTPRedirectHandler):
    def http_error_308(self, req, fp, code, msg, headers):
        return self.http_error_301(req, fp, 301, msg, headers)
urllib.request.install_opener(urllib.request.build_opener(R308))
def _t(s): return " ".join(H.unescape(re.sub(r"<[^>]+>", " ", s)).split())
def _cls(p, c):
    m = re.search(r'class="' + c + r'[^"]*"[^>]*>(.*?)</(?:span|div|p|h3)>', p, re.S)
    return _t(m.group(1)) if m else None
def parse_classic(page):
    out = []
    for p in page.split('<li class="sidearm-roster-player"')[1:]:
        p = p[:15000]
        nm = re.search(r'aria-label="([^"]+?) - View Full Bio"', p)
        if not nm: continue
        ig = re.findall(r"instagram\.com/@?([A-Za-z0-9_.]+)", p)
        yr = _cls(p, "sidearm-roster-player-academic-year")
        out.append({"name": H.unescape(nm.group(1)).strip(),
            "jersey": _cls(p, "sidearm-roster-player-jersey-number"),
            "instagram": ig[0].lower().strip(".") if ig else None,
            "position": _cls(p, "sidearm-roster-player-position-long-short"),
            "academic_year": yr, "height": _cls(p, "sidearm-roster-player-height"),
            "weight": _cls(p, "sidearm-roster-player-weight"),
            "hometown": _cls(p, "sidearm-roster-player-hometown"),
            "last_school": _cls(p, "sidearm-roster-player-highschool"),
            "previous_school": _cls(p, "sidearm-roster-player-previous-school")})
    return out

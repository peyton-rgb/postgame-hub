#!/usr/bin/env python3
"""
Roster scraper — Sidearm Sports athletics sites (most of NCAA D1).

Plain English: opens a school's athletics website, finds every sport's roster
page, and writes one line per ATHLETE (coaches/staff are dropped) with name,
sport, position, class year, height, weight, hometown, high school, previous
school (transfers) and the Instagram handle the school lists.

Instagram is how Postgame identifies athletes, so athletes without a handle on
the roster page are kept in the output but flagged has_instagram = false.

Usage:  python3 sidearm.py <athletics domain> <out.jsonl>
        python3 sidearm.py seminoles.com fsu.jsonl

Smoke test 2026-10-20 (Florida State): 19 sports, 499 athletes, 357 with a
handle (329 unique), 103 transfers.
School list: NCAA directory, D1 = 367 schools with athleticWebUrl
  https://web3.ncaa.org/directory/api/directory/memberList?type=12&division=I
Needs the open internet (run on the iMac, not the cloud workspace).
"""
import collections
import html as H
import json
import re
import sys
import time
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129 Safari/537.36")
FIELDS = ["Position", "Academic Year", "Height", "Weight", "Hometown", "Last School", "Previous School"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.geturl(), r.read().decode("utf8", "ignore")


def clean(s):
    return " ".join(H.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def parse_card(p):
    p = p[:25000]
    m = re.search(r'aria-label="([^"]+?) full bio"', p)
    if not m:
        return None
    raw = H.unescape(m.group(1))
    name = re.sub(r"\s+jersey number\s+\S+$", "", raw).strip()
    num = re.search(r"jersey number\s+(\S+)", raw)
    ig = re.findall(r"instagram\.com/(?:https?://(?:www\.)?instagram\.com/)?@?([A-Za-z0-9_.]+)", p)
    t = clean(" ".join(re.findall(r"s-person-details__bio-stats[^>]*>(.*?)Full Bio", p, re.S)))
    out = {"name": name, "jersey": num.group(1) if num else None,
           "instagram": ig[0].lower().strip(".") if ig else None}
    for i, f in enumerate(FIELDS):
        nxt = "|".join(re.escape(x) for x in FIELDS[i + 1:]) or "$^"
        mm = re.search(re.escape(f) + r"\s+(.*?)(?=\s+(?:" + nxt + r")\s|$)", t)
        out[f.lower().replace(" ", "_")] = mm.group(1).strip() if mm else None
    if out.get("previous_school"):
        out["previous_school"] = out["previous_school"].replace("Previous:", "").strip()
    return out


def scrape(domain):
    base = "https://" + domain.replace("https://", "").replace("http://", "").strip("/")
    _, home = get(base + "/")
    sports = sorted(set(re.findall(r'href="(?:https?://[^"/]+)?/sports/([a-z0-9-]+)/roster', home)))
    for s in sports:
        try:
            url, h = get(f"{base}/sports/{s}/roster")
        except Exception as e:  # one bad sport page shouldn't stop the school
            print("ERR", s, e, file=sys.stderr)
            continue
        cards = re.split(r'<div[^>]+class="s-person-card s-person-card--list', h)[1:]
        # Athletes have a class year; coaches and staff do not.
        athletes = [c for c in (parse_card(x) for x in cards) if c and c.get("academic_year")]
        # A handle repeated within one sport leaked from a neighbouring card: drop it.
        dup = collections.Counter(a["instagram"] for a in athletes if a["instagram"])
        for a in athletes:
            if a["instagram"] and dup[a["instagram"]] > 1:
                a["instagram"] = None
            a.update({"school_domain": domain, "sport": s, "roster_url": url,
                      "has_instagram": bool(a["instagram"])})
            yield a
        print(f"{s}: {len(athletes)} athletes, {sum(1 for a in athletes if a['instagram'])} with IG", file=sys.stderr)
        time.sleep(1)  # be polite to the school's site


def main(domain, outp):
    n = 0
    with open(outp, "w") as f:
        for a in scrape(domain):
            f.write(json.dumps(a) + "\n")
            n += 1
    print("TOTAL", n, file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

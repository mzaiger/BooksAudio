#!/usr/bin/env python3
"""Builds data/books.json, data/audiobooks.json, data/podcasts.json from Apple's free, keyless charts + lookup API."""
import json, re, sys, time, html, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

UA = {"User-Agent": "BooksAndAudio/1.0"}
CHARTS = {
    "books":      ["https://rss.marketingtools.apple.com/api/v2/us/books/top-paid/100/books.json",
                   "https://rss.marketingtools.apple.com/api/v2/us/books/top-free/100/books.json"],
    "audiobooks": ["https://rss.marketingtools.apple.com/api/v2/us/audio-books/top/100/audio-books.json"],
    "podcasts":   ["https://rss.marketingtools.apple.com/api/v2/us/podcasts/top/100/podcasts.json"],
}
MONTHS = [1, 2, 3, 6, 12]

def get(url, limit=None, timeout=25):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read(limit) if limit else r.read()

def chart(urls):
    """Try each chart URL up to 3 times (502s from Apple are usually temporary)."""
    last = None
    for u in urls:
        for n in range(3):
            try:
                return json.loads(get(u))["feed"]["results"]
            except Exception as e:
                last = e; print("chart retry:", u.split("/us/")[1], e, file=sys.stderr); time.sleep(3 * (n + 1))
    raise last

def clean(s, n=600):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"

def lookup(ids):
    out = {}
    for i in range(0, len(ids), 50):
        try:
            d = json.loads(get("https://itunes.apple.com/lookup?id=" + ",".join(ids[i:i+50])))
            for r in d.get("results", []):
                out[str(r.get("trackId") or r.get("collectionId"))] = r
        except Exception as e:
            print("lookup failed:", e, file=sys.stderr)
    return out

def feed_info(url):
    """Channel description + earliest pubDate. Date is None if the feed is too big to read fully (so old shows never look new)."""
    try:
        raw = get(url, 6_000_000, 30)
    except Exception:
        return "", None
    text = raw.decode("utf-8", "ignore")
    full = len(raw) < 6_000_000
    head = text.split("<item", 1)[0]
    m = re.search(r"<(?:itunes:summary|description)[^>]*>(.*?)</(?:itunes:summary|description)>", head, re.S)
    desc = clean(re.sub(r"<!\[CDATA\[|\]\]>", "", m.group(1))) if m else ""
    dates = []
    for p in re.findall(r"<pubDate>(.*?)</pubDate>", text):
        try: dates.append(parsedate_to_datetime(p.strip()))
        except Exception: pass
    return desc, (min(dates).date().isoformat() if dates and full else None)

def build(key):
    res = chart(CHARTS[key])
    ids = [str(r["id"]) for r in res]
    look = lookup(ids)
    items = []
    for pos, r in enumerate(res, 1):
        l = look.get(str(r["id"]), {})
        img = (l.get("artworkUrl100") or r.get("artworkUrl100") or "").replace("100x100bb", "400x400bb")
        it = {"id": str(r["id"]), "title": r.get("name") or l.get("trackName") or l.get("collectionName"),
              "author": r.get("artistName", ""), "image": img, "url": r.get("url") or l.get("trackViewUrl") or l.get("collectionViewUrl"),
              "metric": pos, "desc": clean(l.get("description")), "date": (r.get("releaseDate") or l.get("releaseDate") or "")[:10] or None,
              "genre": ", ".join(g.get("name", "") if isinstance(g, dict) else g for g in r.get("genres", [])[:2])}
        if key == "podcasts":
            it["feed"] = l.get("feedUrl"); it["desc"] = ""; it["date"] = None
        items.append(it)
    if key == "podcasts":
        with ThreadPoolExecutor(12) as ex:
            infos = list(ex.map(lambda i: feed_info(i["feed"]) if i["feed"] else ("", None), items))
        for it, (d, dt) in zip(items, infos):
            it["desc"] = d or it["genre"]; it["date"] = dt; it.pop("feed", None)
    # ranks: 0 = All (current chart position); 1..12 = position among items launched within the last 12 months
    today = datetime.now(timezone.utc).date()
    recent = [i for i in items if i["date"] and datetime.fromisoformat(i["date"]).date() >= today - timedelta(days=366)]
    recent.sort(key=lambda i: i["metric"])
    rank12 = {i["id"]: n for n, i in enumerate(recent, 1)}
    for it in items:
        it["ranks"] = {"0": it["metric"]}
        if it["id"] in rank12:
            age = (today - datetime.fromisoformat(it["date"]).date()).days
            for m in MONTHS:
                if age <= m * 30.5 + 1 or m == 12:
                    it["ranks"][str(m)] = rank12[it["id"]]
    return {"updated": datetime.now(timezone.utc).isoformat(), "metric": "apple chart", "items": items}

if __name__ == "__main__":
    for k in CHARTS:
        try:
            d = build(k)
            json.dump(d, open(f"data/{k}.json", "w"), ensure_ascii=False, separators=(",", ":"))
            print(k, len(d["items"]), "items")
        except Exception as e:
            print(k, "FAILED, keeping old file:", e, file=sys.stderr)

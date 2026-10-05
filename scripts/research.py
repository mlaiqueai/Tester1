#!/usr/bin/env python3
"""Gather today's research packet from FREE, keyless sources.

  Prices:  Yahoo Finance chart API — a diagnostics/lab/tools basket + benchmarks.
  News:    Google News RSS (broad, recent) + Bing News RSS (adds article snippets),
           filtered to recent items and de-duplicated across sections.

The packet is plain text with a size budget, so the writing step gets the
highest-signal items rather than everything the feeds return.
Standard library only. Every source is best-effort: a dead feed shrinks the
packet, it never crashes the run.

Usage (standalone check):  python research.py [out_packet.txt]
"""
import datetime as dt
import email.utils
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

# Public diagnostics / lab / tools names. Symbols that no longer trade (acquired,
# taken private) simply drop out of the packet — no need to prune by hand.
TICKERS = [
    ("Natera", "NTRA"), ("Guardant Health", "GH"), ("Quest Diagnostics", "DGX"),
    ("Labcorp", "LH"), ("Veracyte", "VCYT"), ("Tempus AI", "TEM"), ("GRAIL", "GRAL"),
    ("Illumina", "ILMN"), ("QuidelOrtho", "QDEL"), ("NeoGenomics", "NEO"),
    ("CareDx", "CDNA"), ("Castle Biosciences", "CSTL"), ("Personalis", "PSNL"),
    ("Fulgent Genetics", "FLGT"), ("Bio-Techne", "TECH"), ("Danaher", "DHR"),
    ("Abbott", "ABT"), ("Thermo Fisher", "TMO"), ("Becton Dickinson", "BDX"),
    ("Roche (ADR)", "RHHBY"), ("Exact Sciences", "EXAS"), ("Hologic", "HOLX"),
]
BENCHMARKS = [("S&P 500", "^GSPC"), ("Nasdaq Composite", "^IXIC"),
              ("Biotech ETF (XBI)", "XBI"), ("Medical Devices ETF (IHI)", "IHI")]

# (section, max items kept, max age in days, [queries]). Order = priority when trimming.
SECTIONS = [
    ("PRIVATE MARKETS — venture, private equity, M&A, IPOs", 10, 7, [
        'diagnostics (raises OR "Series A" OR "Series B" OR "Series C" OR financing)',
        '("to acquire" OR acquires OR acquisition) (diagnostics OR "clinical laboratory")',
        '"private equity" (laboratory OR diagnostics)',
        "site:genomeweb.com funding OR acquisition",
        "site:360dx.com funding OR acquisition",
        "site:medtechdive.com diagnostics",
        "diagnostics IPO",
    ]),
    ("PUBLIC MARKETS — diagnostics & lab stocks", 8, 4, [
        "diagnostics stock shares analyst",
        'Natera OR Guardant OR "Quest Diagnostics" OR Labcorp OR Tempus OR Grail',
        "diagnostics company earnings guidance revenue",
    ]),
    ("REGULATION & REIMBURSEMENT", 8, 5, [
        "FDA laboratory developed tests LDT",
        "CMS MolDX coverage diagnostic test",
        "clinical laboratory fee schedule PAMA",
        "FDA approval OR clearance diagnostic test",
    ]),
    ("CLINICAL & MARKET TRENDS — focus areas", 10, 4, [
        "minimal residual disease MRD test",
        "multi-cancer early detection blood test",
        "Alzheimer's blood test",
        "sepsis OR infectious disease rapid diagnostic test",
        "colorectal cancer screening blood test",
        "transplant rejection OR kidney disease diagnostic test",
    ]),
]

# An item must mention diagnostics/lab language or a tracked company to count —
# generic finance, hospital, and lifestyle stories are dropped.
EXTRA_COMPANIES = ["Qiagen", "Bio-Rad", "Agilent", "Siemens Healthineers", "bioMérieux",
                   "Sysmex", "Myriad", "Adaptive Biotechnologies", "Freenome", "Cepheid",
                   "Beckman", "Exact Sciences", "Hologic", "Twist Bioscience",
                   "Pacific Biosciences", "Oxford Nanopore", "Bioreference", "ARUP", "Mayo Clinic Labs"]
RELEVANT = re.compile(
    r"diagnos|assay|\btests?\b|testing|laborator|genomic|sequenc|biomarker|screening|"
    r"patholog|molecular|liquid biopsy|\bmrd\b|\bivd\b|\bldts?\b|\bclia\b|moldx|\bpama\b|"
    r"companion diagnostic|precision medicine|"
    + "|".join(re.escape(n.split(" (")[0].lower()) for n, _ in TICKERS)
    + "|" + "|".join(re.escape(n.lower()) for n in EXTRA_COMPANIES),
    re.IGNORECASE)

PACKET_CHAR_BUDGET = 17000  # ~4.3K tokens; leaves room for instructions


def _get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _clean(text):
    text = re.sub(r"<[^>]+>", " ", html.unescape(text or ""))
    return re.sub(r"\s+", " ", text).strip()


def _key(title):
    return re.sub(r"[^a-z0-9]", "", title.lower())[:60]


# ------------------------------ prices ------------------------------
def quote(symbol):
    """(last_close, pct_1d, pct_5d, as_of_date) or None."""
    for host in ("query1", "query2"):
        url = (f"https://{host}.finance.yahoo.com/v8/finance/chart/"
               f"{urllib.parse.quote(symbol)}?range=1mo&interval=1d")
        try:
            r = json.loads(_get(url))["chart"]["result"][0]
            pts = [(t, c) for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"])
                   if c is not None]
            if len(pts) < 6:
                return None
            last = pts[-1][1]
            as_of = dt.datetime.fromtimestamp(pts[-1][0], dt.timezone.utc).date()
            return (last, 100 * (last / pts[-2][1] - 1), 100 * (last / pts[-6][1] - 1), as_of)
        except Exception:  # noqa: BLE001 — try the other host, then give up
            time.sleep(0.5)
    return None


def market_block():
    rows, missing, as_of = [], [], None
    for name, sym in BENCHMARKS + TICKERS:
        q = quote(sym)
        if q is None:
            missing.append(sym)
            continue
        last, d1, d5, day = q
        as_of = max(as_of, day) if as_of else day
        rows.append((name, sym, last, d1, d5, (name, sym) in BENCHMARKS))
        time.sleep(0.15)
    if not rows:
        return "MARKET DATA: unavailable this run.", missing
    lines = [f"MARKET DATA (closing prices as of {as_of}; 1-day and 5-day % change):"]
    for name, sym, last, d1, d5, bench in rows:
        tag = "benchmark" if bench else sym
        lines.append(f"- {name} [{tag}]: {last:,.2f} | 1d {d1:+.1f}% | 5d {d5:+.1f}%")
    stocks = [r for r in rows if not r[5]]
    if stocks:
        movers = sorted(stocks, key=lambda r: abs(r[3]), reverse=True)[:4]
        lines.append("Biggest 1-day movers in the basket: " + "; ".join(
            f"{r[0]} {r[3]:+.1f}%" for r in movers))
    return "\n".join(lines), missing


# ------------------------------ news ------------------------------
def _pubdate(text):
    try:
        d = email.utils.parsedate_to_datetime(text)
    except Exception:  # noqa: BLE001
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def google_news(query, days):
    url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(f"{query} when:{days}d")
           + "&hl=en-US&gl=US&ceid=US:en")
    out = []
    for it in ET.fromstring(_get(url)).iter("item"):
        title = _clean(it.findtext("title"))
        src_el = it.find("source")
        source = _clean(src_el.text) if src_el is not None else ""
        if source and title.endswith(f" - {source}"):
            title = title[: -(len(source) + 3)].strip()
        out.append({"title": title, "source": source, "snippet": "",
                    "when": _pubdate(it.findtext("pubDate") or "")})
    return out


def bing_news(query, days):  # noqa: ARG001 — Bing has no reliable age operator; filtered later
    url = ("https://www.bing.com/news/search?format=rss&setlang=en-us&q="
           + urllib.parse.quote(query))
    out = []
    for it in ET.fromstring(_get(url)).iter("item"):
        source = ""
        for child in it:
            if child.tag.endswith("Source"):
                source = _clean(child.text)
        out.append({"title": _clean(it.findtext("title")), "source": source,
                    "snippet": _clean(it.findtext("description"))[:320],
                    "when": _pubdate(it.findtext("pubDate") or "")})
    return out


def news_sections(now):
    seen, sections = {}, []
    for label, cap, days, queries in SECTIONS:
        cutoff = now - dt.timedelta(days=days)
        pool = []
        for q in queries:
            fetchers = (google_news,) if q.startswith("site:") else (bing_news, google_news)
            for fetch in fetchers:
                try:
                    pool.extend(fetch(q, days))
                except Exception as e:  # noqa: BLE001
                    print(f"  {fetch.__name__}('{q}') failed: {e}", file=sys.stderr)
                time.sleep(0.3)
        kept = []
        for item in pool:
            if not item["title"] or (item["when"] and item["when"] < cutoff):
                continue
            if not RELEVANT.search(item["title"] + " " + item["snippet"]):
                continue
            k = _key(item["title"])
            if k in seen:                        # duplicate: borrow a snippet if we lack one
                if item["snippet"] and not seen[k]["snippet"]:
                    seen[k]["snippet"] = item["snippet"]
                continue
            seen[k] = item
            kept.append(item)
        # newest first, prefer items with snippets (more facts per token)
        kept.sort(key=lambda i: (bool(i["snippet"]),
                                 i["when"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc)),
                  reverse=True)
        sections.append((label, kept[:cap]))
    return sections


def _fmt_item(i):
    when = i["when"].strftime("%b %d") if i["when"] else "recent"
    line = f"- {i['title']} ({i['source'] or 'news'}, {when})"
    if i["snippet"] and _key(i["snippet"]) != _key(i["title"]):
        line += f"\n  > {i['snippet']}"
    return line


def build_packet(run_date):
    now = dt.datetime.now(dt.timezone.utc)
    print("Fetching market data...")
    market, missing = market_block()
    if missing:
        print(f"  no quote for: {', '.join(missing)}")
    print("Fetching news...")
    sections = news_sections(now)
    parts = [f"RESEARCH PACKET — {run_date}", "", market, ""]
    for label, items in sections:
        parts.append(f"{label}:")
        parts.extend(_fmt_item(i) for i in items) if items else parts.append("- (nothing new found)")
        parts.append("")
    packet = "\n".join(parts).strip()
    # Trim lowest-priority items from the end until under budget.
    while len(packet) > PACKET_CHAR_BUDGET:
        lines = packet.splitlines()
        cut = max(i for i, ln in enumerate(lines) if ln.startswith("- "))
        end = cut + 1 + (1 if cut + 1 < len(lines) and lines[cut + 1].startswith("  >") else 0)
        packet = "\n".join(lines[:cut] + lines[end:])
    n_news = sum(len(items) for _, items in sections)
    print(f"Packet: {len(packet):,} chars, {n_news} news items")
    return packet, n_news


if __name__ == "__main__":
    pkt, _ = build_packet(dt.date.today().isoformat())
    if len(sys.argv) > 1:
        open(sys.argv[1], "w", encoding="utf-8").write(pkt)
    else:
        print(pkt)

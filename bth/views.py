"""HTML rendering. No template engine, no build step — plain strings.

The colour language is the platform's own: green tiles are co-invest, orange is
consulting, purple is know-how, and a gate is only ever green or red.
"""

from html import escape

from . import config

CSS = """
:root {
  --bg:#f7f7f5; --panel:#fff; --ink:#16161a; --muted:#6b6b78; --line:#e3e3de;
  --green:#1a7f4b; --green-bg:#e6f4ec; --orange:#b4600a; --orange-bg:#fdf0e2;
  --purple:#6b3fa0; --purple-bg:#f1eaf9; --red:#b3261e; --red-bg:#fbeae9;
  --accent:#16161a;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#131316; --panel:#1b1b20; --ink:#f2f2f0; --muted:#a0a0ac; --line:#2c2c34;
    --green:#5bc48b; --green-bg:#16301f; --orange:#e2a35c; --orange-bg:#33240f;
    --purple:#b491e0; --purple-bg:#241a33; --red:#f08b83; --red-bg:#331715;
    --accent:#f2f2f0;
  }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 -apple-system,
  BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif; }
a { color:inherit; }
header { border-bottom:1px solid var(--line); background:var(--panel); }
.wrap { max-width:1100px; margin:0 auto; padding:0 16px; }
header .wrap { display:flex; flex-wrap:wrap; align-items:baseline; gap:18px; padding-top:14px;
  padding-bottom:14px; }
.brand { font-weight:650; letter-spacing:-.01em; }
.brand small { display:block; font-weight:400; color:var(--muted); font-size:12px; }
nav { display:flex; flex-wrap:wrap; gap:14px; margin-left:auto; font-size:14px; }
nav a { color:var(--muted); text-decoration:none; }
nav a:hover, nav a.on { color:var(--ink); }
main { padding:26px 0 60px; }
h1 { font-size:22px; margin:0 0 4px; letter-spacing:-.015em; }
h2 { font-size:15px; margin:30px 0 10px; letter-spacing:-.01em; }
.sub { color:var(--muted); margin:0 0 22px; }
.grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
.stat .k { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
.stat .v { font-size:24px; font-weight:600; letter-spacing:-.02em; margin-top:4px; }
.stat .n { color:var(--muted); font-size:12px; margin-top:2px; }
table { width:100%; border-collapse:collapse; background:var(--panel);
  border:1px solid var(--line); border-radius:10px; overflow:hidden; }
th, td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); font-size:14px;
  vertical-align:top; }
th { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
tr:last-child td { border-bottom:none; }
.tag { display:inline-block; padding:1px 8px; border-radius:20px; font-size:12px; font-weight:550;
  white-space:nowrap; }
.green { color:var(--green); background:var(--green-bg); }
.orange { color:var(--orange); background:var(--orange-bg); }
.purple { color:var(--purple); background:var(--purple-bg); }
.red { color:var(--red); background:var(--red-bg); }
.muted { color:var(--muted); }
.bar { height:6px; border-radius:4px; background:var(--line); overflow:hidden; margin-top:7px; }
.bar span { display:block; height:100%; background:var(--accent); }
form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:10px 0 0; }
input, select, textarea { font:inherit; padding:7px 9px; border:1px solid var(--line);
  border-radius:7px; background:var(--bg); color:var(--ink); }
textarea { width:100%; min-height:56px; }
button { font:inherit; font-weight:550; padding:7px 14px; border:1px solid var(--line);
  border-radius:7px; background:var(--ink); color:var(--bg); cursor:pointer; }
button.ghost { background:transparent; color:var(--ink); }
.flash { border:1px solid var(--line); border-left:3px solid var(--accent); background:var(--panel);
  padding:10px 14px; border-radius:8px; margin-bottom:18px; }
.stagebar { display:flex; gap:6px; flex-wrap:wrap; margin:12px 0 4px; }
.stagebar div { flex:1 1 120px; padding:7px 10px; border-radius:7px; border:1px solid var(--line);
  font-size:12px; color:var(--muted); background:var(--panel); }
.stagebar div.done { border-color:transparent; }
.split { display:grid; gap:16px; grid-template-columns:1fr; }
@media (min-width:860px) { .split { grid-template-columns:3fr 2fr; } }
"""

NAV = (("/", "Dashboard"), ("/board", "Pipeline"), ("/experts", "Brain trust"),
       ("/economics", "Economics"), ("/network", "Network"), ("/fund", "Fund"))


def page(title, body, path="/", flash=None):
    nav = "".join(
        f'<a href="{href}" class="{"on" if href == path else ""}">{escape(label)}</a>'
        for href, label in NAV)
    flash_html = f'<div class="flash">{escape(flash)}</div>' if flash else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} · Brain Trust Holdings</title><style>{CSS}</style></head>
<body><header><div class="wrap">
<div class="brand">Brain Trust Holdings<small>Platform &amp; Fund — operating console</small></div>
<nav>{nav}</nav></div></header>
<main><div class="wrap">{flash_html}{body}</div></main></body></html>"""


def money(cents):
    value = cents / 100
    if abs(value) >= 1_000_000:
        return f"${value / 1_000_000:,.1f}M"
    if abs(value) >= 1_000:
        return f"${value / 1_000:,.1f}k"
    return f"${value:,.0f}"


def usd(amount):
    if abs(amount) >= 1_000_000:
        return f"${amount / 1_000_000:,.1f}M"
    if abs(amount) >= 1_000:
        return f"${amount / 1_000:,.0f}k"
    return f"${amount:,.0f}"


def stat(label, value, note=""):
    note_html = f'<div class="n">{escape(note)}</div>' if note else ""
    return (f'<div class="card stat"><div class="k">{escape(label)}</div>'
            f'<div class="v">{value}</div>{note_html}</div>')


def bar(pct):
    return f'<div class="bar"><span style="width:{min(100.0, max(0.0, pct)):.0f}%"></span></div>'


def tile_tag(tile):
    return f'<span class="tag {tile}">{escape(config.TILES[tile])}</span>'


def signal_tag(signal):
    tone = {"positive": "green", "negative": "red", "split": "orange",
            "inconclusive": "muted"}.get(signal, "muted")
    return f'<span class="tag {tone}">{escape(signal)}</span>'


def table(headers, rows):
    head = "".join(f"<th>{h}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"

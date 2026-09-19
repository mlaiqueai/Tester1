"""The console: a WSGI app on the standard library, no dependencies.

Run it with `python3 run_bth.py serve`. Every page has a JSON twin under /api
so the same numbers can be pulled into a board pack without scraping HTML.
"""

import json
import re
from html import escape
from urllib.parse import parse_qs, quote

from . import config, consensus, db, economics, experts, kpi, pipeline
from .views import (bar, money, page, signal_tag, stat, table, tile_tag, usd)

ROUTES = []


def _waiting_on(item):
    """One line for the board: what stands between this deal and a decision."""
    if item["blockers"]:
        return "; ".join(item["blockers"])
    if item.get("only_decision_available") == "red":
        return "decidable — but the evidence only supports a red"
    return "ready for the IC"


def route(method, pattern):
    compiled = re.compile(f"^{pattern}$")

    def wrap(fn):
        ROUTES.append((method, compiled, fn))
        return fn
    return wrap


# ------------------------------------------------------------------ pages
@route("GET", "/")
def dashboard(conn, _params, _path):
    data = kpi.dashboard(conn)
    fund, ledger = data["fund"], data["ledger"]["total"]
    board = pipeline.board(conn)
    live = [o for o in board if o["status"] == "active"]
    waiting = [o for o in live if not o["ready"]]

    cards = "".join([
        stat("Checkpoints met", f"{data['checkpoints_met']}/{data['checkpoints_total']}",
             "against the end-2028 tranche"),
        stat("Live opportunities", len(live), f"{len(waiting)} waiting on evidence"),
        stat("Platform revenue", money(ledger["gross"]),
             f"{money(ledger['retained'])} retained ({ledger['retention_pct']}%)"),
        stat("Paid to the network", money(ledger["paid"]), "physicians, sites, institutions"),
        stat("Fund 1 committed", usd(fund["committed_usd"]),
             f"anchor {fund['anchor_pct']}% of {usd(fund['fund1_target_usd'])} target"),
        stat("Capital into KSA", usd(fund["capital_into_ksa_usd"]),
             f"{fund['capital_into_ksa_pct']}% of {usd(fund['capital_into_ksa_target_usd'])}"),
    ])

    rows = []
    for c in data["checkpoints"]:
        tone = {"met": "green", "on_track": "orange", "behind": "red"}[c["status"]]
        rows.append([
            escape(c["label"]),
            f"<strong>{c['value']}</strong>",
            f"{c['target_2028']}{bar(c['pct_of_2028'])}",
            c["target_2030"],
            f'<span class="tag {tone}">{c["status"].replace("_", " ")}</span>',
        ])
    checkpoints = table(["Checkpoint", "Now", "End-2028", "End-2030", ""], rows)

    attention = "".join(
        f'<tr><td><a href="/opportunity/{o["id"]}">{escape(o["code"])}</a> '
        f'{escape(o["name"])}</td><td>{tile_tag(o["tile"])}</td>'
        f'<td class="muted">{escape(o["stage_label"])}</td>'
        f'<td class="muted">{escape(_waiting_on(o))}</td></tr>'
        for o in live)

    body = f"""<h1>Operating dashboard</h1>
<p class="sub">Platform capital is tranched against the checkpoints, so they are computed
from the operating record — not asserted.</p>
<div class="grid">{cards}</div>
<h2>Checkpoints</h2>{checkpoints}
<h2>What the pipeline is waiting on</h2>
<table><thead><tr><th>Opportunity</th><th>Tile</th><th>Stage</th><th>Blocking</th></tr></thead>
<tbody>{attention}</tbody></table>"""
    return page("Dashboard", body, "/")


@route("GET", "/board")
def board_page(conn, _params, _path):
    rows = []
    for o in pipeline.board(conn):
        status_tone = {"active": "green", "stopped": "red", "invested": "purple",
                       "delivered": "orange"}.get(o["status"], "muted")
        rows.append([
            f'<a href="/opportunity/{o["id"]}"><strong>{escape(o["code"])}</strong></a><br>'
            f'<span class="muted">{escape(o["name"])}</span>',
            tile_tag(o["tile"]),
            escape(o["focus_area"]),
            f'{o["stage"]} · <span class="muted">{escape(o["stage_label"])}</span>',
            f'<span class="tag {status_tone}">{escape(o["status"])}</span>',
            f'<span class="muted">{escape(_waiting_on(o))}</span>' if o["status"] == "active" else "",
        ])
    body = f"""<h1>Pipeline</h1>
<p class="sub">Green tiles are co-invest, orange consulting, purple know-how. Gates are green or
red — yellow means limbo and the workflow will not record it.</p>
{table(["Opportunity", "Tile", "Focus", "Stage", "Status", "Blocking"], rows)}"""
    return page("Pipeline", body, "/board")


@route("GET", "/opportunity/(\\d+)")
def opportunity_page(conn, params, path, opp_id=None):
    opp_id = int(opp_id)
    opp = conn.execute("SELECT * FROM opportunities WHERE id=?", (opp_id,)).fetchone()
    if opp is None:
        return page("Not found", "<h1>No such opportunity</h1>", path)
    state = pipeline.readiness(conn, opp_id)
    read = consensus.read(conn, opp_id, stage=1)
    payload = experts.cohort_payload(conn, opp_id)

    stages = "".join(
        f'<div class="{"done " + ("green" if i < opp["stage"] else "") if i < opp["stage"] else ""}">'
        f'{i} · {escape(label)}</div>'
        for i, label in config.STAGES.items())

    gates = conn.execute(
        "SELECT * FROM gate_decisions WHERE opportunity_id=? ORDER BY id", (opp_id,)).fetchall()
    gate_rows = [[f'{g["stage"]} · {escape(config.STAGES[g["stage"]])}',
                  f'<span class="tag {g["decision"]}">{g["decision"]}</span>',
                  escape(g["rationale"]), f'<span class="muted">{escape(g["decided_by"])}, '
                  f'{escape(g["decided_at"] or "")}</span>'] for g in gates]

    blockers = ("<ul>" + "".join(f"<li>{escape(b)}</li>" for b in state["blockers"]) + "</ul>"
                if state["blockers"] else '<p class="muted">Nothing outstanding — the IC can call it.</p>')

    consensus_html = (f"""<div class="grid">
{stat("Signal", signal_tag(read["signal"]), f"{read['responses']} of {read['invited']} routed")}
{stat("Adoption index", read["adoption_index"] if read["adoption_index"] is not None else "—",
      "adoption weighted by evidence")}
{stat("Engagement appetite", f'{read["engagement_appetite"]}%' if read["engagement_appetite"] is not None else "—",
      "would personally engage")}
{stat("Spread", read["spread"] if read["spread"] is not None else "—",
      f"split above {config.CONSENSUS_SPREAD_MAX}")}
</div>""" if read["responses"] else '<p class="muted">Not routed to a cohort yet.</p>')

    means = ("".join(f'<tr><td>{escape(label)}</td><td><strong>{read["means"].get(key, "—")}</strong></td></tr>'
                     for key, label in consensus.QUESTIONS) if read["means"] else "")

    disclosure = ("consent recorded — the cohort sees the company"
                  if opp["consent_to_disclose"] else
                  "no consent on file — the cohort sees a blinded abstract only")

    body = f"""<h1>{escape(opp["code"])} · {escape(opp["name"])}</h1>
<p class="sub">{tile_tag(opp["tile"])} &nbsp; {escape(opp["focus_area"])} &nbsp;
<span class="muted">source: {escape(opp["source"] or "—")} · company touches
{opp["company_touches"]}/{config.MAX_COMPANY_TOUCHES} · {escape(disclosure)}</span></p>
<div class="stagebar">{stages}</div>
<div class="split">
<div>
<h2>What the cohort sees</h2>
<div class="card"><strong>{escape(payload["name"])}</strong>
<p class="muted">{escape(payload["abstract"])}</p></div>
<h2>Consensus read</h2>{consensus_html}
{f"<table>{means}</table>" if means else ""}
<h2>Gate history</h2>
{table(["Stage", "Call", "Rationale", "By"], gate_rows) if gate_rows else '<p class="muted">No gates called yet.</p>'}
</div>
<div>
<h2>At this gate</h2>
<div class="card"><strong>{escape(state["stage_label"])}</strong>{blockers}</div>
<h2>Actions</h2>
<div class="card">
<form method="post" action="/opportunity/{opp_id}/route">
<button class="ghost" type="submit">Route to the matched cohort</button></form>
<form method="post" action="/opportunity/{opp_id}/gate">
<input type="text" name="decided_by" placeholder="Decided by" value="Investment Committee">
<select name="decision"><option value="green">green</option><option value="red">red</option></select>
<textarea name="rationale" placeholder="Rationale — what made this a yes or a no"></textarea>
<button type="submit">Record the gate</button></form>
</div>
<h2>Submit a read</h2>
<div class="card"><form method="post" action="/opportunity/{opp_id}/respond">
<input type="number" name="expert_id" placeholder="Expert id" required>
<input type="number" name="adoption" min="1" max="5" placeholder="Adoption 1-5" required>
<input type="number" name="clinical_significance" min="1" max="5" placeholder="Significance" required>
<input type="number" name="evidence_strength" min="1" max="5" placeholder="Evidence" required>
<input type="number" name="moat" min="1" max="5" placeholder="Moat" required>
<input type="number" name="bth_involvement" min="1" max="5" placeholder="Would engage" required>
<textarea name="comment" placeholder="Written read"></textarea>
<button type="submit">Submit</button></form></div>
</div></div>"""
    return page(opp["code"], body, path, flash=params.get("msg", [None])[0])


@route("GET", "/experts")
def experts_page(conn, _params, _path):
    rows = []
    for e in experts.leaderboard(conn, 300):
        rows.append([
            f'<a href="/expert/{e["id"]}">{escape(e["name"])}</a>',
            escape(e["country"]), escape(e["specialty"]),
            f'<span class="tag {"green" if e["tier"] == "A" else ("orange" if e["tier"] == "B" else "muted")}">'
            f'tier {e["tier"]}</span>',
            f'<strong>{e["score"]}</strong>{bar(e["score"])}',
            f'{e["responses"]}/{e["invitations"]}',
            f'{e["calibration"]}%',
        ])
    body = f"""<h1>Brain trust</h1>
<p class="sub">The index is quality-weighted: responsiveness is 40% of it, written depth 35%,
and calibration against how deals actually resolved 25% — then shrunk toward neutral until an
expert has a track record, so neither volume alone nor a single sharp read buys a tier.
Tier sets the fee band: A {config.PHYSICIAN_SHARE_BPS['A'] // 100}%,
B {config.PHYSICIAN_SHARE_BPS['B'] // 100}%, C {config.PHYSICIAN_SHARE_BPS['C'] // 100}%.</p>
{table(["Physician", "Country", "Specialty", "Tier", "Index", "Reads", "Calibration"], rows)}"""
    return page("Brain trust", body, "/experts")


@route("GET", "/expert/(\\d+)")
def expert_page(conn, _params, path, expert_id=None):
    expert_id = int(expert_id)
    row = conn.execute("SELECT * FROM experts WHERE id=?", (expert_id,)).fetchone()
    if row is None:
        return page("Not found", "<h1>No such expert</h1>", path)
    idx = experts.expert_index(conn, expert_id)
    tier = experts.expert_tier(conn, expert_id)
    earnings = economics.expert_earnings(conn, expert_id)
    share = config.PHYSICIAN_SHARE_BPS[tier]

    invites = conn.execute(
        "SELECT g.*, o.code, o.name, o.tile, r.adoption FROM routings g"
        " JOIN opportunities o ON o.id = g.opportunity_id"
        " LEFT JOIN responses r ON r.routing_id = g.id WHERE g.expert_id=? ORDER BY g.id DESC",
        (expert_id,)).fetchall()
    rows = [[f'<a href="/opportunity/{i["opportunity_id"]}">{escape(i["code"])}</a>',
             tile_tag(i["tile"]), escape(i["name"]),
             i["adoption"] if i["adoption"] is not None else '<span class="muted">no read</span>']
            for i in invites]

    body = f"""<h1>{escape(row["name"])}</h1>
<p class="sub">{escape(row["specialty"])} · {escape(row["country"])} ·
{escape(row["knowledge_areas"])}{" · innovation fellow " + str(row["fellow_cohort"]) if row["fellow_cohort"] else ""}</p>
<div class="grid">
{stat("Index", idx["score"], f"tier {tier} · {share // 100}% fee share")}
{stat("Reads", f'{idx["responses"]}/{idx["invitations"]}', f'{idx["responsiveness"]}% responsive')}
{stat("Calibration", f'{idx["calibration"]}%', "agreement with terminal gates")}
{stat("Earned", money(earnings["paid_cents"]), f'{earnings["engagements"]} payouts')}
</div>
<h2>Routing history</h2>
{table(["Opportunity", "Tile", "Name", "Read"], rows) if rows else '<p class="muted">Not routed yet.</p>'}"""
    return page(row["name"], body, path)


@route("GET", "/economics")
def economics_page(conn, _params, _path):
    summary = economics.ledger_summary(conn)
    rows = [[escape(line["source_kind"]), line["n"], money(line["gross"] or 0),
             money(line["paid"] or 0), money(line["retained"] or 0),
             f'{round(100 * (line["retained"] or 0) / (line["gross"] or 1))}%']
            for line in summary["lines"]]
    total = summary["total"]
    rows.append(["<strong>total</strong>", total["n"], f'<strong>{money(total["gross"])}</strong>',
                 money(total["paid"]), money(total["retained"]), f'{total["retention_pct"]}%'])

    splits = table(["Revenue line", "Contributor keeps", "Platform retains", "Why"], [
        ["Consulting &amp; know-how", f'{config.PHYSICIAN_SHARE_BPS["C"] // 100}–'
         f'{config.PHYSICIAN_SHARE_BPS["A"] // 100}% to the physician',
         f'{100 - config.PHYSICIAN_SHARE_BPS["A"] // 100}–'
         f'{100 - config.PHYSICIAN_SHARE_BPS["C"] // 100}%',
         "Routing, contracting and collection; the band moves with the expert index"],
        ["Licensing", f'{config.INVENTOR_SHARE_BPS_BASE // 100}–'
         f'{config.INVENTOR_SHARE_BPS_MAX // 100}% to the inventor',
         f'{100 - config.INVENTOR_SHARE_BPS_MAX // 100}–'
         f'{100 - config.INVENTOR_SHARE_BPS_BASE // 100}%',
         "The platform funds and prosecutes the family — better than most US university TTOs"],
        ["Clinical trials", f'{config.TRIAL_SITE_SHARE_BPS // 100}% stays with the site',
         f'{100 - config.TRIAL_SITE_SHARE_BPS // 100}%',
         "Sponsors, contracts and quality systems"],
        ["Data partnerships", f'{config.DATA_INSTITUTION_SHARE_BPS // 100}% to the institution',
         f'{100 - config.DATA_INSTITUTION_SHARE_BPS // 100}%',
         "The institution owns the asset; the platform brings the buyer and the compliance"],
    ])

    top = conn.execute(
        "SELECT e.id, e.name, e.country, SUM(p.party_cents) paid, COUNT(*) n FROM payouts p"
        " JOIN experts e ON e.id = p.party_id WHERE p.party_kind='expert'"
        " GROUP BY e.id ORDER BY paid DESC LIMIT 10").fetchall()
    top_rows = [[f'<a href="/expert/{t["id"]}">{escape(t["name"])}</a>', escape(t["country"]),
                 t["n"], money(t["paid"])] for t in top]

    body = f"""<h1>Economics</h1>
<p class="sub">The contributor keeps the majority on every line. The platform is paid for the
rails, the compliance and the capital it brings.</p>
{splits}
<h2>Ledger</h2>
{table(["Line", "Postings", "Gross", "Paid out", "Retained", "Retention"], rows)}
<h2>Top earners</h2>
{table(["Physician", "Country", "Payouts", "Earned"], top_rows)}"""
    return page("Economics", body, "/economics")


@route("GET", "/network")
def network_page(conn, _params, _path):
    inst = conn.execute("SELECT * FROM institutions ORDER BY anchor_partner DESC, name").fetchall()
    rows = [[escape(i["name"]), escape(i["country"]),
             '<span class="tag green">anchor</span>' if i["anchor_partner"] else "",
             '<span class="tag orange">sponsor-ready</span>' if i["sponsor_ready"]
             else ('<span class="tag muted">site</span>' if i["trial_site"] else ""),
             f'<span class="muted">{escape(i["notes"] or "")}</span>'] for i in inst]

    partnerships = conn.execute(
        "SELECT d.*, i.name, i.country FROM data_partnerships d"
        " JOIN institutions i ON i.id = d.institution_id ORDER BY d.id").fetchall()
    p_rows = [[escape(p["name"]), escape(p["country"]), escape(p["scope"]),
               money(p["revenue_cents"])] for p in partnerships]

    trials = conn.execute(
        "SELECT t.*, i.name site, i.country, b.name sponsor FROM trials t"
        " JOIN institutions i ON i.id = t.site_institution_id"
        " JOIN buyers b ON b.id = t.sponsor_buyer_id ORDER BY t.id").fetchall()
    t_rows = [[escape(t["protocol"]), escape(t["site"]), escape(t["country"]),
               escape(t["sponsor"]), money(t["revenue_cents"])] for t in trials]

    body = f"""<h1>Network</h1>
<p class="sub">Outlier institutions sit on data and volume they cannot monetise. The rails are
what they are missing.</p>
{table(["Institution", "Country", "", "Trials", "Note"], rows)}
<h2>Data partnerships</h2>{table(["Institution", "Country", "Scope", "Revenue"], p_rows)}
<h2>Trial sites at work</h2>{table(["Protocol", "Site", "Country", "Sponsor", "Revenue"], t_rows)}"""
    return page("Network", body, "/network")


@route("GET", "/fund")
def fund_page(conn, _params, _path):
    fund = kpi.fund_position(conn)
    impact = kpi.kingdom_impact(conn)
    commitments = conn.execute("SELECT * FROM fund_commitments ORDER BY amount_cents DESC").fetchall()
    c_rows = [[escape(c["lp_name"]), usd(c["amount_cents"] / 100),
               '<span class="tag green">anchor</span>' if c["anchor"] else ""]
              for c in commitments]
    deployments = conn.execute(
        "SELECT d.*, o.code, o.name FROM fund_deployments d"
        " JOIN opportunities o ON o.id = d.opportunity_id ORDER BY d.id DESC").fetchall()
    d_rows = [[f'<a href="/opportunity/{d["opportunity_id"]}">{escape(d["code"])}</a> '
               f'{escape(d["name"])}', usd(d["amount_cents"] / 100),
               usd(d["coinvest_cents"] / 100),
               '<span class="tag green">KSA</span>' if d["ksa_domiciled"] else ""]
              for d in deployments]

    i_rows = []
    for line in impact["lines"]:
        value = line["value"] if line["instrumented"] else '<span class="muted">not instrumented</span>'
        i_rows.append([escape(line["label"]), value, line["from"], line["to"]])

    anchor_note = ("anchor sits above the 50% the deck assumes"
                   if fund["anchor_pct"] > fund["anchor_pct_target"] else "in line with the deck")

    body = f"""<h1>Fund</h1>
<p class="sub">A separate entity. It shares the platform's pipeline and nothing else.</p>
<div class="grid">
{stat("Committed", usd(fund["committed_usd"]), f'target {usd(fund["fund1_target_usd"])}')}
{stat("Anchor (PIF)", usd(fund["anchor_usd"]), f'{fund["anchor_pct"]}% — {anchor_note}')}
{stat("Deployed", usd(fund["deployed_usd"]), f'plus {usd(fund["coinvest_usd"])} co-invest')}
{stat("Capital into KSA", usd(fund["capital_into_ksa_usd"]),
      f'{fund["capital_into_ksa_pct"]}% of the {usd(fund["capital_into_ksa_target_usd"])} target')}
</div>
<h2>Commitments</h2>{table(["LP", "Amount", ""], c_rows)}
<h2>Deployments</h2>{table(["Opportunity", "Fund", "Co-invest", ""], d_rows)}
<h2>Kingdom impact</h2>
<p class="sub">Slide 8's downstream numbers, computed where the operating record can evidence
them. The deck carries two different figures for capital into KSA companies —
{usd(fund["capital_into_ksa_target_alt_usd"])} on slide 8 and
{usd(fund["capital_into_ksa_target_usd"])} on slide 11 — and this console reports against the
larger one.</p>
{table(["Measure", "Now", "From", "To"], i_rows)}"""
    return page("Fund", body, "/fund")


# ------------------------------------------------------------------ actions
@route("POST", "/opportunity/(\\d+)/gate")
def do_gate(conn, params, _path, opp_id=None):
    opp_id = int(opp_id)
    decision = params.get("decision", ["green"])[0]
    rationale = params.get("rationale", [""])[0].strip() or "(no rationale recorded)"
    by = params.get("decided_by", ["Investment Committee"])[0]
    try:
        result = pipeline.gate(conn, opp_id, decision, rationale, by)
        msg = f"{decision} recorded at stage {result['stage']}; now at stage {result['now_at']}."
    except (pipeline.GateNotReady, pipeline.GateRefused, ValueError) as exc:
        msg = f"Gate refused — {exc}"
    return redirect(f"/opportunity/{opp_id}?msg={quote(msg)}")


@route("POST", "/opportunity/(\\d+)/route")
def do_route(conn, _params, _path, opp_id=None):
    opp_id = int(opp_id)
    invited = experts.route(conn, opp_id, stage=1)
    return redirect(f"/opportunity/{opp_id}?msg=" +
                    quote(f"Routed to the full matched cohort: {len(invited)} physicians."))


@route("POST", "/opportunity/(\\d+)/respond")
def do_respond(conn, params, _path, opp_id=None):
    opp_id = int(opp_id)

    def field(name):
        return int(params.get(name, ["3"])[0])
    expert_id = field("expert_id")
    routing = conn.execute(
        "SELECT id FROM routings WHERE opportunity_id=? AND expert_id=? AND stage=1",
        (opp_id, expert_id)).fetchone()
    if routing is None:
        msg = "That physician is not in this opportunity's routed cohort."
    else:
        try:
            consensus.submit(conn, routing["id"], field("adoption"), field("clinical_significance"),
                             field("evidence_strength"), field("moat"), field("bth_involvement"),
                             params.get("comment", [""])[0])
            msg = "Read recorded."
        except ValueError as exc:
            msg = f"Rejected — {exc}"
    return redirect(f"/opportunity/{opp_id}?msg={quote(msg)}")


# --------------------------------------------------------------------- api
@route("GET", "/api/dashboard")
def api_dashboard(conn, _params, _path):
    return json_response(kpi.dashboard(conn))


@route("GET", "/api/board")
def api_board(conn, _params, _path):
    return json_response(pipeline.board(conn))


@route("GET", "/api/opportunity/(\\d+)")
def api_opportunity(conn, _params, _path, opp_id=None):
    opp_id = int(opp_id)
    opp = conn.execute("SELECT * FROM opportunities WHERE id=?", (opp_id,)).fetchone()
    if opp is None:
        return json_response({"error": "not found"}, "404 Not Found")
    return json_response({
        "opportunity": dict(opp),
        "readiness": pipeline.readiness(conn, opp_id),
        "consensus": consensus.read(conn, opp_id, stage=1),
        "cohort_payload": experts.cohort_payload(conn, opp_id),
    })


@route("GET", "/api/experts")
def api_experts(conn, _params, _path):
    return json_response(experts.leaderboard(conn, 500))


# ------------------------------------------------------------------ plumbing
def json_response(payload, status="200 OK"):
    return status, [("Content-Type", "application/json")], json.dumps(payload, indent=2).encode()


def redirect(location):
    return "303 See Other", [("Location", location)], b""


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    if method == "POST":
        size = int(environ.get("CONTENT_LENGTH") or 0)
        params = parse_qs(environ["wsgi.input"].read(size).decode())
    else:
        params = parse_qs(environ.get("QUERY_STRING", ""))

    conn = db.connect()
    try:
        for verb, pattern, handler in ROUTES:
            match = pattern.match(path)
            if match and verb == method:
                result = handler(conn, params, path, *match.groups())
                if isinstance(result, tuple):
                    status, headers, body = result
                else:
                    status, headers = "200 OK", [("Content-Type", "text/html; charset=utf-8")]
                    body = result.encode()
                start_response(status, headers)
                return [body]
        start_response("404 Not Found", [("Content-Type", "text/html; charset=utf-8")])
        return [page("Not found", "<h1>404</h1><p class='sub'>No such page.</p>", path).encode()]
    finally:
        conn.close()


def serve(host="127.0.0.1", port=8000):
    from wsgiref.simple_server import make_server
    with make_server(host, port, application) as httpd:
        print(f"Brain Trust Holdings console on http://{host}:{port}")
        httpd.serve_forever()

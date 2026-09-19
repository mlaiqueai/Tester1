"""The brain trust: who is on it, who an opportunity goes to, and who ranks.

Two problems the workflow review flagged are answered here. First, the expert
mapping table did not exist, so cohort routing was not possible — it does now,
on specialty, subspecialty and knowledge area. Second, a raw participation
count rewards the most frequent rater rather than the best one, so the index is
quality-weighted: responsiveness is only 40% of it, and calibration against how
deals actually resolved carries real weight.
"""

from datetime import date

from . import config


def _tags(row):
    tags = {row["specialty"].strip().lower()}
    tags |= {t.strip().lower() for t in (row["subspecialties"] or "").split(",") if t.strip()}
    return tags


def add_expert(conn, name, country, specialty, subspecialties="", knowledge_areas="clinical",
               institution_id=None, credentials=None, fellow_cohort=None, joined_at=None):
    cur = conn.execute(
        "INSERT INTO experts (name, country, institution_id, specialty, subspecialties,"
        " knowledge_areas, credentials, fellow_cohort, active, joined_at)"
        " VALUES (?,?,?,?,?,?,?,?,1,?)",
        (name, country, institution_id, specialty, subspecialties, knowledge_areas,
         credentials, fellow_cohort, joined_at or date.today().isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def matched_cohort(conn, focus_area, knowledge_area=None):
    """Every active expert who matches. Never a subset — participation is opt-in.

    Sending to a hand-picked few is how a thin response masquerades as a real
    sentiment signal, so the selection happens at response time, not send time.
    """
    focus = focus_area.strip().lower()
    out = []
    for row in conn.execute("SELECT * FROM experts WHERE active=1").fetchall():
        if focus not in _tags(row):
            continue
        if knowledge_area:
            areas = {a.strip() for a in (row["knowledge_areas"] or "").split(",")}
            if knowledge_area not in areas:
                continue
        out.append(row)
    return sorted(out, key=lambda r: -expert_index(conn, r["id"])["score"])


def route(conn, opportunity_id, stage=1, knowledge_area=None):
    """Invite the full matched cohort to an opportunity. Returns invited expert ids."""
    opp = conn.execute("SELECT * FROM opportunities WHERE id=?", (opportunity_id,)).fetchone()
    if opp is None:
        raise LookupError(f"opportunity {opportunity_id} not found")
    invited = []
    for expert in matched_cohort(conn, opp["focus_area"], knowledge_area):
        conn.execute(
            "INSERT OR IGNORE INTO routings (opportunity_id, expert_id, stage, invited_at)"
            " VALUES (?,?,?,?)",
            (opportunity_id, expert["id"], stage, date.today().isoformat()),
        )
        invited.append(expert["id"])
    conn.commit()
    return invited


def cohort_payload(conn, opportunity_id):
    """What a routed expert is allowed to see.

    Confidentiality was the open legal question at stage 1: a wide cohort cannot
    be shown a company's deck without consent. Until consent is recorded the
    cohort sees a blinded abstract and nothing that identifies the company.
    """
    opp = conn.execute("SELECT * FROM opportunities WHERE id=?", (opportunity_id,)).fetchone()
    if opp is None:
        raise LookupError(f"opportunity {opportunity_id} not found")
    if opp["consent_to_disclose"]:
        return {"blinded": False, "code": opp["code"], "name": opp["name"],
                "tile": opp["tile"], "focus_area": opp["focus_area"],
                "abstract": opp["blinded_abstract"]}
    return {"blinded": True, "code": opp["code"], "name": f"Opportunity {opp['code']}",
            "tile": opp["tile"], "focus_area": opp["focus_area"],
            "abstract": opp["blinded_abstract"]}


def expert_index(conn, expert_id):
    """0-100 quality-weighted index. Drives routing priority and the fee band.

    responsiveness — share of invitations answered
    depth          — share of answers carrying a substantive written read
    calibration    — agreement between the expert's read and how the deal resolved
    """
    invites = conn.execute(
        "SELECT COUNT(*) n FROM routings WHERE expert_id=?", (expert_id,)
    ).fetchone()["n"]
    answers = conn.execute(
        "SELECT r.* FROM responses r JOIN routings g ON g.id = r.routing_id WHERE g.expert_id=?",
        (expert_id,),
    ).fetchall()

    if not invites:
        return {"score": 0.0, "raw_score": 0.0, "reliability": 0.0, "responsiveness": 0.0,
                "depth": 0.0, "calibration": 50.0, "invitations": 0, "responses": 0}

    responsiveness = 100.0 * len(answers) / invites
    substantive = sum(1 for a in answers if a["comment"] and len(a["comment"].strip()) >= 80)
    depth = 100.0 * substantive / len(answers) if answers else 0.0

    # Calibration: compare each read against the terminal decision on that deal.
    hits = total = 0
    for a in answers:
        opp_id = conn.execute(
            "SELECT opportunity_id FROM routings WHERE id=?", (a["routing_id"],)
        ).fetchone()["opportunity_id"]
        terminal = conn.execute(
            "SELECT decision FROM gate_decisions WHERE opportunity_id=? AND stage>=2"
            " ORDER BY stage DESC, id DESC LIMIT 1", (opp_id,)
        ).fetchone()
        if terminal is None:
            continue
        total += 1
        said_yes = a["adoption"] >= 4
        went_green = terminal["decision"] == "green"
        if said_yes == went_green:
            hits += 1
    calibration = 100.0 * hits / total if total else 50.0  # unproven experts sit at neutral

    raw = (config.RESPONSIVENESS_WEIGHT * responsiveness
           + config.DEPTH_WEIGHT * depth
           + config.CALIBRATION_WEIGHT * calibration)
    # Shrink toward the neutral prior until the expert has a track record; one
    # sharp read does not make a tier A reader, and volume alone does not either.
    reliability = len(answers) / (len(answers) + config.INDEX_SHRINKAGE_K)
    score = reliability * raw + (1 - reliability) * config.INDEX_NEUTRAL_PRIOR
    return {"score": round(score, 1), "raw_score": round(raw, 1),
            "reliability": round(reliability, 2),
            "responsiveness": round(responsiveness, 1),
            "depth": round(depth, 1), "calibration": round(calibration, 1),
            "invitations": invites, "responses": len(answers)}


def expert_tier(conn, expert_id):
    score = expert_index(conn, expert_id)["score"]
    if score >= config.TIER_THRESHOLDS["A"]:
        return "A"
    if score >= config.TIER_THRESHOLDS["B"]:
        return "B"
    return "C"


def leaderboard(conn, limit=25):
    rows = conn.execute("SELECT * FROM experts WHERE active=1").fetchall()
    out = []
    for row in rows:
        idx = expert_index(conn, row["id"])
        out.append({
            "id": row["id"], "name": row["name"], "country": row["country"],
            "specialty": row["specialty"], "tier": expert_tier(conn, row["id"]), **idx,
        })
    return sorted(out, key=lambda r: -r["score"])[:limit]

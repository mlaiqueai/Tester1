"""The stage-gate workflow, stages 0 through 5.

Two rules are enforced in code rather than left to discipline. Gates are green
or red — asking for yellow raises, because yellow is how deals end up in limbo.
And a gate cannot be called before the evidence that gate exists to weigh has
actually arrived; premature calls raise GateNotReady rather than quietly pass.
"""

import json
from datetime import date

from . import config
from .consensus import read as consensus_read


class GateNotReady(Exception):
    """The stage's own work isn't finished, so there is nothing to decide yet."""


class GateRefused(Exception):
    """The evidence does not support the decision being recorded."""


def create_opportunity(conn, code, name, tile, focus_area, blinded_abstract,
                       source=None, buyer_id=None, created_at=None):
    if tile not in config.TILES:
        raise ValueError(f"tile must be one of {sorted(config.TILES)}")
    cur = conn.execute(
        "INSERT INTO opportunities (code, name, tile, focus_area, source, buyer_id,"
        " stage, status, blinded_abstract, created_at) VALUES (?,?,?,?,?,?,0,'active',?,?)",
        (code, name, tile, focus_area.strip().lower(), source, buyer_id,
         blinded_abstract, created_at or date.today().isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def screen(conn, opportunity_id, factors, memo=None, screened_at=None):
    """Stage 0: binary yes/no across the five factors. Thesis fit is the filter.

    The intake model drafts this; it does not get to decide. A screen with any
    factor false is a fail, and the IC reads the memo against the grid before
    anything advances — the point of the grid is that its failures are visible.
    """
    missing = set(config.SCREEN_FACTORS) - set(factors)
    if missing:
        raise ValueError(f"screen is missing factors: {sorted(missing)}")
    opp = _opportunity(conn, opportunity_id)
    factors = {k: bool(factors[k]) for k in config.SCREEN_FACTORS}
    if opp["focus_area"] not in config.FOCUS_AREAS:
        factors["thesis_fit"] = False  # off-thesis is a hard screen-out
    verdict = "pass" if all(factors.values()) else "fail"
    conn.execute(
        "INSERT INTO screens (opportunity_id, factors_json, verdict, memo, screened_at)"
        " VALUES (?,?,?,?,?)",
        (opportunity_id, json.dumps(factors), verdict, memo,
         screened_at or date.today().isoformat()),
    )
    conn.commit()
    return {"verdict": verdict, "factors": factors}


def record_interview(conn, opportunity_id, stakeholder, cross_validated=False, notes=None,
                     conducted_at=None):
    if stakeholder not in config.INTERVIEW_STAKEHOLDERS:
        raise ValueError(f"stakeholder must be one of {config.INTERVIEW_STAKEHOLDERS}")
    opp = _opportunity(conn, opportunity_id)
    if stakeholder == "company":
        touches = opp["company_touches"] + 1
        if touches > config.MAX_COMPANY_TOUCHES:
            raise GateRefused(
                f"company touch cap of {config.MAX_COMPANY_TOUCHES} reached — the cap was "
                "communicated upfront, so ask inside the remaining touches or stop")
        conn.execute("UPDATE opportunities SET company_touches=? WHERE id=?",
                     (touches, opportunity_id))
    cur = conn.execute(
        "INSERT INTO interviews (opportunity_id, stakeholder, conducted_at, cross_validated, notes)"
        " VALUES (?,?,?,?,?)",
        (opportunity_id, stakeholder, conducted_at or date.today().isoformat(),
         int(cross_validated), notes),
    )
    conn.commit()
    return cur.lastrowid


def file_packet(conn, opportunity_id, area, verdict, expert_id=None, open_questions=0,
                notes=None, filed_at=None):
    if area not in config.DEEP_DILIGENCE_AREAS + ("investment",):
        raise ValueError(f"unknown diligence area: {area}")
    if verdict not in ("clear", "concern", "blocker"):
        raise ValueError("verdict must be clear, concern or blocker")
    cur = conn.execute(
        "INSERT INTO diligence_packets (opportunity_id, area, expert_id, verdict,"
        " open_questions, filed_at, notes) VALUES (?,?,?,?,?,?,?)",
        (opportunity_id, area, expert_id, verdict, open_questions,
         filed_at or date.today().isoformat(), notes),
    )
    conn.commit()
    return cur.lastrowid


def readiness(conn, opportunity_id):
    """What stands between this opportunity and a decision at its current stage.

    This is the governing question at every gate, answered as data: what is
    stopping us from making a decision?
    """
    opp = _opportunity(conn, opportunity_id)
    stage = opp["stage"]
    blockers, evidence = [], {}

    if stage == 0:
        row = conn.execute(
            "SELECT * FROM screens WHERE opportunity_id=? ORDER BY id DESC LIMIT 1",
            (opportunity_id,)).fetchone()
        if row is None:
            blockers.append("no intake screen on file")
        else:
            evidence["screen"] = row["verdict"]
            if row["verdict"] == "fail":
                evidence["only_decision_available"] = "red"

    elif stage == 1:
        signal = consensus_read(conn, opportunity_id, stage=1)
        evidence["consensus"] = signal
        if not signal["quorum"]:
            blockers.append(
                f"cohort quorum not met ({signal['responses']} responses, "
                f"{int(signal['response_rate'] * 100)}% of the routed cohort)")
        elif signal["signal"] != "positive":
            evidence["only_decision_available"] = "red"

    elif stage == 2:
        done = {r["stakeholder"] for r in conn.execute(
            "SELECT DISTINCT stakeholder FROM interviews WHERE opportunity_id=? AND cross_validated=1",
            (opportunity_id,)).fetchall()}
        evidence["interviews_cross_validated"] = sorted(done)
        missing = [s for s in config.INTERVIEW_STAKEHOLDERS if s not in done]
        if missing:
            blockers.append("interviews outstanding or not cross-validated: " + ", ".join(missing))

    elif stage == 3:
        packets = conn.execute(
            "SELECT * FROM diligence_packets WHERE opportunity_id=?", (opportunity_id,)).fetchall()
        filed = {p["area"] for p in packets}
        required = set(config.DEEP_DILIGENCE_AREAS) | {"investment"}
        evidence["packets_filed"] = sorted(filed)
        evidence["open_questions"] = sum(p["open_questions"] for p in packets)
        evidence["blockers_raised"] = [p["area"] for p in packets if p["verdict"] == "blocker"]
        missing = sorted(required - filed)
        if missing:
            blockers.append("diligence packets missing: " + ", ".join(missing))
        if evidence["open_questions"]:
            blockers.append(f"{evidence['open_questions']} questions still open")

    elif stage == 4:
        prior = conn.execute(
            "SELECT decision FROM gate_decisions WHERE opportunity_id=? AND stage=3"
            " ORDER BY id DESC LIMIT 1", (opportunity_id,)).fetchone()
        if prior is None or prior["decision"] != "green":
            blockers.append("stage 3 has not been called green")

    return {"stage": stage, "stage_label": config.STAGES[stage],
            "ready": not blockers, "blockers": blockers, "evidence": evidence}


def gate(conn, opportunity_id, decision, rationale, decided_by, decided_at=None):
    """Record an IC decision at the opportunity's current stage and move it."""
    if decision not in ("green", "red"):
        raise ValueError(
            "a gate is green or red — yellow means limbo and is not allowed")
    opp = _opportunity(conn, opportunity_id)
    stage = opp["stage"]
    if opp["status"] != "active":
        raise GateRefused(f"opportunity is {opp['status']}, not active")
    if stage >= 5:
        raise GateRefused("stage 5 is a posture choice, not a gate")

    state = readiness(conn, opportunity_id)
    if decision == "green":
        if not state["ready"]:
            raise GateNotReady("; ".join(state["blockers"]))
        _refuse_unsupported_green(stage, state)

    conn.execute(
        "INSERT INTO gate_decisions (opportunity_id, stage, decision, rationale, decided_by, decided_at)"
        " VALUES (?,?,?,?,?,?)",
        (opportunity_id, stage, decision, rationale, decided_by,
         decided_at or date.today().isoformat()),
    )
    if decision == "red":
        conn.execute("UPDATE opportunities SET status='stopped' WHERE id=?", (opportunity_id,))
    else:
        new_status = "invested" if stage == 4 else "active"
        conn.execute("UPDATE opportunities SET stage=?, status=? WHERE id=?",
                     (stage + 1, new_status, opportunity_id))
    conn.commit()
    return {"stage": stage, "decision": decision,
            "now_at": stage + 1 if decision == "green" else stage,
            "status": "stopped" if decision == "red" else ("invested" if stage == 4 else "active")}


def _refuse_unsupported_green(stage, state):
    ev = state["evidence"]
    if stage == 0 and ev.get("screen") == "fail":
        raise GateRefused("the screen failed — a thesis miss cannot be waved through")
    if stage == 1:
        signal = ev["consensus"]["signal"]
        if signal != "positive":
            raise GateRefused(f"cohort sentiment reads {signal}, not positive")
    if stage == 3 and ev.get("blockers_raised"):
        raise GateRefused("blockers raised in: " + ", ".join(ev["blockers_raised"]))


def board(conn):
    """Every live opportunity with its tile, stage and what it is waiting on."""
    rows = conn.execute(
        "SELECT * FROM opportunities ORDER BY status='active' DESC, stage DESC, id").fetchall()
    out = []
    for row in rows:
        item = dict(row)
        item["tile_label"] = config.TILES[row["tile"]]
        item["stage_label"] = config.STAGES[row["stage"]]
        if row["status"] == "active":
            state = readiness(conn, row["id"])
            item["ready"] = state["ready"]
            item["blockers"] = state["blockers"]
            item["only_decision_available"] = state["evidence"].get("only_decision_available")
        else:
            item["ready"] = False
            item["blockers"] = []
            item["only_decision_available"] = None
        out.append(item)
    return out


def _opportunity(conn, opportunity_id):
    row = conn.execute("SELECT * FROM opportunities WHERE id=?", (opportunity_id,)).fetchone()
    if row is None:
        raise LookupError(f"opportunity {opportunity_id} not found")
    return row

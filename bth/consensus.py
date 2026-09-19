"""Consensus reads and the Clinical Adoption Index.

A read is the platform's product for buyers and its gate signal for the fund,
so it has to be honest about its own thinness: below quorum it reports as
inconclusive rather than as a weak yes, and a cohort that is genuinely split
never reads green no matter how high the mean sits.
"""

from datetime import date
from statistics import pstdev

from . import config
from .experts import expert_index

QUESTIONS = (
    ("adoption", "Would this change your practice if the evidence held?"),
    ("clinical_significance", "Is the clinical problem worth solving at this size?"),
    ("evidence_strength", "Does the evidence presented support the claim?"),
    ("moat", "Is there anything here a competitor cannot copy in 24 months?"),
    ("bth_involvement", "Would you personally engage on this deal?"),
)


def submit(conn, routing_id, adoption, clinical_significance, evidence_strength, moat,
           bth_involvement, comment=None, submitted_at=None):
    """Record one expert's read. One response per invitation."""
    for label, value in (("adoption", adoption), ("clinical_significance", clinical_significance),
                         ("evidence_strength", evidence_strength), ("moat", moat),
                         ("bth_involvement", bth_involvement)):
        if not 1 <= int(value) <= 5:
            raise ValueError(f"{label} must be 1-5, got {value}")
    cur = conn.execute(
        "INSERT OR REPLACE INTO responses (routing_id, adoption, clinical_significance,"
        " evidence_strength, moat, bth_involvement, comment, submitted_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (routing_id, adoption, clinical_significance, evidence_strength, moat,
         bth_involvement, comment, submitted_at or date.today().isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def read(conn, opportunity_id, stage=1):
    """Aggregate the cohort's reads, weighting each by that expert's index."""
    invited = conn.execute(
        "SELECT * FROM routings WHERE opportunity_id=? AND stage=?", (opportunity_id, stage)
    ).fetchall()
    answers = []
    for routing in invited:
        row = conn.execute("SELECT * FROM responses WHERE routing_id=?", (routing["id"],)).fetchone()
        if row:
            weight = 1.0 + expert_index(conn, routing["expert_id"])["score"] / 100.0
            answers.append((row, weight))

    n_invited, n_answered = len(invited), len(answers)
    result = {
        "invited": n_invited, "responses": n_answered,
        "response_rate": round(n_answered / n_invited, 3) if n_invited else 0.0,
        "quorum": False, "signal": "inconclusive", "means": {}, "spread": None,
        "adoption_index": None, "engagement_appetite": None,
    }
    if not answers:
        return result

    total_w = sum(w for _, w in answers)
    for key, _label in QUESTIONS:
        result["means"][key] = round(sum(r[key] * w for r, w in answers) / total_w, 2)
    adoption_values = [r["adoption"] for r, _ in answers]
    result["spread"] = round(pstdev(adoption_values), 2) if len(adoption_values) > 1 else 0.0

    # The Clinical Adoption Index the platform sells: adoption weighted by how
    # much the cohort believes the evidence behind it, on a 0-100 scale.
    adoption, evidence = result["means"]["adoption"], result["means"]["evidence_strength"]
    result["adoption_index"] = round(100 * (adoption / 5) * (0.5 + 0.5 * evidence / 5), 1)
    result["engagement_appetite"] = round(
        100 * sum(1 for r, _ in answers if r["bth_involvement"] >= 4) / n_answered, 1)

    result["quorum"] = (n_answered >= config.QUORUM_MIN_RESPONSES
                        and result["response_rate"] >= config.QUORUM_MIN_RESPONSE_RATE)
    if not result["quorum"]:
        result["signal"] = "inconclusive"
    elif result["spread"] > config.CONSENSUS_SPREAD_MAX:
        result["signal"] = "split"
    elif adoption >= config.CONSENSUS_GREEN_MIN:
        result["signal"] = "positive"
    else:
        result["signal"] = "negative"
    return result

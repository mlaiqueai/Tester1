"""Checkpoint tracking — slides 7, 8 and 11.

Platform capital is tranched against the 2028 and 2030 checkpoints, so the
checkpoints have to be computed from the operating record rather than asserted
in a board pack. Anything the record cannot evidence is reported as
uninstrumented instead of estimated.
"""

from datetime import date

from . import config
from .economics import ledger_summary

USD = 100  # cents


def _one(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()[0]


def checkpoint_metrics(conn, year=None):
    """Current value of every checkpoint metric, with its 2028 and 2030 targets."""
    year = year or date.today().year
    y = str(year)
    current = {
        "anchor_partnerships": _one(conn, "SELECT COUNT(*) FROM institutions WHERE anchor_partner=1"),
        "disclosures_per_year": _one(
            conn, "SELECT COUNT(*) FROM disclosures WHERE received_at LIKE ?", (y + "%",)),
        "patent_families_per_year": _one(
            conn, "SELECT COUNT(*) FROM patent_families WHERE filed_at LIKE ?", (y + "%",)),
        "paying_buyer_accounts": _one(conn, "SELECT COUNT(*) FROM buyers WHERE paying=1"),
        "active_physicians": _one(conn, "SELECT COUNT(*) FROM experts WHERE active=1"),
        "saudi_physicians": _one(
            conn, "SELECT COUNT(*) FROM experts WHERE active=1 AND country='SA'"),
        "data_partnerships": _one(conn, "SELECT COUNT(*) FROM data_partnerships"),
        "trial_sites_ready": _one(
            conn, "SELECT COUNT(*) FROM institutions WHERE trial_site=1 AND sponsor_ready=1"),
        "trial_sites_ksa": _one(
            conn, "SELECT COUNT(*) FROM institutions WHERE trial_site=1 AND country='SA'"),
        "licenses_cumulative": _one(conn, "SELECT COUNT(*) FROM licenses"),
    }
    out = []
    for key, targets in config.CHECKPOINTS.items():
        value = current[key]
        t28 = targets["2028"]
        out.append({
            "key": key, "label": targets["label"], "value": value,
            "target_2028": t28, "target_2030": targets["2030"],
            "pct_of_2028": round(100 * value / t28, 1) if t28 else 0.0,
            "status": "met" if value >= t28 else ("on_track" if value >= 0.6 * t28 else "behind"),
        })
    return out


def kingdom_impact(conn):
    """Slide 8, computed where the record supports it."""
    saudi_paid = _one(conn,
        "SELECT COUNT(DISTINCT p.party_id) FROM payouts p JOIN experts e ON e.id = p.party_id"
        " WHERE p.party_kind='expert' AND e.country='SA'")
    saudi_pay_cents = _one(conn,
        "SELECT COALESCE(SUM(p.party_cents),0) FROM payouts p JOIN experts e ON e.id = p.party_id"
        " WHERE p.party_kind='expert' AND e.country='SA'")
    values = {
        "companies_formed": _one(conn, "SELECT COUNT(*) FROM companies_formed WHERE country='SA'"),
        "saudi_patent_families": _one(conn,
            "SELECT COUNT(*) FROM patent_families pf JOIN disclosures d ON d.id = pf.disclosure_id"
            " JOIN experts e ON e.id = d.inventor_expert_id WHERE e.country='SA'"),
        "saudi_physicians_paid": saudi_paid,
        "fellows_trained": _one(conn, "SELECT COUNT(*) FROM experts WHERE fellow_cohort IS NOT NULL"),
        "saudi_jobs": None,  # headcount lives in payroll, not in this record
    }
    out = []
    for key, band in config.KINGDOM_IMPACT.items():
        out.append({"key": key, "label": band["label"], "value": values[key],
                    "from": band["from"], "to": band["to"],
                    "instrumented": values[key] is not None})
    return {"lines": out,
            "saudi_physician_pay_usd": saudi_pay_cents / USD,
            "saudi_physician_pay_target_2036_usd": config.SAUDI_PHYSICIAN_PAY_TARGET_2036_USD}


def fund_position(conn):
    """The fund is a separate entity; this is its balance against slide 11."""
    committed = _one(conn, "SELECT COALESCE(SUM(amount_cents),0) FROM fund_commitments")
    anchor = _one(conn, "SELECT COALESCE(SUM(amount_cents),0) FROM fund_commitments WHERE anchor=1")
    deployed = _one(conn, "SELECT COALESCE(SUM(amount_cents),0) FROM fund_deployments")
    coinvest = _one(conn, "SELECT COALESCE(SUM(coinvest_cents),0) FROM fund_deployments")
    ksa = _one(conn,
        "SELECT COALESCE(SUM(amount_cents + coinvest_cents),0) FROM fund_deployments WHERE ksa_domiciled=1")
    target_ksa = config.SOVEREIGN["capital_into_ksa_usd"]
    return {
        "committed_usd": committed / USD,
        "anchor_usd": anchor / USD,
        "anchor_pct": round(100 * anchor / committed, 1) if committed else 0.0,
        "anchor_pct_target": config.SOVEREIGN["pif_anchor_pct"],
        "fund1_target_usd": config.SOVEREIGN["fund1_implied_usd"],
        "deployed_usd": deployed / USD,
        "coinvest_usd": coinvest / USD,
        "capital_into_ksa_usd": ksa / USD,
        "capital_into_ksa_target_usd": target_ksa,
        "capital_into_ksa_pct": round(100 * (ksa / USD) / target_ksa, 1) if target_ksa else 0.0,
        # The deck carries $70M on slide 8 and $200M on slide 11 for the same line.
        "capital_into_ksa_target_alt_usd": config.SOVEREIGN["capital_into_ksa_usd_slide8"],
        "platform_build_usd": config.SOVEREIGN["platform_build_usd"],
    }


def dashboard(conn):
    checkpoints = checkpoint_metrics(conn)
    return {
        "checkpoints": checkpoints,
        "checkpoints_met": sum(1 for c in checkpoints if c["status"] == "met"),
        "checkpoints_total": len(checkpoints),
        "impact": kingdom_impact(conn),
        "fund": fund_position(conn),
        "ledger": ledger_summary(conn),
    }

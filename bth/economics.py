"""The incentive model — slide 6.

The contributor keeps the majority; the platform is paid for the rails, the
compliance and the capital it brings. Every split runs through here so the
economics can be changed in one place and audited in another.
"""

from datetime import date

from . import config
from .experts import expert_tier


def split(gross_cents, share_bps):
    """Split a gross amount, rounding the contributor's side down.

    Rounding down on the contributor's side would shortchange them, so the
    remainder goes to the party, not the platform: the platform takes what is
    left after an exact bps cut, never a cent more.
    """
    if gross_cents < 0:
        raise ValueError("gross cannot be negative")
    platform = (gross_cents * (10_000 - share_bps)) // 10_000
    return gross_cents - platform, platform


def physician_share_bps(conn, expert_id):
    """65-70% by tier. Scores per engagement raise the share and the routing priority."""
    return config.PHYSICIAN_SHARE_BPS[expert_tier(conn, expert_id)]


def inventor_share_bps(platform_funded):
    """30% when the platform carried the patent cost, 50% when the inventor did.

    Either way it beats most US university TTOs, which is the point of the slide.
    """
    return config.INVENTOR_SHARE_BPS_BASE if platform_funded else config.INVENTOR_SHARE_BPS_MAX


def _post(conn, source_kind, source_id, party_kind, party_id, gross, share_bps, when=None):
    party_cents, platform_cents = split(gross, share_bps)
    conn.execute(
        "INSERT INTO payouts (source_kind, source_id, party_kind, party_id, gross_cents,"
        " party_cents, platform_cents, share_bps, posted_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (source_kind, source_id, party_kind, party_id, gross, party_cents,
         platform_cents, share_bps, when or date.today().isoformat()),
    )
    conn.commit()
    return {"party_cents": party_cents, "platform_cents": platform_cents, "share_bps": share_bps}


def post_engagement(conn, engagement_id):
    """Consulting and know-how fees: physician 65-70%, platform 30-35%."""
    row = conn.execute("SELECT * FROM engagements WHERE id=?", (engagement_id,)).fetchone()
    if row is None:
        raise LookupError(f"engagement {engagement_id} not found")
    if row["expert_id"] is None:
        raise ValueError("engagement has no expert to pay")
    bps = physician_share_bps(conn, row["expert_id"])
    return _post(conn, "engagement", engagement_id, "expert", row["expert_id"],
                 row["fee_cents"], bps, row["delivered_at"])


def post_license(conn, license_id):
    """License income: 30-50% to the inventor."""
    row = conn.execute(
        "SELECT l.*, pf.platform_funded, d.inventor_expert_id FROM licenses l"
        " JOIN patent_families pf ON pf.id = l.patent_family_id"
        " JOIN disclosures d ON d.id = pf.disclosure_id WHERE l.id=?",
        (license_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"license {license_id} not found")
    bps = inventor_share_bps(bool(row["platform_funded"]))
    return _post(conn, "license", license_id, "expert", row["inventor_expert_id"],
                 row["income_cents"], bps, row["signed_at"])


def post_trial(conn, trial_id):
    """Trial revenue: 65% stays with the site."""
    row = conn.execute("SELECT * FROM trials WHERE id=?", (trial_id,)).fetchone()
    if row is None:
        raise LookupError(f"trial {trial_id} not found")
    return _post(conn, "trial", trial_id, "institution", row["site_institution_id"],
                 row["revenue_cents"], config.TRIAL_SITE_SHARE_BPS, row["started_at"])


def post_data_partnership(conn, partnership_id):
    """Licensed data revenue: the institution owns the asset and keeps 65%."""
    row = conn.execute("SELECT * FROM data_partnerships WHERE id=?", (partnership_id,)).fetchone()
    if row is None:
        raise LookupError(f"data partnership {partnership_id} not found")
    return _post(conn, "data", partnership_id, "institution", row["institution_id"],
                 row["revenue_cents"], config.DATA_INSTITUTION_SHARE_BPS, row["signed_at"])


def ledger_summary(conn):
    """Platform-level revenue view: gross written, paid out, retained."""
    rows = conn.execute(
        "SELECT source_kind, COUNT(*) n, SUM(gross_cents) gross, SUM(party_cents) paid,"
        " SUM(platform_cents) retained FROM payouts GROUP BY source_kind"
    ).fetchall()
    lines = [dict(r) for r in rows]
    total = {
        "n": sum(l["n"] for l in lines),
        "gross": sum(l["gross"] or 0 for l in lines),
        "paid": sum(l["paid"] or 0 for l in lines),
        "retained": sum(l["retained"] or 0 for l in lines),
    }
    total["retention_pct"] = round(100 * total["retained"] / total["gross"], 1) if total["gross"] else 0.0
    return {"lines": lines, "total": total}


def expert_earnings(conn, expert_id):
    """What one physician has earned across every revenue line."""
    row = conn.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(party_cents),0) paid FROM payouts"
        " WHERE party_kind='expert' AND party_id=?", (expert_id,)
    ).fetchone()
    return {"engagements": row["n"], "paid_cents": row["paid"]}

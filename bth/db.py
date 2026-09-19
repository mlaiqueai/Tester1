"""SQLite storage. One file, no server, no migrations framework.

The schema is the platform's operating record: who is on the network, what was
routed to them, what they said, what was earned and who it was paid to.
"""

import os
import sqlite3

DEFAULT_PATH = os.environ.get("BTH_DB", os.path.join(os.path.dirname(os.path.dirname(__file__)), "bth.db"))

SCHEMA = """
PRAGMA foreign_keys = ON;

-- Institutions: anchor partners, outlier institutions, trial sites.
CREATE TABLE IF NOT EXISTS institutions (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL,
    anchor_partner INTEGER NOT NULL DEFAULT 0,
    signed_at TEXT,
    trial_site INTEGER NOT NULL DEFAULT 0,
    sponsor_ready INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

-- The brain trust.
CREATE TABLE IF NOT EXISTS experts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    institution_id INTEGER REFERENCES institutions(id),
    specialty TEXT NOT NULL,
    subspecialties TEXT NOT NULL DEFAULT '',   -- comma separated
    knowledge_areas TEXT NOT NULL DEFAULT 'clinical',  -- clinical/scientific/technical/regulatory/quality
    credentials TEXT,
    fellow_cohort INTEGER,                      -- innovation fellowship year, if any
    active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT
);

-- The other side of the marketplace.
CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,          -- startup | vc | pe | ib | strategic | sponsor
    country TEXT NOT NULL,
    paying INTEGER NOT NULL DEFAULT 0,
    opened_at TEXT
);

-- Opportunities are the tiles: green co-invest, orange consulting, purple know-how.
CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tile TEXT NOT NULL,                   -- green | orange | purple
    focus_area TEXT NOT NULL,
    source TEXT,
    buyer_id INTEGER REFERENCES buyers(id),
    stage INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- active | stopped | invested | delivered
    blinded_abstract TEXT NOT NULL,        -- what the cohort sees before consent
    consent_to_disclose INTEGER NOT NULL DEFAULT 0,
    company_touches INTEGER NOT NULL DEFAULT 0,
    created_at TEXT
);

-- Stage 0 binary screen.
CREATE TABLE IF NOT EXISTS screens (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    factors_json TEXT NOT NULL,
    verdict TEXT NOT NULL,        -- pass | fail
    memo TEXT,
    screened_at TEXT
);

-- Every gate crossing, green or red. No yellow.
CREATE TABLE IF NOT EXISTS gate_decisions (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    stage INTEGER NOT NULL,
    decision TEXT NOT NULL,       -- green | red
    rationale TEXT NOT NULL,
    decided_by TEXT NOT NULL,
    decided_at TEXT
);

-- Cohort routing. The full matched cohort is always invited; response is opt-in.
CREATE TABLE IF NOT EXISTS routings (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    expert_id INTEGER NOT NULL REFERENCES experts(id),
    stage INTEGER NOT NULL DEFAULT 1,
    invited_at TEXT,
    UNIQUE (opportunity_id, expert_id, stage)
);

CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY,
    routing_id INTEGER NOT NULL REFERENCES routings(id),
    adoption INTEGER NOT NULL,            -- 1-5, would this change practice
    clinical_significance INTEGER NOT NULL,
    evidence_strength INTEGER NOT NULL,
    moat INTEGER NOT NULL,
    bth_involvement INTEGER NOT NULL,     -- would you personally engage on this
    comment TEXT,
    submitted_at TEXT,
    UNIQUE (routing_id)
);

-- Structured diligence (stage 2) and deep diligence (stage 3).
CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    stakeholder TEXT NOT NULL,     -- company | lead_investor | board_member | customer
    conducted_at TEXT,
    cross_validated INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS diligence_packets (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    area TEXT NOT NULL,            -- clinical | scientific | technical | regulatory | quality | investment
    expert_id INTEGER REFERENCES experts(id),
    verdict TEXT NOT NULL,         -- clear | concern | blocker
    open_questions INTEGER NOT NULL DEFAULT 0,
    filed_at TEXT,
    notes TEXT
);

-- Revenue lines. Every engagement, license, trial and data deal posts a ledger row.
CREATE TABLE IF NOT EXISTS engagements (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    opportunity_id INTEGER REFERENCES opportunities(id),
    kind TEXT NOT NULL,            -- consult | knowhow | consensus_read | dd_report | advisory | adoption_index | market_access | placement
    expert_id INTEGER REFERENCES experts(id),
    fee_cents INTEGER NOT NULL,
    delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS disclosures (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    inventor_expert_id INTEGER NOT NULL REFERENCES experts(id),
    institution_id INTEGER REFERENCES institutions(id),
    received_at TEXT,
    status TEXT NOT NULL DEFAULT 'received'  -- received | screened | filed | abandoned
);

CREATE TABLE IF NOT EXISTS patent_families (
    id INTEGER PRIMARY KEY,
    disclosure_id INTEGER NOT NULL REFERENCES disclosures(id),
    ref TEXT NOT NULL UNIQUE,
    filed_at TEXT,
    platform_funded INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY,
    patent_family_id INTEGER NOT NULL REFERENCES patent_families(id),
    licensee_buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    signed_at TEXT,
    income_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trials (
    id INTEGER PRIMARY KEY,
    site_institution_id INTEGER NOT NULL REFERENCES institutions(id),
    sponsor_buyer_id INTEGER NOT NULL REFERENCES buyers(id),
    protocol TEXT NOT NULL,
    revenue_cents INTEGER NOT NULL DEFAULT 0,
    started_at TEXT
);

CREATE TABLE IF NOT EXISTS data_partnerships (
    id INTEGER PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id),
    scope TEXT NOT NULL,
    signed_at TEXT,
    revenue_cents INTEGER NOT NULL DEFAULT 0
);

-- Who got paid what, and what the platform retained.
CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY,
    source_kind TEXT NOT NULL,     -- engagement | license | trial | data
    source_id INTEGER NOT NULL,
    party_kind TEXT NOT NULL,      -- expert | institution
    party_id INTEGER NOT NULL,
    gross_cents INTEGER NOT NULL,
    party_cents INTEGER NOT NULL,
    platform_cents INTEGER NOT NULL,
    share_bps INTEGER NOT NULL,
    posted_at TEXT
);

-- The fund is a separate entity; it only shares the pipeline.
CREATE TABLE IF NOT EXISTS fund_commitments (
    id INTEGER PRIMARY KEY,
    lp_name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    anchor INTEGER NOT NULL DEFAULT 0,
    committed_at TEXT
);

CREATE TABLE IF NOT EXISTS fund_deployments (
    id INTEGER PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
    amount_cents INTEGER NOT NULL,
    coinvest_cents INTEGER NOT NULL DEFAULT 0,
    ksa_domiciled INTEGER NOT NULL DEFAULT 0,
    deployed_at TEXT
);

CREATE TABLE IF NOT EXISTS companies_formed (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    opportunity_id INTEGER REFERENCES opportunities(id),
    formed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_routings_opp ON routings(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_payouts_party ON payouts(party_kind, party_id);
CREATE INDEX IF NOT EXISTS idx_gate_opp ON gate_decisions(opportunity_id, stage);
"""


def connect(path=None):
    """Open the database, creating the schema if it isn't there yet."""
    conn = sqlite3.connect(path or DEFAULT_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def reset(path=None):
    """Drop the file and start clean. Used by the seeder and the tests."""
    target = path or DEFAULT_PATH
    if target != ":memory:" and os.path.exists(target):
        os.remove(target)
    return connect(target)

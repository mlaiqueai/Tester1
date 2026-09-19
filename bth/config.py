"""Constants taken straight from the deck. Change them here, not inline.

Every number below is traceable to a slide in Platform+Fund_v1 so the model can
be audited against the narrative it was raised on.
"""

# ---------------------------------------------------------------- economics
# Slide 6: "the more an individual contributes, the more they earn".
# Consulting / know-how: 65-70% to the physician, platform retains 30-35%.
PHYSICIAN_SHARE_BPS = {"C": 6500, "B": 6750, "A": 7000}  # by expert tier

# Licensing: 30-50% to the inventor, platform funds the patents and keeps 50-80%.
INVENTOR_SHARE_BPS_BASE = 3000        # platform funded and prosecuted the family
INVENTOR_SHARE_BPS_MAX = 5000         # inventor carried cost / prior art was theirs

# Clinical trials: 65% stays with the site, platform earns 35% for sponsors,
# contracts and quality systems.
TRIAL_SITE_SHARE_BPS = 6500

# Data partnerships with outlier institutions: same logic as trials — the
# institution owns the asset, the platform brings the buyer and the compliance.
DATA_INSTITUTION_SHARE_BPS = 6500

# ------------------------------------------------------------- expert index
# Scores per engagement raise routing priority, so effort compounds into work.
TIER_THRESHOLDS = {"A": 75.0, "B": 45.0}  # below B -> tier C
RESPONSIVENESS_WEIGHT = 0.4
DEPTH_WEIGHT = 0.35
CALIBRATION_WEIGHT = 0.25
# An expert with one answered invitation is not yet a proven reader, so the raw
# score is shrunk toward a neutral prior until enough reads exist to trust it.
INDEX_SHRINKAGE_K = 3
INDEX_NEUTRAL_PRIOR = 40.0

# --------------------------------------------------------------- consensus
# "100-physician consensus reads" — a read is only reportable once enough of
# the routed cohort has answered.
QUORUM_MIN_RESPONSES = 8
QUORUM_MIN_RESPONSE_RATE = 0.25
CONSENSUS_GREEN_MIN = 3.4    # mean adoption likelihood, 1-5, index-weighted
CONSENSUS_SPREAD_MAX = 1.35  # a split cohort is not a signal

# ------------------------------------------------------------- stage gates
# VF Workflow v2: gates are green or red. Yellow means limbo and is not allowed.
STAGES = {
    0: "LLM intake & thesis screen",
    1: "Brain trust sentiment",
    2: "Structured diligence interviews",
    3: "Deep diligence",
    4: "Commit & execute",
    5: "Post-investment (optional)",
}
SCREEN_FACTORS = ("thesis_fit", "team", "product", "market", "financing")
INTERVIEW_STAKEHOLDERS = ("company", "lead_investor", "board_member", "customer")
DEEP_DILIGENCE_AREAS = ("clinical", "scientific", "technical", "regulatory", "quality")
MAX_COMPANY_TOUCHES = 3  # communicated to the company upfront

# Tiles, as the platform shows them to the expert cohort.
TILES = {"green": "VC co-invest", "orange": "Consulting", "purple": "Know-how"}

# Focus areas the thesis admits. Stage 0 screens everything else out.
FOCUS_AREAS = (
    "vascular", "cardiac", "imaging", "diagnostics", "ai_clinical",
    "transplant", "ophthalmology", "oncology",
)

# ------------------------------------------------------------- checkpoints
# Slide 7: the metrics that move KSA from buyer to innovation leader.
# Platform capital from PIF is tranched against these.
CHECKPOINTS = {
    "anchor_partnerships":      {"2028": 8,   "2030": 20,  "label": "Anchor institutional partnerships signed"},
    "disclosures_per_year":     {"2028": 150, "2030": 300, "label": "Disclosures per year"},
    "patent_families_per_year": {"2028": 60,  "2030": 110, "label": "Patent families filed per year"},
    "paying_buyer_accounts":    {"2028": 40,  "2030": 120, "label": "Paying buyer accounts"},
    "active_physicians":        {"2028": 300, "2030": 600, "label": "Active physicians"},
    "saudi_physicians":         {"2028": 40,  "2030": 100, "label": "Saudi physicians"},
    "data_partnerships":        {"2028": 5,   "2030": 15,  "label": "Data partnerships live"},
    "trial_sites_ready":        {"2028": 45,  "2030": 100, "label": "Trial sites sponsor-ready"},
    "trial_sites_ksa":          {"2028": 18,  "2030": 35,  "label": "KSA trial sites"},
    "licenses_cumulative":      {"2028": 3,   "2030": 25,  "label": "Licenses signed, cumulative"},
}

# Slide 8: downstream Kingdom impact (aspirational), first value -> later value.
KINGDOM_IMPACT = {
    "saudi_jobs":             {"from": 253, "to": 731, "label": "Saudi high-skill jobs supported"},
    "companies_formed":       {"from": 21,  "to": 88,  "label": "Companies formed in the Kingdom"},
    "saudi_patent_families":  {"from": 66,  "to": 139, "label": "Patent families with Saudi inventors"},
    "saudi_physicians_paid":  {"from": 108, "to": 375, "label": "Saudi physicians earning on the platform"},
    "fellows_trained":        {"from": 58,  "to": 200, "label": "Saudi innovation fellows trained"},
}
SAUDI_PHYSICIAN_PAY_TARGET_2036_USD = 15_000_000

# Slide 11: sovereign scale. Note the deck carries two figures for capital into
# KSA companies — $70M on slide 8 and $200M on slide 11. Both are kept; the
# dashboard reports against the slide 11 number and flags the gap.
SOVEREIGN = {
    "platform_build_usd": 160_000_000,
    "fund1_anchor_pif_usd": 60_000_000,
    "fund1_implied_usd": 100_000_000,   # PIF at 50%
    "capital_into_ksa_usd": 200_000_000,  # fund + co-invest (slide 11)
    "capital_into_ksa_usd_slide8": 70_000_000,
    "pif_anchor_pct": 50,
}

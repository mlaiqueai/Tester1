"""A demonstration network, sized so every mechanism has something to chew on.

The institutions are the ones the deck names — an eye hospital in Egypt doing
the highest per-capita surgical volume in the world, a fully digital private
hospital in Pakistan, cancer and cardiac centres from Brazil to Southeast Asia —
plus Kingdom anchors and the invention economies that need a validation rail.
"""

import random
from datetime import date, timedelta

from . import consensus, db, economics, experts, pipeline

TODAY = date(2026, 9, 19)


def _d(days_ago):
    return (TODAY - timedelta(days=days_ago)).isoformat()


INSTITUTIONS = [
    # name, country, anchor, trial_site, sponsor_ready, note
    ("King Faisal Specialist Hospital & Research Centre", "SA", 1, 1, 1, "Kingdom anchor — transplant and oncology volume"),
    ("King Abdulaziz Medical City", "SA", 1, 1, 1, "Kingdom anchor — cardiac"),
    ("Riyadh Second Health Cluster", "SA", 1, 1, 0, "Cluster-wide site agreement in negotiation"),
    ("Magrabi Eye Hospital, Cairo", "EG", 1, 1, 1, "Highest per-capita surgical volume in the world"),
    ("Indus Health Network, Karachi", "PK", 1, 1, 0, "Fully digital inside 18 months; transplant and cardiac surgery"),
    ("A.C.Camargo Cancer Center", "BR", 1, 1, 1, "Latin American oncology volume"),
    ("National Heart Centre Singapore", "SG", 1, 1, 1, "Early innovation under government mandate"),
    ("Samsung Medical Center", "KR", 0, 1, 1, "Imaging and clinical AI"),
    ("Fuwai Hospital, Beijing", "CN", 0, 1, 0, "Device export book; no validation outside China"),
    ("Cleveland Clinic Abu Dhabi", "AE", 0, 1, 1, "GCC comparator site"),
]

EXPERTS = [
    # name, country, specialty, subspecialties, knowledge areas, institution index, fellow cohort
    ("Dr. Faisal Al-Harbi", "SA", "vascular", "vascular,cardiac", "clinical", 0, 2026),
    ("Dr. Noura Al-Qahtani", "SA", "diagnostics", "diagnostics,oncology", "clinical,scientific", 0, 2026),
    ("Dr. Saad Al-Mutairi", "SA", "cardiac", "cardiac,imaging", "clinical", 1, None),
    ("Dr. Hessa Al-Dossari", "SA", "transplant", "transplant,diagnostics", "clinical,regulatory", 1, 2025),
    ("Dr. Yousef Al-Shammari", "SA", "imaging", "imaging,ai_clinical", "clinical,technical", 2, 2025),
    ("Dr. Amira Hassan", "EG", "ophthalmology", "ophthalmology,ai_clinical", "clinical", 3, None),
    ("Dr. Karim Fouad", "EG", "ophthalmology", "ophthalmology,imaging", "clinical,scientific", 3, None),
    ("Dr. Sana Iqbal", "PK", "transplant", "transplant,vascular", "clinical", 4, None),
    ("Dr. Bilal Ahmed", "PK", "cardiac", "cardiac,vascular", "clinical,quality", 4, None),
    ("Dr. Luiza Prado", "BR", "oncology", "oncology,diagnostics", "clinical,scientific", 5, None),
    ("Dr. Rafael Duarte", "BR", "vascular", "vascular,imaging", "clinical", 5, None),
    ("Dr. Wei Lin Tan", "SG", "cardiac", "cardiac,ai_clinical", "clinical,technical", 6, None),
    ("Dr. Priya Menon", "SG", "diagnostics", "diagnostics,ai_clinical", "scientific,technical", 6, None),
    ("Dr. Jihoon Park", "KR", "imaging", "imaging,ai_clinical", "clinical,technical", 7, None),
    ("Dr. Min-Seo Kang", "KR", "diagnostics", "diagnostics,oncology", "scientific", 7, None),
    ("Dr. Chen Yu", "CN", "vascular", "vascular,cardiac", "clinical", 8, None),
    ("Dr. Sarah Whitfield", "GB", "vascular", "vascular", "clinical,regulatory", None, None),
    ("Dr. Martin Reiss", "DE", "regulatory affairs", "vascular,diagnostics", "regulatory,quality", None, None),
    ("Dr. Elena Vasquez", "US", "quality systems", "diagnostics,imaging", "quality,regulatory", None, None),
    ("Dr. Omar Siddiqui", "AE", "cardiac", "cardiac,transplant", "clinical", 9, None),
    ("Dr. Ayesha Rahman", "PK", "ophthalmology", "ophthalmology", "clinical", 4, None),
    ("Dr. Tomas Neves", "BR", "imaging", "imaging,oncology", "clinical", 5, None),
    ("Dr. Haruto Sato", "JP", "imaging", "imaging,ai_clinical", "clinical,scientific", None, None),
    ("Dr. Lina Abdallah", "SA", "oncology", "oncology,diagnostics", "clinical", 0, 2026),
]

BUYERS = [
    ("Gulf Growth Partners", "vc", "AE", 1),
    ("Tamweel Ventures", "vc", "SA", 1),
    ("Northbridge Medtech PE", "pe", "US", 1),
    ("Helios Strategic Devices", "strategic", "US", 1),
    ("Kyoto Imaging KK", "strategic", "JP", 1),
    ("Meridian Investment Bank", "ib", "GB", 0),
    ("Cathwave Therapeutics", "startup", "SG", 0),
    ("RenalSense Diagnostics", "startup", "IL", 0),
    ("Orbital Vision AI", "startup", "KR", 1),
    ("Sponsor: Vascular Trials Consortium", "sponsor", "US", 1),
]

OPPORTUNITIES = [
    # code, name, tile, focus, abstract, source, buyer index
    ("BTH-001", "Cathwave — drug-coated balloon for BTK disease", "green",
     "vascular", "Below-the-knee drug-coated balloon, first-in-human done, 24-month patency "
     "data from two Asian sites, raising a Series B alongside an existing lead.", "referral", 6),
    ("BTH-002", "Orbital Vision — autonomous DR screening", "green", "ai_clinical",
     "Autonomous diabetic retinopathy screening cleared in Korea, seeking validation and "
     "reimbursement path outside its home market.", "inbound", 8),
    ("BTH-003", "RenalSense — bedside AKI biomarker panel", "green", "diagnostics",
     "Point-of-care acute kidney injury panel with single-centre data, no health-economic "
     "case built yet.", "vc co-invest", 7),
    ("BTH-004", "Helios — adoption read on peripheral IVL", "orange", "vascular",
     "Strategic wants a 100-physician consensus read on intravascular lithotripsy adoption "
     "across GCC and Southeast Asia before committing to a channel build.", "buyer request", 3),
    ("BTH-005", "Kyoto Imaging — know-how retainer, AI triage", "purple", "imaging",
     "Twelve-month know-how retainer: what do reading-room workflows actually need before "
     "an AI triage tool gets used rather than bought.", "buyer request", 4),
    ("BTH-006", "Fuwai spinout — transcatheter valve, ex-China validation", "green", "cardiac",
     "Chinese transcatheter valve with domestic volume seeking credible validation and a "
     "regulatory path outside China.", "outbound", None),
]


# The named experts above are the founding cohort. A consensus read is only a
# read at scale, so the seed fills the network out to a few hundred physicians
# across the focus areas — synthetic, but distributed the way the real one has
# to be if a 100-physician read is going to clear quorum in a given specialty.
GIVEN_NAMES = {
    "SA": ["Abdullah", "Nouf", "Khalid", "Reem", "Majed", "Sara", "Turki", "Lama", "Bandar", "Huda"],
    "EG": ["Mostafa", "Yasmin", "Tarek", "Dalia", "Hany", "Mona"],
    "PK": ["Imran", "Ayesha", "Usman", "Fatima", "Zain", "Hira"],
    "BR": ["Pedro", "Camila", "Lucas", "Beatriz", "Rafael", "Juliana"],
    "SG": ["Wei", "Shu", "Jian", "Mei", "Kai", "Hui"],
    "KR": ["Jisoo", "Minho", "Seoyeon", "Junseo", "Hyerin", "Daeun"],
    "JP": ["Takashi", "Yuki", "Kenji", "Aoi", "Sora", "Nanami"],
    "CN": ["Hao", "Ling", "Feng", "Xin", "Jun", "Yan"],
    "IN": ["Arjun", "Divya", "Rohit", "Meera", "Vikram", "Anita"],
    "AE": ["Salem", "Mariam", "Hamad", "Noura", "Rashid", "Alia"],
    "GB": ["James", "Charlotte", "Oliver", "Emily", "Henry", "Grace"],
    "US": ["Michael", "Jessica", "David", "Laura", "Andrew", "Rachel"],
    "DE": ["Lukas", "Anna", "Jonas", "Lena", "Felix", "Marie"],
}
FAMILY_NAMES = {
    "SA": ["Al-Otaibi", "Al-Ghamdi", "Al-Zahrani", "Al-Subaie", "Al-Rashid", "Al-Juhani"],
    "EG": ["Ibrahim", "Naguib", "Saleh", "Farouk", "Mansour", "Zaki"],
    "PK": ["Khan", "Malik", "Shah", "Qureshi", "Baig", "Chaudhry"],
    "BR": ["Silva", "Oliveira", "Costa", "Almeida", "Ribeiro", "Nunes"],
    "SG": ["Tan", "Lim", "Ng", "Goh", "Chua", "Koh"],
    "KR": ["Kim", "Lee", "Park", "Choi", "Jung", "Yoon"],
    "JP": ["Sato", "Suzuki", "Takahashi", "Tanaka", "Ito", "Watanabe"],
    "CN": ["Zhang", "Wang", "Li", "Liu", "Chen", "Zhao"],
    "IN": ["Sharma", "Patel", "Nair", "Reddy", "Iyer", "Desai"],
    "AE": ["Al-Mansoori", "Al-Suwaidi", "Al-Hashimi", "Al-Nuaimi", "Al-Marri", "Al-Kaabi"],
    "GB": ["Whitmore", "Hughes", "Bennett", "Clarke", "Hargreaves", "Ellis"],
    "US": ["Carter", "Nguyen", "Patel", "Brooks", "Foster", "Ramirez"],
    "DE": ["Keller", "Braun", "Schwarz", "Neumann", "Hofmann", "Vogel"],
}
# Country mix: Saudi supply is the fellowship pipeline, so it is deliberately
# over-weighted relative to population — it is the metric the checkpoints track.
COUNTRY_MIX = (["SA"] * 26 + ["EG"] * 9 + ["PK"] * 9 + ["BR"] * 9 + ["SG"] * 7
               + ["KR"] * 7 + ["JP"] * 6 + ["CN"] * 8 + ["IN"] * 8 + ["AE"] * 5
               + ["GB"] * 4 + ["US"] * 5 + ["DE"] * 3)
SPECIALTY_MIX = [
    ("vascular", "vascular,imaging"), ("vascular", "vascular,cardiac"),
    ("cardiac", "cardiac,imaging"), ("cardiac", "cardiac,vascular"),
    ("imaging", "imaging,ai_clinical"), ("diagnostics", "diagnostics,oncology"),
    ("diagnostics", "diagnostics,ai_clinical"), ("oncology", "oncology,diagnostics"),
    ("transplant", "transplant,diagnostics"), ("ophthalmology", "ophthalmology,imaging"),
    ("ai_clinical", "ai_clinical,imaging"),
]
KNOWLEDGE_MIX = ["clinical", "clinical", "clinical,scientific", "clinical,technical",
                 "scientific,technical", "regulatory,quality", "clinical,regulatory",
                 "quality,clinical"]


def _generate_network(conn, rng, inst_ids, count=110):
    """Fill the network out past the named founding cohort."""
    ids = []
    for i in range(count):
        country = COUNTRY_MIX[i % len(COUNTRY_MIX)]
        first = rng.choice(GIVEN_NAMES[country])
        last = rng.choice(FAMILY_NAMES[country])
        specialty, subs = SPECIALTY_MIX[i % len(SPECIALTY_MIX)]
        institution = rng.choice(inst_ids) if rng.random() < 0.55 else None
        fellow = rng.choice([2025, 2026]) if country == "SA" and rng.random() < 0.55 else None
        ids.append(experts.add_expert(
            conn, f"Dr. {first} {last}", country, specialty, subs,
            rng.choice(KNOWLEDGE_MIX), institution_id=institution,
            fellow_cohort=fellow, joined_at=_d(rng.randint(30, 520))))
    return ids


def build(path=None):
    """Create a fresh database and populate it. Returns the connection."""
    rng = random.Random(7)
    conn = db.reset(path)

    inst_ids = []
    for i, (name, country, anchor, site, ready, note) in enumerate(INSTITUTIONS):
        cur = conn.execute(
            "INSERT INTO institutions (name, country, anchor_partner, signed_at, trial_site,"
            " sponsor_ready, notes) VALUES (?,?,?,?,?,?,?)",
            (name, country, anchor, _d(400 - i * 30) if anchor else None, site, ready, note))
        inst_ids.append(cur.lastrowid)

    expert_ids = []
    for name, country, spec, subs, areas, inst_idx, fellow in EXPERTS:
        expert_ids.append(experts.add_expert(
            conn, name, country, spec, subs, areas,
            institution_id=inst_ids[inst_idx] if inst_idx is not None else None,
            fellow_cohort=fellow, joined_at=_d(rng.randint(60, 500))))

    expert_ids += _generate_network(conn, rng, inst_ids)

    buyer_ids = []
    for name, kind, country, paying in BUYERS:
        cur = conn.execute(
            "INSERT INTO buyers (name, kind, country, paying, opened_at) VALUES (?,?,?,?,?)",
            (name, kind, country, paying, _d(rng.randint(30, 400))))
        buyer_ids.append(cur.lastrowid)

    opp_ids = []
    for code, name, tile, focus, abstract, source, buyer_idx in OPPORTUNITIES:
        opp_ids.append(pipeline.create_opportunity(
            conn, code, name, tile, focus, abstract, source=source,
            buyer_id=buyer_ids[buyer_idx] if buyer_idx is not None else None,
            created_at=_d(rng.randint(20, 180))))

    _run_history(conn, rng, expert_ids)
    _run_pipeline(conn, rng, opp_ids, expert_ids)
    _run_revenue(conn, rng, expert_ids, inst_ids, buyer_ids, opp_ids)
    _run_fund(conn, opp_ids)
    return conn


def _screen_all(conn, opp_ids):
    passing = {k: True for k in ("thesis_fit", "team", "product", "market", "financing")}
    for i, opp_id in enumerate(opp_ids):
        factors = dict(passing)
        if i == 2:  # RenalSense: no health-economic case, financing unproven
            factors["financing"] = False
        pipeline.screen(conn, opp_id, factors,
                        memo="Intake draft reviewed by IC against the five-factor grid.",
                        screened_at=_d(30))


def _answer(conn, rng, opp_id, mood, comment_rate=0.7):
    """Have the routed cohort respond, with a mood that shapes the distribution."""
    routings = conn.execute(
        "SELECT * FROM routings WHERE opportunity_id=? AND stage=1", (opp_id,)).fetchall()
    for r in routings:
        if rng.random() > 0.78:       # participation is opt-in; not everyone answers
            continue
        base = {"hot": 4.4, "warm": 3.8, "cold": 2.4, "split": 3.2}[mood]
        jitter = 1.6 if mood == "split" else 0.7
        def draw(centre):
            return max(1, min(5, int(round(rng.gauss(centre, jitter)))))
        comment = None
        if rng.random() < comment_rate:
            comment = ("Adoption turns on whether the comparator arm reflects how we actually "
                       "treat these patients locally; the health-economic case is the gap, not "
                       "the device itself.")
        consensus.submit(conn, r["id"], draw(base), draw(base + 0.2), draw(base - 0.3),
                         draw(base - 0.2), draw(base - 0.4), comment, submitted_at=_d(20))


def _run_pipeline(conn, rng, opp_ids, expert_ids):
    _screen_all(conn, opp_ids)
    ic = "Investment Committee"

    # BTH-001 runs the whole way to a written check.
    o = opp_ids[0]
    pipeline.gate(conn, o, "green", "Screen clean; below-the-knee fits the thesis.", ic, _d(29))
    experts.route(conn, o, stage=1)
    _answer(conn, rng, o, "hot")
    pipeline.gate(conn, o, "green", "Cohort positive on adoption and evidence.", ic, _d(22))
    for who in ("company", "lead_investor", "board_member", "customer"):
        pipeline.record_interview(conn, o, who, cross_validated=True,
                                  notes=f"{who} interview cross-validated to the model.",
                                  conducted_at=_d(18))
    pipeline.gate(conn, o, "green", "Stories cross-validate; no contradiction on the model.", ic, _d(16))
    for area in ("clinical", "scientific", "technical", "regulatory", "quality", "investment"):
        pipeline.file_packet(conn, o, area, "clear", expert_id=expert_ids[0], open_questions=0,
                             notes=f"{area} diligence closed.", filed_at=_d(12))
    pipeline.gate(conn, o, "green", "Conviction sufficient; round priced in line with comps.", ic, _d(10))
    pipeline.gate(conn, o, "green", "Follow the lead's terms; execute.", ic, _d(8))

    # BTH-002 sits at stage 3 with an open regulatory question.
    o = opp_ids[1]
    pipeline.gate(conn, o, "green", "Screen clean.", ic, _d(28))
    experts.route(conn, o, stage=1)
    _answer(conn, rng, o, "warm")
    try:
        pipeline.gate(conn, o, "green", "Cohort supportive.", ic, _d(21))
    except (pipeline.GateNotReady, pipeline.GateRefused):
        pass
    if conn.execute("SELECT stage FROM opportunities WHERE id=?", (o,)).fetchone()["stage"] >= 2:
        for who in ("company", "lead_investor", "board_member", "customer"):
            pipeline.record_interview(conn, o, who, cross_validated=True, conducted_at=_d(17))
        pipeline.gate(conn, o, "green", "Answer set complete.", ic, _d(15))
        for area in ("clinical", "scientific", "technical", "quality", "investment"):
            pipeline.file_packet(conn, o, area, "clear", filed_at=_d(9))
        pipeline.file_packet(conn, o, "regulatory", "concern", open_questions=2,
                             notes="Reimbursement path outside Korea is unresolved.", filed_at=_d(9))

    # BTH-003 stops at stage 0 — the screen failed on financing.
    o = opp_ids[2]
    pipeline.gate(conn, o, "red", "Screen failed on financing; no health-economic case.", ic, _d(26))

    # BTH-004 and BTH-005 are platform revenue, not fund deals: routed and read.
    for idx, mood in ((3, "hot"), (4, "warm")):
        o = opp_ids[idx]
        pipeline.gate(conn, o, "green", "Buyer engagement accepted.", ic, _d(24))
        experts.route(conn, o, stage=1)
        _answer(conn, rng, o, mood)

    # BTH-006 splits the cohort — trust, not data, is the open question.
    o = opp_ids[5]
    pipeline.gate(conn, o, "green", "Screen clean; validation gap is the thesis.", ic, _d(20))
    experts.route(conn, o, stage=1)
    _answer(conn, rng, o, "split")



HISTORY = [
    ("BTH-H01", "Peripheral atherectomy catheter, second-generation", "green", "vascular", "hot"),
    ("BTH-H02", "Portable retinal camera for screening camps", "green", "ophthalmology", "warm"),
    ("BTH-H03", "AI triage for non-contrast head CT", "green", "ai_clinical", "hot"),
    ("BTH-H04", "Dialysis access surveillance device", "green", "vascular", "cold"),
    ("BTH-H05", "Liquid biopsy panel, GI indications", "green", "diagnostics", "cold"),
    ("BTH-H06", "Transplant rejection monitoring assay", "green", "transplant", "warm"),
    ("BTH-H07", "Adoption read: structural heart in GCC", "orange", "cardiac", "hot"),
    ("BTH-H08", "Know-how retainer: imaging workflow integration", "purple", "imaging", "warm"),
    ("BTH-H09", "Robotic bronchoscopy, emerging-market economics", "green", "oncology", "cold"),
    ("BTH-H10", "Bedside coagulation analyser", "green", "diagnostics", "warm"),
    ("BTH-H11", "Adoption read: DR screening reimbursement", "orange", "ophthalmology", "hot"),
    ("BTH-H12", "Cardiac AI echo interpretation", "green", "ai_clinical", "warm"),
    ("BTH-H13", "Peripheral stent graft, below-knee", "green", "vascular", "warm"),
    ("BTH-H14", "Digital pathology triage, resource-limited labs", "purple", "diagnostics", "cold"),
]


def _run_history(conn, rng, expert_ids):
    """Closed deals from earlier cycles.

    Without a history the expert index has nothing to calibrate against: a
    reader is only demonstrably good once some of the deals they read have
    resolved. These also give the checkpoint counters a realistic base.
    """
    ic = "Investment Committee"
    passing = {k: True for k in ("thesis_fit", "team", "product", "market", "financing")}
    for i, (code, name, tile, focus, mood) in enumerate(HISTORY):
        age = 240 - i * 12
        opp_id = pipeline.create_opportunity(
            conn, code, name, tile, focus,
            f"Historical cycle read, {focus.replace('_', ' ')}.",
            source="prior cycle", created_at=_d(age))
        pipeline.screen(conn, opp_id, passing, memo="Prior cycle intake.", screened_at=_d(age - 1))
        pipeline.gate(conn, opp_id, "green", "Screen clean.", ic, _d(age - 2))
        experts.route(conn, opp_id, stage=1)
        _answer(conn, rng, opp_id, mood, comment_rate=0.55)

        signal = consensus.read(conn, opp_id, stage=1)
        if signal["signal"] != "positive":
            pipeline.gate(conn, opp_id, "red",
                          f"Cohort sentiment {signal['signal']}; stop rather than sit in limbo.",
                          ic, _d(age - 8))
            continue
        pipeline.gate(conn, opp_id, "green", "Cohort positive.", ic, _d(age - 8))
        for who in ("company", "lead_investor", "board_member", "customer"):
            pipeline.record_interview(conn, opp_id, who, cross_validated=True,
                                      conducted_at=_d(age - 14))
        # Roughly a third of the reads that clear sentiment still die in diligence.
        if rng.random() < 0.35:
            pipeline.gate(conn, opp_id, "red",
                          "Interviews did not cross-validate to the business model.", ic, _d(age - 18))
            continue
        pipeline.gate(conn, opp_id, "green", "Answer set complete.", ic, _d(age - 18))
        for area in ("clinical", "scientific", "technical", "regulatory", "quality", "investment"):
            pipeline.file_packet(conn, opp_id, area, "clear", expert_id=rng.choice(expert_ids),
                                 filed_at=_d(age - 24))
        if rng.random() < 0.5:
            pipeline.gate(conn, opp_id, "green", "Conviction sufficient.", ic, _d(age - 28))
            pipeline.gate(conn, opp_id, "green", "Executed on the lead's terms.", ic, _d(age - 30))
        else:
            pipeline.gate(conn, opp_id, "red", "Priced ahead of proven exit comps.", ic, _d(age - 28))


def _run_revenue(conn, rng, expert_ids, inst_ids, buyer_ids, opp_ids):
    engagements = [
        (buyer_ids[3], opp_ids[3], "consensus_read", expert_ids[0], 4_800_000),
        (buyer_ids[3], opp_ids[3], "adoption_index", expert_ids[10], 3_600_000),
        (buyer_ids[4], opp_ids[4], "knowhow", expert_ids[13], 7_200_000),
        (buyer_ids[4], opp_ids[4], "knowhow", expert_ids[4], 5_400_000),
        (buyer_ids[0], opp_ids[0], "dd_report", expert_ids[16], 9_000_000),
        (buyer_ids[2], None, "advisory", expert_ids[17], 6_500_000),
        (buyer_ids[5], None, "market_access", expert_ids[18], 4_200_000),
        (buyer_ids[1], opp_ids[1], "consult", expert_ids[11], 5_100_000),
    ]
    for buyer_id, opp_id, kind, expert_id, fee in engagements:
        cur = conn.execute(
            "INSERT INTO engagements (buyer_id, opportunity_id, kind, expert_id, fee_cents,"
            " delivered_at) VALUES (?,?,?,?,?,?)",
            (buyer_id, opp_id, kind, expert_id, fee, _d(rng.randint(5, 120))))
        economics.post_engagement(conn, cur.lastrowid)

    disclosures = [
        ("Steerable sheath for below-the-knee access", expert_ids[0], inst_ids[0], True),
        ("Corneal imaging protocol for high-volume screening", expert_ids[5], inst_ids[3], True),
        ("Dialysis circuit pressure signature for early clotting", expert_ids[7], inst_ids[4], False),
        ("Contrast-sparing runoff protocol", expert_ids[3], inst_ids[1], True),
        ("Transplant rejection panel scoring method", expert_ids[23], inst_ids[0], True),
    ]
    for i, (title, inventor, inst, funded) in enumerate(disclosures):
        cur = conn.execute(
            "INSERT INTO disclosures (title, inventor_expert_id, institution_id, received_at, status)"
            " VALUES (?,?,?,?, 'filed')", (title, inventor, inst, _d(200 - i * 20)))
        pf = conn.execute(
            "INSERT INTO patent_families (disclosure_id, ref, filed_at, platform_funded)"
            " VALUES (?,?,?,?)",
            (cur.lastrowid, f"BTH-PCT-{2026}-{i + 1:03d}", _d(170 - i * 20), int(funded)))
        if i < 2:
            lic = conn.execute(
                "INSERT INTO licenses (patent_family_id, licensee_buyer_id, signed_at, income_cents)"
                " VALUES (?,?,?,?)",
                (pf.lastrowid, buyer_ids[3 + i], _d(60 - i * 10), 12_000_000 + i * 8_000_000))
            economics.post_license(conn, lic.lastrowid)

    trials = [
        (inst_ids[0], buyer_ids[9], "BTK-DCB pivotal, GCC arm", 28_000_000),
        (inst_ids[3], buyer_ids[8], "Autonomous DR screening validation", 16_500_000),
        (inst_ids[5], buyer_ids[9], "Peripheral IVL registry, LatAm", 12_400_000),
        (inst_ids[1], buyer_ids[9], "BTK-DCB pivotal, second KSA site", 21_000_000),
    ]
    for site, sponsor, protocol, revenue in trials:
        cur = conn.execute(
            "INSERT INTO trials (site_institution_id, sponsor_buyer_id, protocol, revenue_cents,"
            " started_at) VALUES (?,?,?,?,?)", (site, sponsor, protocol, revenue, _d(90)))
        economics.post_trial(conn, cur.lastrowid)

    partnerships = [
        (inst_ids[3], "De-identified high-volume cataract and DR imaging", 9_000_000),
        (inst_ids[4], "Digital transplant and cardiac surgery outcomes", 7_500_000),
        (inst_ids[5], "Oncology pathology archive, consented", 6_000_000),
    ]
    for inst, scope, revenue in partnerships:
        cur = conn.execute(
            "INSERT INTO data_partnerships (institution_id, scope, signed_at, revenue_cents)"
            " VALUES (?,?,?,?)", (inst, scope, _d(120), revenue))
        economics.post_data_partnership(conn, cur.lastrowid)

    for name, country, opp_id in (("Cathwave MENA Ltd", "SA", opp_ids[0]),
                                  ("Magrabi Vision Data Co", "SA", None),
                                  ("Gulf Vascular Devices", "SA", None)):
        conn.execute(
            "INSERT INTO companies_formed (name, country, opportunity_id, formed_at)"
            " VALUES (?,?,?,?)", (name, country, opp_id, _d(150)))
    conn.commit()


def _run_fund(conn, opp_ids):
    commitments = [
        ("Public Investment Fund", 6_000_000_000, 1),   # $60M anchor, 50% of Fund 1
        ("Kingdom institutional LP", 2_500_000_000, 0),
        ("GCC family office syndicate", 1_500_000_000, 0),
    ]
    for lp, amount, anchor in commitments:
        conn.execute(
            "INSERT INTO fund_commitments (lp_name, amount_cents, anchor, committed_at)"
            " VALUES (?,?,?,?)", (lp, amount, anchor, _d(210)))
    conn.execute(
        "INSERT INTO fund_deployments (opportunity_id, amount_cents, coinvest_cents,"
        " ksa_domiciled, deployed_at) VALUES (?,?,?,?,?)",
        (opp_ids[0], 400_000_000, 250_000_000, 1, _d(7)))
    conn.commit()


if __name__ == "__main__":
    conn = build()
    print("seeded", db.DEFAULT_PATH)

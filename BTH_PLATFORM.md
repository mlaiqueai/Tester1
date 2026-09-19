# Brain Trust Holdings — platform build

A working implementation of the platform in `Platform+Fund_v1`: the two-sided
network (physicians and knowledge experts on one side; startups, VCs, PEs, IBs,
strategics and trial sponsors on the other), the stage-gate workflow that runs
on top of it, the incentive model that pays the network, and the checkpoint
tracking the Kingdom capital is tranched against.

No dependencies. Python 3.9+, SQLite, the standard library.

```bash
python3 run_bth.py seed          # build a demonstration network
python3 run_bth.py serve         # console on http://127.0.0.1:8000
python3 run_bth.py dashboard     # checkpoints, ledger and fund as text
python3 run_bth.py board         # the pipeline and what each deal is waiting on
python3 run_bth.py experts 20    # the index leaderboard
python3 -m unittest discover -s tests
```

Every page has a JSON twin: `/api/dashboard`, `/api/board`, `/api/opportunity/<id>`,
`/api/experts`.

## What the deck asked for, and where it lives

| Deck | Module |
|---|---|
| Four revenue groups — consulting, know-how, consensus reads, DD reports, advisory, adoption index, market access, placements | `bth/economics.py`, `engagements` |
| Patents and licensing for innovators | `disclosures` → `patent_families` → `licenses`, `economics.post_license` |
| Clinical trial site network | `trials`, `economics.post_trial` |
| Data partnerships with outlier institutions | `data_partnerships`, `economics.post_data_partnership` |
| 100-physician consensus reads, Clinical Adoption Index | `bth/consensus.py` |
| "The more an individual contributes, the more they earn" | `bth/experts.py` index → tier → fee band in `bth/economics.py` |
| 65–70% / 30–50% / 65% splits | `bth/config.py`, enforced in `economics.split` |
| Stage 0–5 workflow, green/red gates, IC at every stage | `bth/pipeline.py` |
| End-2028 / end-2030 checkpoints | `bth/kpi.py`, `/` dashboard |
| Kingdom impact, slide 8 | `kpi.kingdom_impact` |
| Fund as a separate entity | `fund_commitments`, `fund_deployments`, `/fund` |

## Decisions the build had to make

The deck sets the economics and the narrative; the workflow review of 4 August
left five risks open. Each is answered in code rather than left to discipline.

**Confidentiality at stage 1.** Routing a live deal to a wide cohort is the
legal trigger the review flagged. The cohort is served a blinded abstract and a
code, never the company, until consent is recorded on the opportunity
(`experts.cohort_payload`). Consent is a field, so the exposure is auditable.

**Participation scoring rewarding the loudest, not the best.** The index is
40% responsiveness, 35% written depth, 25% calibration against how the deals
that expert read actually resolved — then shrunk toward a neutral prior until
they have a track record. One sharp read does not buy a tier; neither does
volume alone. Tier sets the fee band inside the deck's 65–70% range, so the
share is earned rather than negotiated.

**Thin cohorts masquerading as signal.** A read below quorum (8 responses and
25% of the routed cohort) reports as inconclusive, not as a weak yes, and a
cohort whose adoption scores are genuinely split never reads positive however
high the mean sits. The gate refuses a green on anything but a positive read.

**Yellow gates.** `pipeline.gate` accepts `green` or `red` and raises on
anything else. A green is refused when the evidence does not support it — a
failed screen, a non-positive cohort read, an open blocker in deep diligence —
and refused as *not ready* when the stage's own work is unfinished. Red is
always available, which is the point: the deal leaves the board either way.

**The expert mapping table that did not exist.** Experts carry specialty,
subspecialties and knowledge areas; `experts.matched_cohort` routes on them and
always invites the full match. Selection happens at response time, not send
time. Deep diligence can demand the regulatory and quality areas the review
named as the platform's acknowledged gap.

Two more, smaller: the 2–3 company touch cap is counted and enforced
(`record_interview` raises on the fourth), and every payout is a ledger row
with the share in basis points, so what the platform retained on any engagement
is reconstructable.

## What the deck leaves open

Three things surfaced while building that are yours to settle, not mine:

1. **The anchor arithmetic doesn't close.** Slide 11 has PIF at $60M anchoring
   Fund 1 "at 50%", and Fund 1 implied at $100M. $60M at 50% implies $120M. The
   seed follows the $60M figure, so the console shows the anchor at 60% and
   flags it against the 50% target.
2. **Capital into KSA companies appears twice, differently** — $70M on slide 8,
   $200M on slide 11. The dashboard reports against $200M and names the other.
3. **Slide 2's third force, and slides 9 and 10, are placeholders.** The
   platform view and platform economics pages are exactly where the operating
   model this build produces would go — `/economics` and `/` are the live
   versions of those two slides.

Slide 8's Saudi high-skill jobs line is the one impact metric this record cannot
evidence; headcount lives in payroll. It reports as *not instrumented* rather
than as an estimate.

## The demonstration network

`run_bth.py seed` builds 134 physicians across the focus areas (26 Saudi, the
fellowship pipeline over-weighted the way the checkpoints require), 10
institutions including the Cairo eye hospital and the Karachi digital hospital
the deck names, 10 buyer accounts, 20 opportunities — 14 from earlier cycles so
the index has resolved deals to calibrate against, 6 live — plus engagements,
disclosures, patent families, licenses, trials, data partnerships and Fund 1's
commitments. The named institutions are real; the physicians are synthetic.

Data is stored in `bth.db` (gitignored). Delete it and re-seed at any time.

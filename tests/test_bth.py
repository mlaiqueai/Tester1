"""Tests for the platform's rules — the splits, the gates and the index.

Run with: python3 -m unittest discover -s tests -v
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bth import config, consensus, db, economics, experts, kpi, pipeline  # noqa: E402

PASSING = {k: True for k in config.SCREEN_FACTORS}


class Base(unittest.TestCase):
    def setUp(self):
        self.conn = db.connect(":memory:")

    def opportunity(self, code="T-1", tile="green", focus="vascular"):
        return pipeline.create_opportunity(
            self.conn, code, "Test opportunity", tile, focus, "A blinded abstract.")

    def cohort(self, n, focus="vascular"):
        return [experts.add_expert(self.conn, f"Dr. Test {i}", "SA", focus, focus)
                for i in range(n)]


class TestEconomics(Base):
    def test_split_never_shortchanges_the_contributor(self):
        # 6500 bps of 999 cents is 649.35 — the remainder goes to the physician.
        party, platform = economics.split(999, 6500)
        self.assertEqual(party + platform, 999)
        self.assertEqual(platform, 349)
        self.assertEqual(party, 650)

    def test_physician_band_is_65_to_70(self):
        self.assertEqual(min(config.PHYSICIAN_SHARE_BPS.values()), 6500)
        self.assertEqual(max(config.PHYSICIAN_SHARE_BPS.values()), 7000)

    def test_inventor_share_depends_on_who_funded_the_patent(self):
        self.assertEqual(economics.inventor_share_bps(True), 3000)
        self.assertEqual(economics.inventor_share_bps(False), 5000)

    def test_engagement_posts_a_ledger_row(self):
        expert_id = self.cohort(1)[0]
        buyer = self.conn.execute(
            "INSERT INTO buyers (name, kind, country, paying) VALUES ('B','vc','AE',1)").lastrowid
        eng = self.conn.execute(
            "INSERT INTO engagements (buyer_id, kind, expert_id, fee_cents) VALUES (?,?,?,?)",
            (buyer, "consult", expert_id, 1_000_000)).lastrowid
        self.conn.commit()
        result = economics.post_engagement(self.conn, eng)
        self.assertEqual(result["party_cents"] + result["platform_cents"], 1_000_000)
        # An unproven expert sits in the C band: 65%.
        self.assertEqual(result["share_bps"], 6500)
        self.assertEqual(economics.expert_earnings(self.conn, expert_id)["paid_cents"], 650_000)

    def test_trial_revenue_leaves_65_percent_with_the_site(self):
        inst = self.conn.execute(
            "INSERT INTO institutions (name, country) VALUES ('Site','SA')").lastrowid
        buyer = self.conn.execute(
            "INSERT INTO buyers (name, kind, country) VALUES ('S','sponsor','US')").lastrowid
        trial = self.conn.execute(
            "INSERT INTO trials (site_institution_id, sponsor_buyer_id, protocol, revenue_cents)"
            " VALUES (?,?,'P',?)", (inst, buyer, 2_000_000)).lastrowid
        self.conn.commit()
        result = economics.post_trial(self.conn, trial)
        self.assertEqual(result["party_cents"], 1_300_000)
        self.assertEqual(result["platform_cents"], 700_000)


class TestScreening(Base):
    def test_off_thesis_fails_however_good_the_company_is(self):
        opp = pipeline.create_opportunity(
            self.conn, "T-OFF", "Biopharma asset", "green", "small_molecule", "abstract")
        result = pipeline.screen(self.conn, opp, PASSING)
        self.assertEqual(result["verdict"], "fail")
        self.assertFalse(result["factors"]["thesis_fit"])

    def test_screen_requires_every_factor(self):
        opp = self.opportunity()
        with self.assertRaises(ValueError):
            pipeline.screen(self.conn, opp, {"team": True})


class TestGates(Base):
    def test_yellow_is_not_a_decision(self):
        opp = self.opportunity()
        pipeline.screen(self.conn, opp, PASSING)
        with self.assertRaises(ValueError):
            pipeline.gate(self.conn, opp, "yellow", "unsure", "IC")

    def test_gate_cannot_be_called_before_the_work_is_done(self):
        opp = self.opportunity()
        with self.assertRaises(pipeline.GateNotReady):
            pipeline.gate(self.conn, opp, "green", "looks good", "IC")

    def test_a_failed_screen_cannot_be_waved_through(self):
        opp = self.opportunity()
        pipeline.screen(self.conn, opp, {**PASSING, "financing": False})
        with self.assertRaises(pipeline.GateRefused):
            pipeline.gate(self.conn, opp, "green", "we like the team anyway", "IC")
        # Red is always available.
        result = pipeline.gate(self.conn, opp, "red", "screen failed on financing", "IC")
        self.assertEqual(result["status"], "stopped")

    def test_negative_sentiment_cannot_advance(self):
        opp = self.opportunity()
        pipeline.screen(self.conn, opp, PASSING)
        pipeline.gate(self.conn, opp, "green", "clean screen", "IC")
        cohort = self.cohort(12)
        experts.route(self.conn, opp)
        routings = self.conn.execute(
            "SELECT * FROM routings WHERE opportunity_id=?", (opp,)).fetchall()
        for r in routings:
            consensus.submit(self.conn, r["id"], 2, 2, 2, 2, 2, "no")
        read = consensus.read(self.conn, opp)
        self.assertTrue(read["quorum"])
        self.assertEqual(read["signal"], "negative")
        with self.assertRaises(pipeline.GateRefused):
            pipeline.gate(self.conn, opp, "green", "gut says yes", "IC")
        self.assertEqual(len(cohort), 12)

    def test_company_touch_cap_is_enforced(self):
        opp = self.opportunity()
        for _ in range(config.MAX_COMPANY_TOUCHES):
            pipeline.record_interview(self.conn, opp, "company")
        with self.assertRaises(pipeline.GateRefused):
            pipeline.record_interview(self.conn, opp, "company")

    def test_deep_diligence_blocker_stops_a_green(self):
        opp = self.opportunity()
        self.conn.execute("UPDATE opportunities SET stage=3 WHERE id=?", (opp,))
        for area in config.DEEP_DILIGENCE_AREAS:
            pipeline.file_packet(self.conn, opp, area, "clear")
        pipeline.file_packet(self.conn, opp, "investment", "blocker",
                             notes="priced ahead of exit comps")
        with self.assertRaises(pipeline.GateRefused):
            pipeline.gate(self.conn, opp, "green", "close enough", "IC")


class TestCohortAndConsensus(Base):
    def test_routing_invites_the_whole_matched_cohort_and_is_idempotent(self):
        self.cohort(6)
        self.cohort(4, focus="oncology")
        opp = self.opportunity()
        first = experts.route(self.conn, opp)
        second = experts.route(self.conn, opp)
        self.assertEqual(len(first), 6)
        self.assertEqual(len(second), 6)
        invited = self.conn.execute(
            "SELECT COUNT(*) c FROM routings WHERE opportunity_id=?", (opp,)).fetchone()["c"]
        self.assertEqual(invited, 6)

    def test_cohort_sees_a_blinded_abstract_until_consent_is_recorded(self):
        opp = self.opportunity()
        payload = experts.cohort_payload(self.conn, opp)
        self.assertTrue(payload["blinded"])
        self.assertNotIn("Test opportunity", payload["name"])
        self.conn.execute("UPDATE opportunities SET consent_to_disclose=1 WHERE id=?", (opp,))
        self.assertFalse(experts.cohort_payload(self.conn, opp)["blinded"])

    def test_thin_response_is_inconclusive_not_a_weak_yes(self):
        self.cohort(20)
        opp = self.opportunity()
        experts.route(self.conn, opp)
        routings = self.conn.execute(
            "SELECT * FROM routings WHERE opportunity_id=?", (opp,)).fetchall()
        for r in routings[:3]:
            consensus.submit(self.conn, r["id"], 5, 5, 5, 5, 5, "strong yes")
        read = consensus.read(self.conn, opp)
        self.assertFalse(read["quorum"])
        self.assertEqual(read["signal"], "inconclusive")

    def test_a_split_cohort_never_reads_positive(self):
        self.cohort(12)
        opp = self.opportunity()
        experts.route(self.conn, opp)
        routings = self.conn.execute(
            "SELECT * FROM routings WHERE opportunity_id=?", (opp,)).fetchall()
        for i, r in enumerate(routings):
            score = 5 if i % 2 else 1
            consensus.submit(self.conn, r["id"], score, score, score, score, score, "x")
        read = consensus.read(self.conn, opp)
        self.assertEqual(read["signal"], "split")

    def test_scores_must_be_one_to_five(self):
        self.cohort(1)
        opp = self.opportunity()
        experts.route(self.conn, opp)
        routing = self.conn.execute(
            "SELECT id FROM routings WHERE opportunity_id=?", (opp,)).fetchone()["id"]
        with self.assertRaises(ValueError):
            consensus.submit(self.conn, routing, 7, 3, 3, 3, 3)


class TestExpertIndex(Base):
    def test_one_sharp_read_does_not_buy_a_tier(self):
        expert_id = self.cohort(1)[0]
        opp = self.opportunity()
        experts.route(self.conn, opp)
        routing = self.conn.execute(
            "SELECT id FROM routings WHERE opportunity_id=?", (opp,)).fetchone()["id"]
        consensus.submit(self.conn, routing, 5, 5, 5, 5, 5, "x" * 120)
        self.assertNotEqual(experts.expert_tier(self.conn, expert_id), "A")

    def test_index_rises_with_a_track_record(self):
        expert_id = self.cohort(1)[0]
        scores = []
        for i in range(10):
            opp = self.opportunity(code=f"T-{i}")
            experts.route(self.conn, opp)
            routing = self.conn.execute(
                "SELECT id FROM routings WHERE opportunity_id=?", (opp,)).fetchone()["id"]
            consensus.submit(self.conn, routing, 5, 5, 5, 5, 5, "y" * 120)
            scores.append(experts.expert_index(self.conn, expert_id)["score"])
        self.assertLess(scores[0], scores[-1])
        self.assertEqual(experts.expert_tier(self.conn, expert_id), "A")

    def test_silence_costs_responsiveness(self):
        expert_id = self.cohort(1)[0]
        for i in range(5):
            experts.route(self.conn, self.opportunity(code=f"S-{i}"))
        self.assertEqual(experts.expert_index(self.conn, expert_id)["responsiveness"], 0.0)


class TestKpi(Base):
    def test_checkpoints_report_against_the_2028_tranche(self):
        for _ in range(9):
            self.conn.execute(
                "INSERT INTO institutions (name, country, anchor_partner) VALUES (?,?,1)",
                (f"Anchor {_}", "SA"))
        self.conn.commit()
        row = next(c for c in kpi.checkpoint_metrics(self.conn)
                   if c["key"] == "anchor_partnerships")
        self.assertEqual(row["value"], 9)
        self.assertEqual(row["status"], "met")

    def test_uninstrumented_impact_lines_are_flagged_not_estimated(self):
        jobs = next(l for l in kpi.kingdom_impact(self.conn)["lines"] if l["key"] == "saudi_jobs")
        self.assertFalse(jobs["instrumented"])
        self.assertIsNone(jobs["value"])


class TestWeb(unittest.TestCase):
    """The console renders from a seeded database."""

    @classmethod
    def setUpClass(cls):
        from bth import seed, web
        cls.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        cls.tmp.close()
        db.DEFAULT_PATH = cls.tmp.name
        seed.build(cls.tmp.name)
        cls.web = web

    @classmethod
    def tearDownClass(cls):
        os.unlink(cls.tmp.name)

    def get(self, path):
        captured = {}

        def start_response(status, headers):
            captured["status"], captured["headers"] = status, headers
        body = b"".join(self.web.application(
            {"PATH_INFO": path, "REQUEST_METHOD": "GET", "QUERY_STRING": ""}, start_response))
        return captured["status"], body.decode()

    def test_every_page_renders(self):
        for path in ("/", "/board", "/experts", "/economics", "/network", "/fund",
                     "/opportunity/1", "/expert/1"):
            status, body = self.get(path)
            self.assertEqual(status, "200 OK", path)
            self.assertIn("Brain Trust Holdings", body)

    def test_api_returns_json(self):
        import json
        status, body = self.get("/api/dashboard")
        self.assertEqual(status, "200 OK")
        payload = json.loads(body)
        self.assertIn("checkpoints", payload)
        self.assertEqual(len(payload["checkpoints"]), len(config.CHECKPOINTS))

    def test_unknown_page_is_404(self):
        status, _ = self.get("/nope")
        self.assertEqual(status, "404 Not Found")


if __name__ == "__main__":
    unittest.main()

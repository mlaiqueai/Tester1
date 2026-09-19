#!/usr/bin/env python3
"""Brain Trust Holdings — command line entry point.

    python3 run_bth.py seed          # build a demonstration network
    python3 run_bth.py serve [port]  # run the console on http://127.0.0.1:8000
    python3 run_bth.py dashboard     # checkpoints, ledger and fund, as text
    python3 run_bth.py board         # the pipeline and what each deal waits on
    python3 run_bth.py experts [n]   # the index leaderboard
"""

import sys

from bth import db, economics, experts, kpi, pipeline, seed
from bth.views import money, usd


def cmd_seed(_args):
    seed.build()
    print(f"seeded {db.DEFAULT_PATH}")


def cmd_serve(args):
    from bth.web import serve
    serve(port=int(args[0]) if args else 8000)


def cmd_dashboard(_args):
    conn = db.connect()
    data = kpi.dashboard(conn)
    print("CHECKPOINTS")
    for c in data["checkpoints"]:
        print(f"  {c['label']:<42} {c['value']:>6} / {c['target_2028']:<6} "
              f"{c['target_2030']:<6} {c['status']}")
    total = data["ledger"]["total"]
    print("\nLEDGER")
    for line in data["ledger"]["lines"]:
        print(f"  {line['source_kind']:<12} {line['n']:>3} postings  gross {money(line['gross']):>9}"
              f"  paid {money(line['paid']):>9}  retained {money(line['retained']):>9}")
    print(f"  {'total':<12} {total['n']:>3} postings  gross {money(total['gross']):>9}"
          f"  paid {money(total['paid']):>9}  retained {money(total['retained']):>9}"
          f"  ({total['retention_pct']}%)")
    fund = data["fund"]
    print("\nFUND")
    print(f"  committed {usd(fund['committed_usd'])} of {usd(fund['fund1_target_usd'])} target;"
          f" anchor {usd(fund['anchor_usd'])} ({fund['anchor_pct']}%)")
    print(f"  deployed {usd(fund['deployed_usd'])} plus {usd(fund['coinvest_usd'])} co-invest;"
          f" into KSA {usd(fund['capital_into_ksa_usd'])}"
          f" ({fund['capital_into_ksa_pct']}% of target)")


def cmd_board(_args):
    conn = db.connect()
    for o in pipeline.board(conn):
        if o["blockers"]:
            blockers = "; ".join(o["blockers"])
        elif o["status"] != "active":
            blockers = ""
        elif o.get("only_decision_available") == "red":
            blockers = "decidable — evidence only supports a red"
        else:
            blockers = "ready for the IC"
        print(f"  {o['code']:<9} {o['tile']:<7} stage {o['stage']} {o['status']:<9} "
              f"{o['name'][:44]:<46} {blockers}")


def cmd_experts(args):
    conn = db.connect()
    limit = int(args[0]) if args else 15
    for e in experts.leaderboard(conn, limit):
        earned = economics.expert_earnings(conn, e["id"])["paid_cents"]
        print(f"  {e['name']:<26} {e['country']:<3} {e['specialty']:<14} tier {e['tier']} "
              f"index {e['score']:>5}  reads {e['responses']}/{e['invitations']:<3} "
              f"calib {e['calibration']:>5}%  earned {money(earned):>8}")


COMMANDS = {"seed": cmd_seed, "serve": cmd_serve, "dashboard": cmd_dashboard,
            "board": cmd_board, "experts": cmd_experts}

if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "dashboard"
    if name not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[name](sys.argv[2:])

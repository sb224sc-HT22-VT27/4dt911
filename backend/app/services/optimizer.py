"""Team evaluation and best-team search (5 drivers + 2 constructors, best driver = DRS)."""
from bisect import bisect_right
from itertools import combinations, zip_longest

from app.schemas.planner import RISKS, EvaluateRequest, OptimizeRequest
from app.services import data_store, scoring

SWAP_PENALTY = 10


def evaluate(req: EvaluateRequest) -> dict:
    P = data_store.players()
    ids = req.drivers + req.constructors
    unknown = [i for i in ids if i not in P]
    if unknown:
        raise ValueError(f"Unknown player ids: {unknown}")
    rows = {r.id: r for r in scoring.all_rows(req)}
    tot = {k: sum(getattr(rows[i], k) for i in ids if i in rows) for k in RISKS}
    drs = req.drs if req.drs in req.drivers else None
    if drs in rows:
        for k in RISKS:
            tot[k] += getattr(rows[drs], k)
    return {"cost": round(sum(P[i].price for i in ids), 1),
            **{k: round(v, 1) for k, v in tot.items()}, "drs": drs}


def best_team(req: OptimizeRequest) -> dict | None:
    P = data_store.players()
    rows = {r.id: r for r in scoring.all_rows(req)}
    cur = req.currentTeam
    cur_d = list(cur.drivers) if cur else []
    cur_c = list(cur.constructors) if cur else []

    def val(pid: str) -> float:
        return getattr(rows[pid], req.risk) if pid in rows else 0.0

    def pool(kind: str, current: list[str]):
        return [(p.id, round(p.price * 10), val(p.id)) for p in P.values()
                if p.kind == kind and (p.id in rows or p.id in current)]

    drivers, cons = pool("driver", cur_d), pool("constructor", cur_c)
    budget = round(req.budget * 10)  # tenths of a million, avoids float drift

    # constructor pairs, grouped by how many current constructors they swap out;
    # per group: costs ascending + best points among pairs up to that cost
    cset = set(cur_c)
    raw: dict[int, list] = {}
    for a, b in combinations(cons, 2):
        raw.setdefault(len(cset - {a[0], b[0]}), []).append((a[1] + b[1], a[2] + b[2], (a[0], b[0])))
    groups = {}
    for out_c, items in raw.items():
        items.sort(key=lambda t: t[0])
        costs, bests, run = [], [], None
        for cost, pts, ids in items:
            if run is None or pts > run[0]:
                run = (pts, ids)
            costs.append(cost)
            bests.append(run)
        groups[out_c] = (costs, bests)

    dset, free, cap = set(cur_d), req.freeTransfers, req.maxTransfers
    best = None
    for combo in combinations(drivers, 5):
        dcost = sum(d[1] for d in combo)
        if dcost > budget:
            continue
        vals = [d[2] for d in combo]
        dpts = sum(vals) + max(vals)  # DRS: best driver counts double
        out_d = len(dset - {d[0] for d in combo})
        for out_c, (costs, bests) in groups.items():
            i = bisect_right(costs, budget - dcost) - 1
            if i < 0:
                continue
            swaps = out_d + out_c
            if cap is not None and swaps > cap:
                continue
            pen = SWAP_PENALTY * max(0, swaps - free) if cur else 0
            cpts, pair = bests[i]
            total = dpts + cpts - pen
            if best is None or total > best[0]:
                best = (total, [d[0] for d in combo], list(pair), pen)
    if best is None:
        return None

    total, new_d, new_c, pen = best
    result = {"drivers": new_d, "constructors": new_c,
              "drs": max(new_d, key=val), "points": round(total, 1)}
    if cur:
        cur_pts = sum(val(i) for i in cur_d + cur_c) + (max(val(i) for i in cur_d) if cur_d else 0)
        transfers = []
        for kind, old, new in (("driver", cur_d, new_d), ("constructor", cur_c, new_c)):
            outs = [i for i in old if i not in new]
            ins = [i for i in new if i not in old]
            transfers += [{"kind": kind, "out": o, "in": i} for o, i in zip_longest(outs, ins)]
        result |= {"currentPoints": round(cur_pts, 1), "penaltyPoints": pen, "transfers": transfers}
    return result
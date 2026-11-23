// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { TeamPanel } from './components/TeamPanel/TeamPanel';
import { BudgetPill } from './components/TeamPanel/BudgetPill';
import { DriverInfoPanel } from './components/F1Card/DriverInfoPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel/AnalyticsPanel';
import { TeamSummary } from './components/SidePanels/TeamSummary';
import { TransfersModal } from './components/TeamPanel/TransfersModal';
import { SavedSlots } from './components/SidePanels/SavedSlots';
import { GuideTour } from './components/Guide/GuideTour';
import { RulesModal } from './components/Info/RulesModal';
import { PredictorModal } from './components/Info/PredictorModal';
import { ComparisonPanel } from './components/SidePanels/ComparisonPanel';
import { SettingsPanel } from './components/SidePanels/SettingsPanel';
import { RaceSelect } from './components/Header/RaceSelect';
import { PickerModal } from './components/TeamPanel/PickerModal';
import {
  evaluateTeam,
  fetchConstructors,
  fetchDrivers,
  fetchPredictions,
  fetchPredictionsByRound,
  fetchStats,
  fetchTeammates,
  fetchUpcomingRaces,
  GRID_AVERAGE_ID,
  optimizeTeam,
  toCards,
} from './api/fantasyApi';
import {
  DEFAULT_PARAMS,
  RISK_LABELS,
  type CardItem,
  type Constructor,
  type Driver,
  type DriverInfo,
  type Horizon,
  type ItemKind,
  type OptimizeResult,
  type OptimizerMode,
  type PlayerLink,
  type Params,
  type PlayerStats,
  type Prediction,
  type Race,
  type RoundPoints,
  type SavedTeam,
  type TransferPlans,
  type TeammateStats,
  type TeamEvaluation,
} from './types/f1';

const ids = (list: (string | null)[]) => list.filter(Boolean) as string[];
const EMPTY_DRIVERS: (string | null)[] = [null, null, null, null, null];
const EMPTY_CONSTRUCTORS: (string | null)[] = [null, null];

// The guide opens by itself the first time someone visits
const GUIDE_KEY = 'optigrid-guide-seen';
const guideSeen = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === 'yes';
  } catch {
    return true;
  }
};

// Saved teams live in the browser for now
const SLOTS_KEY = 'f1-saved-teams';
const loadSlots = (): (SavedTeam | null)[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? 'null');
    if (Array.isArray(saved) && saved.length === 3) return saved;
  } catch {
    // storage unavailable or corrupt, start empty
  }
  return [null, null, null];
};

function App() {
  const [races, setRaces] = useState<Race[]>([]);
  const [round, setRound] = useState('');
  const [rosterDrivers, setRosterDrivers] = useState<Driver[]>([]);
  const [rosterConstructors, setRosterConstructors] = useState<Constructor[]>([]);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [driverStats, setDriverStats] = useState<PlayerStats[]>([]);
  const [constructorStats, setConstructorStats] = useState<PlayerStats[]>([]);
  const [teammates, setTeammates] = useState<TeammateStats[]>([]);
  const [evaluation, setEvaluation] = useState<TeamEvaluation | null>(null);
  const [plannerData, setPlannerData] = useState<RoundPoints[]>([]);
  const [plannerCount, setPlannerCount] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const [driverIds, setDriverIds] = useState<(string | null)[]>(EMPTY_DRIVERS);
  const [constructorIds, setConstructorIds] = useState<(string | null)[]>(EMPTY_CONSTRUCTORS);
  const [drsId, setDrsId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [replace, setReplace] = useState<{ kind: ItemKind; slot: number; outId: string; candidateId: string | null } | null>(null);
  const [replaceListOpen, setReplaceListOpen] = useState(false);
  const [candidateEval, setCandidateEval] = useState<{ key: string; evaluation: TeamEvaluation } | null>(null);
  const [budget, setBudget] = useState(100);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [horizon, setHorizon] = useState<Horizon>(1);
  const [slots, setSlots] = useState<(SavedTeam | null)[]>(loadSlots);
  const [slotEvaluations, setSlotEvaluations] = useState<(TeamEvaluation | null)[]>([null, null, null]);
  const [optimizerMode, setOptimizerMode] = useState<OptimizerMode>('best');
  const [freeTransfers, setFreeTransfers] = useState(2);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [transferPlans, setTransferPlans] = useState<TransferPlans | null>(null);
  const hasAutoPicked = useRef(false);
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen());
  const [infoOpen, setInfoOpen] = useState<'rules' | 'predictor' | null>(null);

  const closeGuide = () => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_KEY, 'yes');
    } catch {
      // storage unavailable, the guide just shows again next visit
    }
  };

  // The selected race plus the next ones when planning 3 races ahead
  const rounds = useMemo(() => {
    const start = races.findIndex((r) => r.round === round);
    return start < 0 ? [] : races.slice(start, start + horizon).map((r) => r.round);
  }, [races, round, horizon]);
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error');

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchConstructors(), fetchUpcomingRaces(), fetchTeammates()])
      .then(([d, c, r, t]) => {
        setRosterDrivers(d);
        setRosterConstructors(c);
        setRaces(r);
        setTeammates(t);
        setRound(r[0].round);
      })
      .catch(fail);
  }, []);

  useEffect(() => {
    if (!round) return;
    Promise.all([fetchStats('driver', round), fetchStats('constructor', round)])
      .then(([d, c]) => {
        setDriverStats(d);
        setConstructorStats(c);
      })
      .catch(fail);
  }, [round]);

  useEffect(() => {
    if (!rounds.length) return;
    let active = true;
    fetchPredictions(rounds, params)
      .then((p) => active && setPredictions(p))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [rounds, params]);

  // The race planner looks 1-10 races ahead from the selected race
  const plannerStart = races.findIndex((r) => r.round === round);
  const plannerMax = plannerStart < 0 ? 0 : races.length - plannerStart;
  const plannerRaces = useMemo(
    () => (plannerStart < 0 ? [] : races.slice(plannerStart, plannerStart + plannerCount)),
    [races, plannerStart, plannerCount]
  );

  useEffect(() => {
    if (!plannerRaces.length) return;
    let active = true;
    fetchPredictionsByRound(
      plannerRaces.map((r) => r.round),
      params
    )
      .then((d) => active && setPlannerData(d))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [plannerRaces, params]);

  const allDrivers = useMemo(
    () => toCards(rosterDrivers, 'driver', predictions ?? [], driverStats),
    [rosterDrivers, predictions, driverStats]
  );
  const allConstructors = useMemo(
    () => toCards(rosterConstructors, 'constructor', predictions ?? [], constructorStats),
    [rosterConstructors, predictions, constructorStats]
  );

  const driverInfo = useMemo(() => {
    const ratings = new Map(driverStats.map((s) => [s.id, s.ratings]));
    return new Map<string, DriverInfo>(rosterDrivers.map((d) => [d.id, { name: d.name, ratings: ratings.get(d.id) }]));
  }, [rosterDrivers, driverStats]);

  const drivers = driverIds.map((id) => allDrivers.find((d) => d.id === id) ?? null);
  const constructors = constructorIds.map((id) => allConstructors.find((c) => c.id === id) ?? null);
  const team = [...drivers, ...constructors].filter(Boolean) as CardItem[];
  // The selected player (any player, not only team members), or the first driver by default
  const everyone = useMemo(() => [...allDrivers, ...allConstructors], [allDrivers, allConstructors]);
  const selected = everyone.find((i) => i.id === selectedId) ?? drivers.find(Boolean) ?? team[0];
  // The comparison target only counts when it is the same kind as the selected player
  const compared = everyone.find((i) => i.id === compareId);
  const activeCompareId =
    compareId === GRID_AVERAGE_ID || (compared && selected && compared.kind === selected.kind && compared.id !== selected.id)
      ? compareId
      : null;
  const remainingBudget = Number((budget - team.reduce((sum, i) => sum + i.price, 0)).toFixed(1));

  // Replace mode ends by itself when the player going out is no longer in that slot
  const slotIds = replace?.kind === 'driver' ? driverIds : constructorIds;
  const replacing = replace && slotIds[replace.slot] === replace.outId ? replace : null;
  const outItem = replacing ? everyone.find((i) => i.id === replacing.outId) : undefined;
  const isEligible = (i: CardItem) =>
    !!replacing &&
    !!outItem &&
    i.kind === replacing.kind &&
    !team.some((t) => t.id === i.id) &&
    i.price <= Number((remainingBudget + outItem.price).toFixed(1));
  const candidate = replacing ? everyone.find((i) => i.id === replacing.candidateId && isEligible(i)) : undefined;
  const hoverCandidate = replacing ? everyone.find((i) => i.id === hoverId && isEligible(i)) : undefined;
  const endReplace = () => {
    setReplace(null);
    setReplaceListOpen(false);
  };

  const link: PlayerLink = {
    selectedId: outItem?.id ?? selected?.id ?? null,
    compareId: replacing ? candidate?.id ?? activeCompareId : activeCompareId,
    hoverId,
    replacing: !!replacing,
    fade: (id) => {
      const item = everyone.find((i) => i.id === id);
      return !!replacing && !!item && id !== replacing.outId && !isEligible(item);
    },
    onPick: (id, e) => {
      if (replacing) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) setCompareId(id);
        else if (everyone.some((i) => i.id === id && isEligible(i))) setReplace({ ...replacing, candidateId: id });
        return;
      }
      if ((e.ctrlKey || e.metaKey || e.shiftKey) && id !== selected?.id) setCompareId(id);
      else setSelectedId(id);
    },
    onHover: setHoverId,
  };
  const race = races.find((r) => r.round === round);

  // The team with the candidate swapped in, DRS stays on the slot when a driver replaces the DRS driver
  const swapIn = (list: (string | null)[]) => list.map((id) => (id === replacing?.outId ? candidate!.id : id));
  const newDriverIds = candidate && replacing?.kind === 'driver' ? swapIn(driverIds) : driverIds;
  const newConstructorIds = candidate && replacing?.kind === 'constructor' ? swapIn(constructorIds) : constructorIds;
  const newDrsId = candidate && drsId === replacing?.outId ? (replacing.kind === 'driver' ? candidate.id : null) : drsId;
  const newTeam = candidate ? [...newDriverIds, ...newConstructorIds].map((id) => everyone.find((i) => i.id === id)).filter(Boolean) as CardItem[] : team;
  const candidateKey = candidate ? JSON.stringify([newDriverIds, newConstructorIds, newDrsId, rounds, params]) : '';
  const newEvaluation = candidate && candidateEval?.key === candidateKey ? candidateEval.evaluation : null;

  useEffect(() => {
    if (!candidateKey) return;
    let active = true;
    const [d, c, drs, r, p] = JSON.parse(candidateKey);
    evaluateTeam(ids(d), ids(c), drs, r, p)
      .then((e) => active && setCandidateEval({ key: candidateKey, evaluation: e }))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [candidateKey]);

  const confirmSwap = () => {
    if (!replacing || !candidate) return;
    setSlot(replacing.kind, replacing.slot, candidate.id);
    setDrsId(newDrsId);
    setSelectedId(candidate.id);
    endReplace();
  };

  useEffect(() => {
    if (!replace) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setReplace(null);
      setReplaceListOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replace]);

  useEffect(() => {
    if (!rounds.length) return;
    let active = true;
    evaluateTeam(ids(driverIds), ids(constructorIds), drsId, rounds, params)
      .then((e) => active && setEvaluation(e))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [driverIds, constructorIds, drsId, rounds, params]);

  // Points for the saved teams with the current settings
  useEffect(() => {
    if (!rounds.length) return;
    let active = true;
    Promise.all(
      slots.map((s) => (s ? evaluateTeam(ids(s.drivers), ids(s.constructors), s.drs, rounds, params) : null))
    )
      .then((e) => active && setSlotEvaluations(e))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [slots, rounds, params]);

  const currentTeamKey = JSON.stringify([driverIds, constructorIds, drsId]);
  const activeSlot = slots.findIndex((s) => s && JSON.stringify([s.drivers, s.constructors, s.drs]) === currentTeamKey);

  const saveSlot = (slot: number) => {
    const next = slots.map((s, i) => (i === slot ? { drivers: driverIds, constructors: constructorIds, drs: drsId } : s));
    setSlots(next);
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable, the slot still works until reload
    }
  };

  const loadSlot = (slot: number) => {
    const saved = slots[slot];
    if (!saved) return;
    setDriverIds(saved.drivers);
    setConstructorIds(saved.constructors);
    setDrsId(saved.drs);
  };

  const deleteSlot = (slot: number) => {
    const next = slots.map((s, i) => (i === slot ? null : s));
    setSlots(next);
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable, the slot is still cleared until reload
    }
  };

  const clearTeam = () => {
    setDriverIds(EMPTY_DRIVERS);
    setConstructorIds(EMPTY_CONSTRUCTORS);
    setDrsId(null);
  };

  const optimize = async (): Promise<string> => {
    try {
      if (optimizerMode === 'transfers') {
        setTransfersOpen(true);
        return '';
      }
      const result = await optimizeTeam(budget, rounds, params);
      setDriverIds(result.drivers);
      setConstructorIds(result.constructors);
      setDrsId(result.drs);
      return `Optimized for ${RISK_LABELS[params.risk].toLowerCase()}: ${result.points} pts`;
    } catch {
      return `No team fits under €${budget}M`;
    }
  };

  // Start with an optimized team the first time predictions arrive
  useEffect(() => {
    if (!hasAutoPicked.current && predictions && rosterDrivers.length) {
      hasAutoPicked.current = true;
      optimize();
    }
  });

  // Swap the suggested players into the same slots, new players fill empty slots
  const applyTransfers = (result: OptimizeResult) => {
    const swap = (slots: (string | null)[], kind: ItemKind) => {
      const moves = (result.transfers ?? []).filter((t) => t.kind === kind);
      const fills = moves.filter((t) => !t.out).map((t) => t.in);
      return slots.map((id) => (id === null ? fills.shift() ?? null : moves.find((t) => t.out === id)?.in ?? id));
    };
    setDriverIds(swap(driverIds, 'driver'));
    setConstructorIds(swap(constructorIds, 'constructor'));
    setDrsId(result.drs);
    setTransfersOpen(false);
  };

  // While the transfers popup is open: the best plan with extra transfers (−10 each)
  // and the best plan using only the free transfers, so the popup can compare them
  useEffect(() => {
    if (!transfersOpen || !rounds.length) return;
    let active = true;
    const settings = {
      currentTeam: { drivers: ids(driverIds), constructors: ids(constructorIds) },
      freeTransfers,
    };
    Promise.all([
      optimizeTeam(budget, rounds, params, settings).catch(() => null),
      optimizeTeam(budget, rounds, params, { ...settings, maxTransfers: freeTransfers }).catch(() => null),
    ]).then(([best, freeOnly]) => active && setTransferPlans({ free: freeTransfers, best, freeOnly }));
    return () => {
      active = false;
    };
  }, [transfersOpen, freeTransfers, driverIds, constructorIds, rounds, params, budget]);

  const setSlot = (kind: CardItem['kind'], slot: number, id: string | null) => {
    const setter = kind === 'driver' ? setDriverIds : setConstructorIds;
    setter((prev) => prev.map((current, i) => (i === slot ? id : current)));
  };

  const removeFromTeam = (id: string) => {
    setDriverIds((prev) => prev.map((d) => (d === id ? null : d)));
    setConstructorIds((prev) => prev.map((c) => (c === id ? null : c)));
    setDrsId((prev) => (prev === id ? null : prev));
  };

  // Returns why an item can't be added, or null if it can
  const addBlocker = (item: CardItem): string | null => {
    const ids = item.kind === 'driver' ? driverIds : constructorIds;
    if (ids.includes(item.id)) return 'In team';
    if (!ids.includes(null)) return item.kind === 'driver' ? 'Driver slots full' : 'Constructor slots full';
    if (item.price > remainingBudget) return 'Over budget';
    return null;
  };

  const addToTeam = (item: CardItem) => {
    if (addBlocker(item)) return;
    const ids = item.kind === 'driver' ? driverIds : constructorIds;
    setSlot(item.kind, ids.indexOf(null), item.id);
  };

  if (error || !race || !predictions) {
    return (
      <div className="app-status">
        {error ? (
          <>
            <p className="status-error">{error}</p>
            <p className="status-hint">
              Start the backend on port 8000.
            </p>
            <button type="button" className="status-retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </>
        ) : (
          <p className="status-loading">Loading F1 Fantasy data…</p>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" />
          <h1>OptiGrid</h1>
        </div>
        <RaceSelect races={races} selectedRound={round} rounds={rounds} onSelect={(r) => { endReplace(); setRound(r); }} />
        <div className="header-actions">
          <button type="button" className="header-link" onClick={() => setInfoOpen('rules')}>
            F1 Fantasy rules
          </button>
          <button type="button" className="header-link" onClick={() => setInfoOpen('predictor')}>
            How predictions work
          </button>
          <button type="button" className="guide-btn" onClick={() => setGuideOpen(true)}>
            <span>?</span> Guide
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="grid-col col-left">
          <section className="panel panel-saved">
            <SavedSlots
              slots={slots}
              evaluations={slotEvaluations}
              activeSlot={activeSlot >= 0 ? activeSlot : null}
              risk={params.risk}
              onSave={saveSlot}
              onLoad={loadSlot}
              onDelete={deleteSlot}
            />
          </section>
          <section className="panel panel-team">
            <TeamPanel
              budgetRow={
                <div className="team-budget-row">
                  <BudgetPill totalBudget={budget} remainingBudget={remainingBudget} onBudgetChange={setBudget} />
                  <button type="button" className="clear-team-btn" onClick={clearTeam}>
                    Clear team
                  </button>
                </div>
              }
              drivers={drivers}
              constructors={constructors}
              allDrivers={allDrivers}
              allConstructors={allConstructors}
              remainingBudget={remainingBudget}
              params={params}
              drsId={drsId}
              link={link}
              replacingOutId={replacing?.outId ?? null}
              candidate={candidate ?? null}
              onReplace={(kind, slot, outId) => {
                setReplace({ kind, slot, outId, candidateId: null });
                setSelectedId(outId);
              }}
              onToggleDrs={(id) => setDrsId((prev) => (prev === id ? null : id))}
              onSelect={(kind, slot, item) => setSlot(kind, slot, item.id)}
              onRemove={removeFromTeam}
            />
          </section>
          <section className="panel panel-settings">
            <SettingsPanel
              params={params}
              trackType={race.trackType}
              horizon={horizon}
              optimizerMode={optimizerMode}
              onChange={(p) => { endReplace(); setParams(p); }}
              onHorizonChange={(h) => { endReplace(); setHorizon(h); }}
              onModeChange={setOptimizerMode}
              onOptimize={optimize}
            />
          </section>
        </div>

        <div className="grid-col col-main">
          {replacing && outItem && (
            <div className="replace-bar">
              <span className="replace-text">
                {candidate ? (
                  <>
                    Swapping <strong>{outItem.name}</strong> (€{outItem.price}M) → <strong>{candidate.name}</strong> (€{candidate.price}M)
                  </>
                ) : (
                  <>
                    Replacing <strong>{outItem.name}</strong> (€{outItem.price}M) — pick a {replacing.kind} from the chart, the planner or the list
                  </>
                )}
              </span>
              <button type="button" className="replace-btn" onClick={() => setReplaceListOpen(true)}>
                Pick from list
              </button>
              {candidate && (
                <button type="button" className="replace-btn confirm" onClick={confirmSwap}>
                  Confirm swap
                </button>
              )}
              <button type="button" className="replace-btn" onClick={endReplace}>
                Cancel
              </button>
            </div>
          )}
          <section className="panel panel-helper">
            <AnalyticsPanel
              team={team}
              link={link}
              allDrivers={allDrivers}
              allConstructors={allConstructors}
              plannerRaces={plannerRaces}
              plannerCount={plannerCount}
              plannerMax={plannerMax}
              onPlannerCountChange={setPlannerCount}
              plannerData={plannerData}
              risk={params.risk}
              addBlocker={addBlocker}
              onAdd={addToTeam}
            />
          </section>
          <section className="panel panel-comparison">
            <ComparisonPanel
              drivers={allDrivers}
              constructors={allConstructors}
              teamDrivers={drivers}
              teamConstructors={constructors}
              teammates={teammates}
              selectedId={link.selectedId}
              compareId={replacing ? hoverCandidate?.id ?? link.compareId : link.compareId}
              onSelect={setSelectedId}
              onCompare={setCompareId}
              driverStats={driverStats}
              constructorStats={constructorStats}
              driverInfo={driverInfo}
              race={race}
            />
          </section>
        </div>

        <div className="grid-col col-right">
          <section className="panel panel-info">
            <DriverInfoPanel
              item={selected}
              gridRatings={
                (selected?.kind === 'constructor' ? constructorStats : driverStats).find((s) => s.id === GRID_AVERAGE_ID)
                  ?.ratings
              }
              inTeam={!!selected && team.some((i) => i.id === selected.id)}
              blocker={selected && !replacing ? addBlocker(selected) : 'Swap in progress'}
              onAdd={addToTeam}
              onRemove={removeFromTeam}
            />
          </section>
          <section className="panel panel-summary">
            <TeamSummary
              team={newTeam}
              evaluation={newEvaluation ?? evaluation}
              baseEvaluation={candidate && newEvaluation ? evaluation : null}
              swapping={!!candidate}
              risk={params.risk}
              onConfirm={confirmSwap}
            />
          </section>
        </div>
      </div>

      {replacing && replaceListOpen && (
        <PickerModal
          type={replacing.kind}
          items={replacing.kind === 'driver' ? allDrivers : allConstructors}
          selectedIds={new Set(team.map((i) => i.id))}
          remainingBudget={Number((remainingBudget + (outItem?.price ?? 0)).toFixed(1))}
          risk={params.risk}
          onSelect={(item) => {
            setReplace({ ...replacing, candidateId: item.id });
            setReplaceListOpen(false);
          }}
          onClose={() => setReplaceListOpen(false)}
        />
      )}

      {guideOpen && <GuideTour onClose={closeGuide} />}
      {infoOpen === 'rules' && <RulesModal onClose={() => setInfoOpen(null)} />}
      {infoOpen === 'predictor' && <PredictorModal onClose={() => setInfoOpen(null)} />}

      {transfersOpen && (
        <TransfersModal
          freeTransfers={freeTransfers}
          plans={transferPlans}
          players={new Map([...allDrivers, ...allConstructors].map((p) => [p.id, p]))}
          risk={params.risk}
          onFreeTransfersChange={setFreeTransfers}
          onApply={applyTransfers}
          onClose={() => setTransfersOpen(false)}
        />
      )}
    </div>
  );
}

export default App;

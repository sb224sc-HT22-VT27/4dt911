// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { TeamPanel } from './components/TeamPanel/TeamPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel/AnalyticsPanel';
import { TeamSummary } from './components/SidePanels/TeamSummary';
import { TransfersModal } from './components/TeamPanel/TransfersModal';
import { SavedSlots } from './components/SidePanels/SavedSlots';
import { ComparisonPanel } from './components/SidePanels/ComparisonPanel';
import { SettingsPanel } from './components/SidePanels/SettingsPanel';
import { RaceSelect } from './components/Header/RaceSelect';
import {
  evaluateTeam,
  fetchConstructors,
  fetchDrivers,
  fetchPredictions,
  fetchPredictionsByRound,
  fetchStats,
  fetchTeammates,
  fetchUpcomingRaces,
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
  type Params,
  type PlayerStats,
  type Prediction,
  type Race,
  type RoundPoints,
  type SavedTeam,
  type TeammateStats,
  type TeamEvaluation,
} from './types/f1';

const ids = (list: (string | null)[]) => list.filter(Boolean) as string[];
const EMPTY_DRIVERS: (string | null)[] = [null, null, null, null, null];
const EMPTY_CONSTRUCTORS: (string | null)[] = [null, null];

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
  const [budget, setBudget] = useState(100);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [horizon, setHorizon] = useState<Horizon>(1);
  const [slots, setSlots] = useState<(SavedTeam | null)[]>(loadSlots);
  const [slotEvaluations, setSlotEvaluations] = useState<(TeamEvaluation | null)[]>([null, null, null]);
  const [optimizerMode, setOptimizerMode] = useState<OptimizerMode>('best');
  const [freeTransfers, setFreeTransfers] = useState(2);
  const [suggestion, setSuggestion] = useState<OptimizeResult | null>(null);
  const hasAutoPicked = useRef(false);

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
  const remainingBudget = Number((budget - team.reduce((sum, i) => sum + i.price, 0)).toFixed(1));
  const race = races.find((r) => r.round === round);

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

  const clearTeam = () => {
    setDriverIds(EMPTY_DRIVERS);
    setConstructorIds(EMPTY_CONSTRUCTORS);
    setDrsId(null);
  };

  const optimize = async (): Promise<string> => {
    try {
      if (optimizerMode === 'transfers') {
        const result = await optimizeTeam(budget, rounds, params, {
          currentTeam: { drivers: ids(driverIds), constructors: ids(constructorIds) },
          freeTransfers,
        });
        setSuggestion(result);
        const count = result.transfers?.length ?? 0;
        return count ? `${count} transfer${count > 1 ? 's' : ''} suggested` : 'No better transfers found';
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
    setSuggestion(null);
  };

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
              Start the backend on port 8000 and the mock API with <code>python3 frontend/mock_api/mock_server.py</code>.
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
        <RaceSelect races={races} selectedRound={round} rounds={rounds} onSelect={setRound} />
        <span />
      </header>

      <div className="dashboard-grid">
        <aside className="panel panel-comparison">
          <ComparisonPanel
            drivers={allDrivers}
            constructors={allConstructors}
            teamDrivers={drivers}
            teamConstructors={constructors}
            teammates={teammates}
            driverInfo={driverInfo}
            race={race}
          />
        </aside>

        <main className="panel panel-team">
          <TeamPanel
            drivers={drivers}
            constructors={constructors}
            allDrivers={allDrivers}
            allConstructors={allConstructors}
            budget={budget}
            remainingBudget={remainingBudget}
            onBudgetChange={setBudget}
            params={params}
            onClearTeam={clearTeam}
            drsId={drsId}
            onToggleDrs={(id) => setDrsId((prev) => (prev === id ? null : id))}
            onSelect={(kind, slot, item) => setSlot(kind, slot, item.id)}
            onRemove={removeFromTeam}
          />
        </main>

        <section className="panel panel-helper">
          <AnalyticsPanel
            team={team}
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
            onRemove={removeFromTeam}
          />
        </section>

        <div className="side-column">
          <section className="panel panel-settings">
            <SettingsPanel
              params={params}
              trackType={race.trackType}
              horizon={horizon}
              optimizerMode={optimizerMode}
              freeTransfers={freeTransfers}
              onChange={setParams}
              onHorizonChange={setHorizon}
              onModeChange={setOptimizerMode}
              onFreeTransfersChange={setFreeTransfers}
              onOptimize={optimize}
            />
          </section>
          <section className="panel panel-saved">
            <SavedSlots
              slots={slots}
              evaluations={slotEvaluations}
              activeSlot={activeSlot >= 0 ? activeSlot : null}
              risk={params.risk}
              onSave={saveSlot}
              onLoad={loadSlot}
            />
          </section>
          <aside className="panel panel-summary">
            <TeamSummary
              team={team}
              evaluation={evaluation}
              risk={params.risk}
            />
          </aside>
        </div>
      </div>

      {suggestion && (
        <TransfersModal
          suggestion={suggestion}
          freeTransfers={freeTransfers}
          players={new Map([...allDrivers, ...allConstructors].map((p) => [p.id, p]))}
          risk={params.risk}
          onApply={() => applyTransfers(suggestion)}
          onClose={() => setSuggestion(null)}
        />
      )}
    </div>
  );
}

export default App;

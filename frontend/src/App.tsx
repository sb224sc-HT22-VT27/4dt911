// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { TeamPanel } from './components/TeamPanel/TeamPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel/AnalyticsPanel';
import { TeamSummary } from './components/SidePanels/TeamSummary';
import { ComparisonPanel } from './components/SidePanels/ComparisonPanel';
import { ParametersBar } from './components/Header/ParametersBar';
import { RaceSelect } from './components/Header/RaceSelect';
import {
  evaluateTeam,
  fetchConstructors,
  fetchDrivers,
  fetchPredictions,
  fetchStats,
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
  type Params,
  type PlayerStats,
  type Prediction,
  type Race,
  type TeamEvaluation,
} from './types/f1';

function App() {
  const [races, setRaces] = useState<Race[]>([]);
  const [round, setRound] = useState('');
  const [rosterDrivers, setRosterDrivers] = useState<Driver[]>([]);
  const [rosterConstructors, setRosterConstructors] = useState<Constructor[]>([]);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [driverStats, setDriverStats] = useState<PlayerStats[]>([]);
  const [constructorStats, setConstructorStats] = useState<PlayerStats[]>([]);
  const [evaluation, setEvaluation] = useState<TeamEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [driverIds, setDriverIds] = useState<(string | null)[]>([null, null, null, null, null]);
  const [constructorIds, setConstructorIds] = useState<(string | null)[]>([null, null]);
  const [budget, setBudget] = useState(100);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const hasAutoPicked = useRef(false);

  const rounds = useMemo(() => (round ? [round] : []), [round]);
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error');

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchConstructors(), fetchUpcomingRaces()])
      .then(([d, c, r]) => {
        setRosterDrivers(d);
        setRosterConstructors(c);
        setRaces(r);
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

  const allDrivers = useMemo(
    () => toCards(rosterDrivers, 'driver', predictions ?? [], driverStats),
    [rosterDrivers, predictions, driverStats]
  );
  const allConstructors = useMemo(
    () => toCards(rosterConstructors, 'constructor', predictions ?? [], constructorStats),
    [rosterConstructors, predictions, constructorStats]
  );

  const drivers = driverIds.map((id) => allDrivers.find((d) => d.id === id) ?? null);
  const constructors = constructorIds.map((id) => allConstructors.find((c) => c.id === id) ?? null);
  const team = [...drivers, ...constructors].filter(Boolean) as CardItem[];
  const remainingBudget = Number((budget - team.reduce((sum, i) => sum + i.price, 0)).toFixed(1));
  const race = races.find((r) => r.round === round);

  useEffect(() => {
    if (!rounds.length) return;
    let active = true;
    const ids = (list: (string | null)[]) => list.filter(Boolean) as string[];
    evaluateTeam(ids(driverIds), ids(constructorIds), rounds, params)
      .then((e) => active && setEvaluation(e))
      .catch(fail);
    return () => {
      active = false;
    };
  }, [driverIds, constructorIds, rounds, params]);

  const optimize = async (): Promise<string> => {
    try {
      const result = await optimizeTeam(budget, rounds, params);
      setDriverIds(result.drivers);
      setConstructorIds(result.constructors);
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

  const setSlot = (kind: CardItem['kind'], slot: number, id: string | null) => {
    const setter = kind === 'driver' ? setDriverIds : setConstructorIds;
    setter((prev) => prev.map((current, i) => (i === slot ? id : current)));
  };

  const removeFromTeam = (id: string) => {
    setDriverIds((prev) => prev.map((d) => (d === id ? null : d)));
    setConstructorIds((prev) => prev.map((c) => (c === id ? null : c)));
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
        <div className="header-left">
          <div className="brand">
            <span className="brand-mark" />
            <h1>F1 Fantasy Visualizer</h1>
          </div>
          <RaceSelect races={races} selectedRound={round} onSelect={setRound} />
        </div>
        <ParametersBar params={params} trackType={race.trackType} onChange={setParams} />
      </header>

      <div className="dashboard-grid">
        <aside className="panel panel-comparison">
          <ComparisonPanel
            drivers={allDrivers}
            constructors={allConstructors}
            teamDrivers={drivers}
            teamConstructors={constructors}
            race={race}
          />
        </aside>

        <main className="panel panel-team">
          <TeamPanel
            drivers={drivers}
            constructors={constructors}
            allDrivers={allDrivers}
            allConstructors={allConstructors}
            remainingBudget={remainingBudget}
            params={params}
            onSelect={(kind, slot, item) => setSlot(kind, slot, item.id)}
            onRemove={removeFromTeam}
            onOptimize={optimize}
          />
        </main>

        <section className="panel panel-helper">
          <AnalyticsPanel
            team={team}
            evaluation={evaluation}
            allDrivers={allDrivers}
            allConstructors={allConstructors}
            risk={params.risk}
            addBlocker={addBlocker}
            onAdd={addToTeam}
            onRemove={removeFromTeam}
          />
        </section>

        <aside className="panel panel-summary">
          <TeamSummary
            team={team}
            evaluation={evaluation}
            budget={budget}
            remainingBudget={remainingBudget}
            risk={params.risk}
            onBudgetChange={setBudget}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;

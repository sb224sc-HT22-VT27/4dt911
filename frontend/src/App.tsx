// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { TeamPanel } from './components/TeamPanel/TeamPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel/AnalyticsPanel';
import { StatsPanel } from './components/SidePanels/StatsPanel';
import { UpcomingPanel } from './components/SidePanels/UpcomingPanel';
import { ComparisonPanel } from './components/SidePanels/ComparisonPanel';
import { ParametersBar } from './components/Header/ParametersBar';
import { findOptimalTeam } from './components/TeamPanel/optimizer';
import { applyParams, DEFAULT_PARAMS } from './utils/scoring';
import {
  buildConstructorCards,
  buildDriverCards,
  fetchConstructors,
  fetchDrivers,
  fetchPredictions,
  fetchStats,
  getTrack,
  getUpcomingRaces,
} from './api/fantasyApi';
import {
  RISK_LABELS,
  TRACK_LABELS,
  type CardItem,
  type Constructor,
  type Driver,
  type Params,
  type RoundPredictions,
  type StatsFile,
} from './types/f1';

const races = getUpcomingRaces();

function App() {
  const [round, setRound] = useState(races[0].round);
  const [rawDrivers, setRawDrivers] = useState<Driver[]>([]);
  const [rawConstructors, setRawConstructors] = useState<Constructor[]>([]);
  const [predictions, setPredictions] = useState<RoundPredictions | null>(null);
  const [stats, setStats] = useState<StatsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [driverIds, setDriverIds] = useState<(string | null)[]>([null, null, null, null, null]);
  const [constructorIds, setConstructorIds] = useState<(string | null)[]>([null, null]);
  const [budget, setBudget] = useState(100);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const hasAutoPicked = useRef(false);

  useEffect(() => {
    Promise.all([fetchDrivers(), fetchConstructors(), fetchStats()])
      .then(([d, c, s]) => {
        setRawDrivers(d);
        setRawConstructors(c);
        setStats(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown connection error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPredictions(round).then(setPredictions);
  }, [round]);

  const race = races.find((r) => r.round === round)!;
  const track = getTrack(round);

  // Cards with the user's weights (form, track fit, DNF) applied to the predictions
  const allDrivers = useMemo(
    () => buildDriverCards(rawDrivers, predictions, stats, track).map((d) => applyParams(d, params)),
    [rawDrivers, predictions, stats, track, params]
  );
  const allConstructors = useMemo(
    () => buildConstructorCards(rawConstructors, predictions, stats, track).map((c) => applyParams(c, params)),
    [rawConstructors, predictions, stats, track, params]
  );

  const drivers = driverIds.map((id) => allDrivers.find((d) => d.id === id) ?? null);
  const constructors = constructorIds.map((id) => allConstructors.find((c) => c.id === id) ?? null);
  const team = [...drivers, ...constructors].filter(Boolean) as CardItem[];
  const remainingBudget = Number((budget - team.reduce((sum, i) => sum + i.price, 0)).toFixed(1));

  const optimize = (): string => {
    const result = findOptimalTeam(allDrivers, allConstructors, budget, params.risk);
    if (!result) return `No team fits under €${budget}M`;
    setDriverIds(result.drivers.map((d) => d.id));
    setConstructorIds(result.constructors.map((c) => c.id));
    return `Optimized for ${RISK_LABELS[params.risk].toLowerCase()}: ${result.points} pts`;
  };

  // Start with an optimized team the first time data is available
  useEffect(() => {
    if (!hasAutoPicked.current && allDrivers.length && allConstructors.length && predictions) {
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

  if (loading || error) {
    return (
      <div className="app-status">
        {loading ? (
          <p className="status-loading">Loading F1 Fantasy data…</p>
        ) : (
          <>
            <p className="status-error">Connection error: {error}</p>
            <p className="status-hint">Make sure the backend is running on localhost:8000.</p>
            <button type="button" className="status-retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </>
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
          <div className="header-race">
            <span className="header-round">Round {race.round}</span>
            <strong>{race.name}</strong>
            <span className="header-track">{TRACK_LABELS[track.type]}</span>
          </div>
        </div>
        <ParametersBar params={params} trackType={track.type} onChange={setParams} />
      </header>

      <div className="dashboard-grid">
        <aside className="panel panel-comparison">
          <ComparisonPanel
            drivers={allDrivers}
            constructors={allConstructors}
            teamDrivers={drivers}
            teamConstructors={constructors}
            track={track}
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
            params={params}
            onBudgetChange={setBudget}
            onSelect={(kind, slot, item) => setSlot(kind, slot, item.id)}
            onRemove={removeFromTeam}
            onOptimize={optimize}
          />
        </main>

        <section className="panel panel-statistics">
          <StatsPanel team={team} allDrivers={allDrivers} risk={params.risk} />
        </section>

        <section className="panel panel-upcoming">
          <UpcomingPanel races={races} selectedRound={round} onSelect={setRound} />
        </section>

        <section className="panel panel-ppm">
          <AnalyticsPanel
            team={team}
            allDrivers={allDrivers}
            allConstructors={allConstructors}
            risk={params.risk}
            addBlocker={addBlocker}
            onAdd={addToTeam}
            onRemove={removeFromTeam}
          />
        </section>
      </div>
    </div>
  );
}

export default App;

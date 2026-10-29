// src/App.tsx
import { useState } from 'react';
import './App.css';
import { TeamPanel } from './components/TeamPanel/TeamPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel/AnalyticsPanel';
import type { CardItem } from './types/f1';

function App() {
  const [drivers, setDrivers] = useState<(CardItem | null)[]>([]);
  const [constructors, setConstructors] = useState<(CardItem | null)[]>([]);

  // Calculate live total predicted points whenever the roster changes
  const totalPredictedPoints = Number(
    [...drivers.filter(Boolean), ...constructors.filter(Boolean)]
      .reduce((acc, item) => acc + (item?.expectedPoints || 0), 0)
      .toFixed(1)
  );

  const handleTeamChange = (
    updatedDrivers: (CardItem | null)[],
    updatedConstructors: (CardItem | null)[]
  ) => {
    setDrivers(updatedDrivers);
    setConstructors(updatedConstructors);
  };

  return (
    <div className="dashboard-grid">
      {/* 1. Left Sidebar */}
      <aside className="panel panel-comparison">
        <h2>Comparison</h2>
        <p>Compare teams or players here.</p>
      </aside>

      {/* 2. Main Center Content */}
      <main className="panel panel-team">
        <TeamPanel onTeamChange={handleTeamChange} />
      </main>

      {/* 3. Right Top */}
      <section className="panel panel-statistics">
        <h3>Statistics</h3>
        <p>Key metrics and performance numbers.</p>
      </section>

      {/* 4. Right Bottom */}
      <section className="panel panel-upcoming">
        <h3>Upcoming</h3>
        <p>Next races, schedule, or events.</p>
      </section>

      {/* 5. Center Bottom */}
      <section className="panel panel-ppm">
        <AnalyticsPanel
          drivers={drivers}
          constructors={constructors}
          totalPredictedPoints={totalPredictedPoints}
        />
      </section>
    </div>
  );
}

export default App;
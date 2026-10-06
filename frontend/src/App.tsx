// src/App.tsx
import './App.css';

function App() {
  return (
    <div className="dashboard-grid">
      {/* 1. Left Sidebar */}
      <aside className="panel panel-comparison">
        <h2>Comparison</h2>
        <p>Compare teams or players here.</p>
      </aside>

      {/* 2. Main Center Content */}
      <main className="panel panel-team">
        <h2>My Team</h2>
        <p>

        </p>
      </main>

      {/* 3. Right Top */}
      <section className="panel panel-statistics">
        <h3>Statistics</h3>
        <p>Key metrics and performance numbers.</p>
      </section>

      {/* 4. Right Bottom */}
      <section className="panel panel-upcoming">
        <h3>Upcoming</h3>
        <p>Next matches, schedule, or events.</p>
      </section>

      {/* 5. Center Bottom */}
      <section className="panel panel-ppm">
        <h3>PPM Graph</h3>
        <p>Points/performance graph placeholder.</p>
      </section>
    </div>
  );
}

export default App;
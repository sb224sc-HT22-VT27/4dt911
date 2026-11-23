// src/components/SidePanels/ComparisonPanel.tsx
import React, { useState } from 'react';
import { COLOR_A, COLOR_B, CompareRow } from './CompareRow';
import { TeammatesView } from './TeammatesView';
import { GRID_AVERAGE_ID } from '../../api/fantasyApi';
import type { CardItem, DriverInfo, PlayerStats, Race, TeammateStats } from '../../types/f1';
import './SidePanels.css';

interface ComparisonPanelProps {
    drivers: CardItem[];
    constructors: CardItem[];
    teamDrivers: (CardItem | null)[];
    teamConstructors: (CardItem | null)[];
    teammates: TeammateStats[];
    selectedId: string | null;
    compareId: string | null;
    onSelect: (id: string) => void;
    onCompare: (id: string) => void;
    driverStats: PlayerStats[];
    constructorStats: PlayerStats[];
    driverInfo: Map<string, DriverInfo>;
    race: Race;
}

type Mode = 'driver' | 'constructor' | 'teammates';
type Tab = 'ratings' | 'f1' | 'fantasy';

// Either a player card or the grid average (stats only, no fantasy numbers)
type Side = Pick<CardItem, 'id' | 'name'> & Partial<CardItem>;

interface Metric {
    label: string;
    value: (d: Side) => number | null | undefined;
    format: (v: number) => string;
}

const MODES: { id: Mode; label: string }[] = [
    { id: 'driver', label: 'Drivers' },
    { id: 'constructor', label: 'Teams' },
    { id: 'teammates', label: 'Teammates' },
];

const TABS: { id: Tab; label: string }[] = [
    { id: 'ratings', label: 'Ratings' },
    { id: 'f1', label: 'F1 stats' },
    { id: 'fantasy', label: 'Fantasy' },
];

const RATING_METRICS: Metric[] = [
    { label: 'Quali', value: (d) => d.ratings?.quali, format: (v) => `${v}` },
    { label: 'Race', value: (d) => d.ratings?.race, format: (v) => `${v}` },
    { label: 'Form', value: (d) => d.ratings?.form, format: (v) => `${v}` },
    { label: 'Reliability', value: (d) => d.ratings?.reliability, format: (v) => `${v}` },
    { label: 'Overtaking', value: (d) => d.ratings?.overtaking, format: (v) => `${v}` },
    { label: 'Track fit', value: (d) => d.ratings?.trackFit, format: (v) => `${v}` },
];

const FANTASY_METRICS: Metric[] = [
    { label: 'Price', value: (d) => d.price, format: (v) => `€${v}M` },
    { label: 'Floor pts (P10)', value: (d) => d.floor, format: (v) => `${v}` },
    { label: 'Expected pts (P50)', value: (d) => d.expectedPoints, format: (v) => `${v}` },
    { label: 'Ceiling pts (P90)', value: (d) => d.ceiling, format: (v) => `${v}` },
    { label: 'Points per €M', value: (d) => d.ppm, format: (v) => v.toFixed(2) },
    { label: 'Ownership', value: (d) => d.ownership, format: (v) => `${v}%` },
    { label: 'DNF chance', value: (d) => d.dnfChance, format: (v) => `${v}%` },
];

const f1Metrics = (race: Race): Metric[] => [
    { label: 'Championship pts', value: (d) => d.season?.points, format: (v) => `${v}` },
    { label: 'Wins', value: (d) => d.season?.wins, format: (v) => `${v}` },
    { label: 'Podiums', value: (d) => d.season?.podiums, format: (v) => `${v}` },
    { label: 'Avg quali', value: (d) => d.season?.avgQuali, format: (v) => `P${v}` },
    { label: 'Avg finish', value: (d) => d.season?.avgFinish, format: (v) => `P${v}` },
    { label: 'Positions gained', value: (d) => d.season?.avgGained, format: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'DNFs', value: (d) => d.season?.dnfs, format: (v) => `${v}` },
    { label: 'Avg pit lane time', value: (d) => d.season?.avgPitStop, format: (v) => `${v}s` },
    { label: `Avg finish at ${race.location}`, value: (d) => d.trackAvg, format: (v) => `P${v}` },
];

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
    drivers,
    constructors,
    teamDrivers,
    teamConstructors,
    teammates,
    selectedId,
    compareId,
    onSelect,
    onCompare,
    driverStats,
    constructorStats,
    driverInfo,
    race,
}) => {
    const [mode, setMode] = useState<Mode>('driver');
    const [tab, setTab] = useState<Tab>('ratings');
    const [seenId, setSeenId] = useState(selectedId);

    // A new selection of the other kind switches the mode to match (Teammates stays as it is)
    if (seenId !== selectedId) {
        setSeenId(selectedId);
        const kind = constructors.some((c) => c.id === selectedId) ? 'constructor' : drivers.some((d) => d.id === selectedId) ? 'driver' : mode;
        if (mode !== 'teammates' && kind !== mode) setMode(kind);
    }

    const items = mode === 'constructor' ? constructors : drivers;
    const picked = (mode === 'constructor' ? teamConstructors : teamDrivers).filter(Boolean) as CardItem[];
    const a = items.find((d) => d.id === selectedId) ?? picked[0] ?? items[0];
    const gridStats = (mode === 'constructor' ? constructorStats : driverStats).find((s) => s.id === GRID_AVERAGE_ID);
    const grid: Side | undefined = gridStats && {
        id: GRID_AVERAGE_ID,
        name: 'Grid average',
        ratings: gridStats.ratings,
        season: gridStats.season,
        trackAvg: gridStats.trackAvg,
    };
    const isGrid = compareId === GRID_AVERAGE_ID && grid !== undefined;
    const b: Side | undefined = isGrid ? grid : (items.find((d) => d.id === compareId) ?? [...picked, ...items].find((d) => d.id !== a?.id) ?? items[1]);
    const sorted = [...items].sort((x, y) => x.name.localeCompare(y.name));

    const switchMode = (m: Mode) => {
        setMode(m);
        if (m === 'teammates') return;
        const list = m === 'constructor' ? constructors : drivers;
        if (!list.some((d) => d.id === selectedId)) {
            const mine = (m === 'constructor' ? teamConstructors : teamDrivers).find(Boolean) ?? list[0];
            if (mine) onSelect(mine.id);
        }
    };

    const renderRows = (metrics: Metric[]) =>
        metrics.map((m) => {
            const va = m.value(a);
            const vb = m.value(b);
            if (va == null || vb == null) return null;
            return <CompareRow key={m.label} label={m.label} a={va} b={vb} format={m.format} />;
        });

    return (
        <div className="side-panel comparison">
            <div className="compare-header">
                <h3 className="side-title">Compare</h3>
                <div className="segmented">
                    {MODES.map((m) => (
                        <button key={m.id} type="button" className={mode === m.id ? 'active' : ''} onClick={() => switchMode(m.id)}>
                            {m.label}
                        </button>
                    ))}
                </div>
                {mode !== 'teammates' && a && b && (
                    <>
                        <div className="compare-selects">
                            <select value={a.id} onChange={(e) => onSelect(e.target.value)} style={{ borderColor: COLOR_A }}>
                                {sorted.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <span className="compare-vs">vs</span>
                            <select value={b.id} onChange={(e) => onCompare(e.target.value)} style={{ borderColor: COLOR_B }}>
                                {sorted.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                                {grid && <option value={GRID_AVERAGE_ID}>Grid average</option>}
                            </select>
                        </div>
                        <div className="segmented">
                            {TABS.map((t) => (
                                <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {mode === 'teammates' ? (
                <TeammatesView
                    teammates={teammates}
                    driverInfo={driverInfo}
                    constructors={constructors}
                    defaultConstructorId={teamConstructors.find(Boolean)?.id}
                />
            ) : (
                a &&
                b &&
                (tab === 'fantasy' && isGrid ? (
                    <p className="compare-note">Fantasy numbers only exist per player. Pick a player to compare.</p>
                ) : (
                    <div className="compare-grid">
                        {renderRows(tab === 'ratings' ? RATING_METRICS : tab === 'f1' ? f1Metrics(race) : FANTASY_METRICS)}
                    </div>
                ))
            )}
        </div>
    );
};

// src/components/SidePanels/ComparisonPanel.tsx
import React, { useState } from 'react';
import { HexChart } from '../Charts/HexChart';
import { COLOR_A, COLOR_B, CompareRow } from './CompareRow';
import { TeammatesView } from './TeammatesView';
import type { CardItem, DriverInfo, Race, TeammateStats } from '../../types/f1';
import './SidePanels.css';

interface ComparisonPanelProps {
    drivers: CardItem[];
    constructors: CardItem[];
    teamDrivers: (CardItem | null)[];
    teamConstructors: (CardItem | null)[];
    teammates: TeammateStats[];
    driverInfo: Map<string, DriverInfo>;
    race: Race;
}

type Mode = 'driver' | 'constructor' | 'teammates';
type Tab = 'profile' | 'f1' | 'fantasy';

interface Metric {
    label: string;
    value: (d: CardItem) => number | null | undefined;
    format: (v: number) => string;
    lowerIsBetter?: boolean;
}

const MODES: { id: Mode; label: string }[] = [
    { id: 'driver', label: 'Drivers' },
    { id: 'constructor', label: 'Teams' },
    { id: 'teammates', label: 'Teammates' },
];

const TABS: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'f1', label: 'F1 stats' },
    { id: 'fantasy', label: 'Fantasy' },
];

const FANTASY_METRICS: Metric[] = [
    { label: 'Price', value: (d) => d.price, format: (v) => `€${v}M`, lowerIsBetter: true },
    { label: 'Floor pts (P10)', value: (d) => d.floor, format: (v) => `${v}` },
    { label: 'Expected pts (P50)', value: (d) => d.expectedPoints, format: (v) => `${v}` },
    { label: 'Ceiling pts (P90)', value: (d) => d.ceiling, format: (v) => `${v}` },
    { label: 'Points per €M', value: (d) => d.ppm, format: (v) => v.toFixed(2) },
    { label: 'Ownership', value: (d) => d.ownership, format: (v) => `${v}%` },
    { label: 'DNF chance', value: (d) => d.dnfChance, format: (v) => `${v}%`, lowerIsBetter: true },
];

const f1Metrics = (race: Race): Metric[] => [
    { label: 'Championship pts', value: (d) => d.season?.points, format: (v) => `${v}` },
    { label: 'Wins', value: (d) => d.season?.wins, format: (v) => `${v}` },
    { label: 'Podiums', value: (d) => d.season?.podiums, format: (v) => `${v}` },
    { label: 'Avg quali', value: (d) => d.season?.avgQuali, format: (v) => `P${v}`, lowerIsBetter: true },
    { label: 'Avg finish', value: (d) => d.season?.avgFinish, format: (v) => `P${v}`, lowerIsBetter: true },
    { label: 'Positions gained', value: (d) => d.season?.avgGained, format: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'DNFs', value: (d) => d.season?.dnfs, format: (v) => `${v}`, lowerIsBetter: true },
    { label: 'Avg pit lane time', value: (d) => d.season?.avgPitStop, format: (v) => `${v}s`, lowerIsBetter: true },
    { label: `Avg finish at ${race.location}`, value: (d) => d.trackAvg, format: (v) => `P${v}`, lowerIsBetter: true },
];

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
    drivers,
    constructors,
    teamDrivers,
    teamConstructors,
    teammates,
    driverInfo,
    race,
}) => {
    const [mode, setMode] = useState<Mode>('driver');
    const [tab, setTab] = useState<Tab>('profile');
    const [idA, setIdA] = useState('');
    const [idB, setIdB] = useState('');

    const items = mode === 'constructor' ? constructors : drivers;
    const picked = (mode === 'constructor' ? teamConstructors : teamDrivers).filter(Boolean) as CardItem[];
    const a = items.find((d) => d.id === idA) ?? picked[0] ?? items[0];
    const b = items.find((d) => d.id === idB) ?? picked[1] ?? items[1];
    const sorted = [...items].sort((x, y) => x.name.localeCompare(y.name));

    const switchMode = (m: Mode) => {
        setMode(m);
        setIdA('');
        setIdB('');
    };

    const renderRows = (metrics: Metric[]) =>
        metrics.map((m) => {
            const va = m.value(a);
            const vb = m.value(b);
            if (va == null || vb == null) return null;
            return <CompareRow key={m.label} label={m.label} a={va} b={vb} format={m.format} lowerIsBetter={m.lowerIsBetter} />;
        });

    const diff = a && b ? Number((a.expectedPoints - b.expectedPoints).toFixed(1)) : 0;

    return (
        <div className="side-panel comparison">
            <h3 className="side-title">Comparison</h3>

            <div className="segmented">
                {MODES.map((m) => (
                    <button key={m.id} type="button" className={mode === m.id ? 'active' : ''} onClick={() => switchMode(m.id)}>
                        {m.label}
                    </button>
                ))}
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
                b && (
                    <>
                        <div className="compare-selects">
                            <select value={a.id} onChange={(e) => setIdA(e.target.value)} style={{ borderColor: COLOR_A }}>
                                {sorted.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <span className="compare-vs">vs</span>
                            <select value={b.id} onChange={(e) => setIdB(e.target.value)} style={{ borderColor: COLOR_B }}>
                                {sorted.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="compare-tabs">
                            {TABS.map((t) => (
                                <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {tab === 'profile' && (
                            <>
                                {a.ratings && b.ratings && (
                                    <HexChart
                                        series={[
                                            { label: a.name, color: COLOR_A, values: a.ratings },
                                            { label: b.name, color: COLOR_B, values: b.ratings },
                                        ]}
                                    />
                                )}
                                <p className="compare-verdict">
                                    {a.id === b.id
                                        ? 'Pick two different options to compare.'
                                        : `${diff >= 0 ? a.name : b.name} is projected ${Math.abs(diff)} pts ahead of ${diff >= 0 ? b.name : a.name}.`}
                                </p>
                            </>
                        )}
                        {tab === 'f1' && <div className="compare-group">{renderRows(f1Metrics(race))}</div>}
                        {tab === 'fantasy' && <div className="compare-group">{renderRows(FANTASY_METRICS)}</div>}
                    </>
                )
            )}
        </div>
    );
};

// src/components/SidePanels/ComparisonPanel.tsx
import React, { useState } from 'react';
import { HexChart } from '../Charts/HexChart';
import type { CardItem, ItemKind, Race } from '../../types/f1';
import './SidePanels.css';

interface ComparisonPanelProps {
    drivers: CardItem[];
    constructors: CardItem[];
    teamDrivers: (CardItem | null)[];
    teamConstructors: (CardItem | null)[];
    race: Race;
}

interface Metric {
    label: string;
    value: (d: CardItem) => number | null | undefined;
    format: (v: number) => string;
    lowerIsBetter?: boolean;
}

const COLOR_A = '#2dd4bf';
const COLOR_B = '#a78bfa';

const metricGroups = (race: Race): { title: string; metrics: Metric[] }[] => [
    {
        title: 'Fantasy',
        metrics: [
            { label: 'Price', value: (d) => d.price, format: (v) => `€${v}M`, lowerIsBetter: true },
            { label: 'Expected pts', value: (d) => d.expectedPoints, format: (v) => `${v}` },
            { label: 'Ceiling pts', value: (d) => d.ceiling, format: (v) => `${v}` },
            { label: 'Points per €M', value: (d) => d.ppm, format: (v) => v.toFixed(2) },
            { label: 'DNF chance', value: (d) => d.dnfChance, format: (v) => `${v}%`, lowerIsBetter: true },
        ],
    },
    {
        title: '2026 season',
        metrics: [
            { label: 'Championship pts', value: (d) => d.season?.points, format: (v) => `${v}` },
            { label: 'Wins', value: (d) => d.season?.wins, format: (v) => `${v}` },
            { label: 'Podiums', value: (d) => d.season?.podiums, format: (v) => `${v}` },
            { label: 'Avg quali', value: (d) => d.season?.avgQuali, format: (v) => `P${v}`, lowerIsBetter: true },
            { label: 'Avg finish', value: (d) => d.season?.avgFinish, format: (v) => `P${v}`, lowerIsBetter: true },
            { label: 'Positions gained', value: (d) => d.season?.avgGained, format: (v) => `${v > 0 ? '+' : ''}${v}` },
            { label: 'DNFs', value: (d) => d.season?.dnfs, format: (v) => `${v}`, lowerIsBetter: true },
            {
                label: 'Avg pit lane time',
                value: (d) => d.season?.avgPitStop,
                format: (v) => `${v}s`,
                lowerIsBetter: true,
            },
        ],
    },
    {
        title: `At ${race.location} (since 2023)`,
        metrics: [{ label: 'Avg finish', value: (d) => d.trackAvg, format: (v) => `P${v}`, lowerIsBetter: true }],
    },
];

// Share of the bar for A, works for negative values and "lower is better" metrics
const shareA = (a: number, b: number, lowerIsBetter?: boolean) => {
    if (a === b) return 50;
    const better = lowerIsBetter ? a < b : a > b;
    const gap = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
    return better ? 50 + 45 * Math.min(gap, 1) : 50 - 45 * Math.min(gap, 1);
};

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
    drivers,
    constructors,
    teamDrivers,
    teamConstructors,
    race,
}) => {
    const [kind, setKind] = useState<ItemKind>('driver');
    const [idA, setIdA] = useState('');
    const [idB, setIdB] = useState('');

    const items = kind === 'driver' ? drivers : constructors;
    const picked = (kind === 'driver' ? teamDrivers : teamConstructors).filter(Boolean) as CardItem[];
    const a = items.find((d) => d.id === idA) ?? picked[0] ?? items[0];
    const b = items.find((d) => d.id === idB) ?? picked[1] ?? items[1];
    if (!a || !b) return null;

    const sorted = [...items].sort((x, y) => x.name.localeCompare(y.name));
    const diff = Number((a.expectedPoints - b.expectedPoints).toFixed(1));

    const switchKind = (k: ItemKind) => {
        setKind(k);
        setIdA('');
        setIdB('');
    };

    return (
        <div className="side-panel">
            <div className="side-header">
                <h3 className="side-title">Comparison</h3>
                <div className="mini-toggle">
                    {(['driver', 'constructor'] as ItemKind[]).map((k) => (
                        <button key={k} type="button" className={kind === k ? 'active' : ''} onClick={() => switchKind(k)}>
                            {k === 'driver' ? 'Drivers' : 'Teams'}
                        </button>
                    ))}
                </div>
            </div>

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

            {metricGroups(race).map((group) => (
                <div key={group.title} className="compare-group">
                    <span className="compare-group-title">{group.title}</span>
                    {group.metrics.map((m) => {
                        const va = m.value(a);
                        const vb = m.value(b);
                        if (va == null || vb == null) return null;
                        const share = shareA(va, vb, m.lowerIsBetter);
                        return (
                            <div key={m.label} className="compare-row">
                                <div className="compare-row-head">
                                    <span className={share > 50 ? 'winner' : ''}>{m.format(Number(va.toFixed(2)))}</span>
                                    <span className="compare-label">{m.label}</span>
                                    <span className={share < 50 ? 'winner' : ''}>{m.format(Number(vb.toFixed(2)))}</span>
                                </div>
                                <div className="compare-track">
                                    <span style={{ width: `${share}%`, backgroundColor: COLOR_A }} />
                                    <span style={{ width: `${100 - share}%`, backgroundColor: COLOR_B }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

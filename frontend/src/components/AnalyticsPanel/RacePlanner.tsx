// src/components/AnalyticsPanel/RacePlanner.tsx
import React, { useState } from 'react';
import { RISK_LABELS, type CardItem, type Race, type Risk, type RoundPoints, type TrackType } from '../../types/f1';

type Filter = 'team' | 'driver' | 'constructor';

interface RacePlannerProps {
    races: Race[];
    raceCount: number;
    maxRaces: number;
    onRaceCountChange: (count: number) => void;
    data: RoundPoints[];
    players: Map<string, CardItem>;
    teamIds: Set<string>;
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'team', label: 'My team' },
    { id: 'driver', label: 'Drivers' },
    { id: 'constructor', label: 'Constructors' },
];

const shortName = (name: string) => name.replace(' Grand Prix', '').replace(' in Malaysia', '');
const TRACK_SHORT: Record<TrackType, string> = { street: 'Street', high_speed: 'Fast', technical: 'Tech' };

// One-hue sequential ramp, darkest = fewest points. Light cells get dark text for contrast.
const RAMP = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'];
const cellStyle = (value: number, max: number): React.CSSProperties => {
    const step = Math.min(RAMP.length - 1, Math.max(0, Math.floor((value / max) * RAMP.length)));
    return { backgroundColor: RAMP[step], color: step >= 5 ? '#071116' : 'var(--text)' };
};

export const RacePlanner: React.FC<RacePlannerProps> = ({
    races,
    raceCount,
    maxRaces,
    onRaceCountChange,
    data,
    players,
    teamIds,
    risk,
    addBlocker,
    onAdd,
}) => {
    const [filter, setFilter] = useState<Filter>('driver');
    // 'total' or a round number
    const [sortBy, setSortBy] = useState('total');

    const sortValue = (row: RoundPoints) => (sortBy === 'total' ? row.total : row.points[sortBy] ?? -Infinity);
    const rows = data
        .filter((row) => (filter === 'team' ? teamIds.has(row.id) : row.kind === filter))
        .sort((a, b) => sortValue(b) - sortValue(a));
    const sortClass = (key: string) => `sortable ${sortBy === key ? 'sorted' : ''}`;
    // Colour scale is shared by all rows so cells can be compared across the table
    const maxCell = Math.max(1, ...data.flatMap((row) => Object.values(row.points).map((v) => v ?? 0)));

    return (
        <div className="planner">
            <div className="ppm-toolbar">
                <div className="ppm-kind-toggle">
                    {FILTERS.map((f) => (
                        <button key={f.id} type="button" className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="planner-count">
                    <span>Races ahead</span>
                    <div className="stepper">
                        <button type="button" disabled={raceCount <= 1} onClick={() => onRaceCountChange(raceCount - 1)}>
                            −
                        </button>
                        <strong>{Math.min(raceCount, maxRaces)}</strong>
                        <button
                            type="button"
                            disabled={raceCount >= Math.min(10, maxRaces)}
                            onClick={() => onRaceCountChange(raceCount + 1)}
                        >
                            +
                        </button>
                    </div>
                </div>
                <span className="ppm-axis-hint">{RISK_LABELS[risk]} points · click a column to sort</span>
            </div>

            <div className="planner-table-wrap">
                <table className={`planner-table ${races.length > 6 ? 'compact' : ''}`}>
                    <thead>
                        <tr>
                            <th className="planner-player">Player</th>
                            {races.map((r) => (
                                <th key={r.round} className={sortClass(r.round)} onClick={() => setSortBy(r.round)}>
                                    <span className="planner-round">R{r.round}</span>
                                    <span className="planner-race" title={r.name}>
                                        {shortName(r.name)}
                                    </span>
                                    <span className="planner-track">{TRACK_SHORT[r.trackType]}</span>
                                </th>
                            ))}
                            <th className={sortClass('total')} onClick={() => setSortBy('total')}>
                                Total
                            </th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const player = players.get(row.id);
                            if (!player) return null;
                            const inTeam = teamIds.has(row.id);
                            const blocker = inTeam ? null : addBlocker(player);
                            return (
                                <tr key={row.id} className={inTeam ? 'in-team' : ''}>
                                    <td className="planner-player">
                                        <span
                                            className={`planner-dot ${player.kind === 'constructor' ? 'striped' : ''}`}
                                            style={{ '--dot': player.avatarColor } as React.CSSProperties}
                                        />
                                        <span className="planner-name">{player.name}</span>
                                        <span className="planner-price">€{player.price}M</span>
                                    </td>
                                    {races.map((r) => {
                                        const value = row.points[r.round];
                                        return (
                                            <td key={r.round} className="planner-cell">
                                                <span style={value == null ? undefined : cellStyle(value, maxCell)}>
                                                    {value ?? '–'}
                                                </span>
                                            </td>
                                        );
                                    })}
                                    <td className="planner-total">{row.total}</td>
                                    <td className="planner-action">
                                        {inTeam ? (
                                            <span className="planner-owned" title="In your team">
                                                ✓
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!!blocker}
                                                title={blocker ?? 'Add to team'}
                                                onClick={() => onAdd(player)}
                                            >
                                                +
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {rows.length === 0 && <p className="breakdown-empty">No players in your team yet.</p>}
            </div>
        </div>
    );
};

// src/components/Header/RaceSelect.tsx
import React from 'react';
import { TRACK_LABELS, type Race } from '../../types/f1';
import './ParametersBar.css';

interface RaceSelectProps {
    races: Race[];
    selectedRound: string;
    onSelect: (round: string) => void;
}

const shortDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const RaceSelect: React.FC<RaceSelectProps> = ({ races, selectedRound, onSelect }) => {
    const race = races.find((r) => r.round === selectedRound)!;

    return (
        <div className="race-select">
            <span className="race-select-round">R{race.round}</span>
            <div className="race-select-main">
                <select value={selectedRound} onChange={(e) => onSelect(e.target.value)}>
                    {races.map((r, i) => (
                        <option key={r.round} value={r.round}>
                            {r.name}
                            {i === 0 ? ' (next)' : ''}
                        </option>
                    ))}
                </select>
                <span className="race-select-meta">
                    {race.location} · {shortDate(race.date)}
                </span>
            </div>
            <span className="race-select-track">{TRACK_LABELS[race.trackType]}</span>
        </div>
    );
};

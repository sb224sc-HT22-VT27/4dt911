// src/components/SidePanels/UpcomingPanel.tsx
import React from 'react';
import { getTrack } from '../../api/fantasyApi';
import { TRACK_LABELS, type Race } from '../../types/f1';
import './SidePanels.css';

interface UpcomingPanelProps {
    races: Race[];
    selectedRound: string;
    onSelect: (round: string) => void;
}

export const UpcomingPanel: React.FC<UpcomingPanelProps> = ({ races, selectedRound, onSelect }) => (
    <div className="side-panel">
        <h3 className="side-title">Upcoming races</h3>
        <div className="race-list">
            {races.map((race, i) => {
                const track = getTrack(race.round);
                return (
                    <button
                        key={race.round}
                        type="button"
                        className={`race-row ${race.round === selectedRound ? 'active' : ''}`}
                        onClick={() => onSelect(race.round)}
                    >
                        <span className="race-round">R{race.round}</span>
                        <span className="race-info">
                            <span className="race-name">{race.name.replace(' Grand Prix', ' GP')}</span>
                            <span className="race-circuit">
                                {track.location} · {TRACK_LABELS[track.type]}
                            </span>
                        </span>
                        {i === 0 && <span className="race-tag">Next</span>}
                        <span className="race-date">
                            {new Date(race.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                    </button>
                );
            })}
        </div>
    </div>
);

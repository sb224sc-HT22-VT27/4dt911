// src/components/SidePanels/StatsPanel.tsx
import React from 'react';
import { HexChart } from '../Charts/HexChart';
import { averageRatings } from '../../utils/scoring';
import { pointsFor, RISK_LABELS, type CardItem, type Risk } from '../../types/f1';
import './SidePanels.css';

interface StatsPanelProps {
    team: CardItem[];
    allDrivers: CardItem[];
    risk: Risk;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const StatsPanel: React.FC<StatsPanelProps> = ({ team, allDrivers, risk }) => {
    const total = (r: Risk) => team.reduce((acc, i) => acc + pointsFor(i, r), 0).toFixed(1);
    const teamRatings = averageRatings(team);
    const gridRatings = averageRatings(allDrivers);

    return (
        <div className="side-panel">
            <h3 className="side-title">Statistics</h3>

            <div className="stat-tiles">
                {RISKS.map((r) => (
                    <div key={r} className={`stat-tile risk-${r} ${risk === r ? 'active' : ''}`}>
                        <span className="stat-tile-label">{RISK_LABELS[r]}</span>
                        <strong>{total(r)}</strong>
                    </div>
                ))}
            </div>

            {teamRatings && gridRatings ? (
                <HexChart
                    series={[
                        { label: 'Grid average', color: '#64748b', values: gridRatings },
                        { label: 'Your team', color: '#2dd4bf', values: teamRatings },
                    ]}
                />
            ) : (
                <p className="side-empty">Pick drivers to see your team profile.</p>
            )}
        </div>
    );
};

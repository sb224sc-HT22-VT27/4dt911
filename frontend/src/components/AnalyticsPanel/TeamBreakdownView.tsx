// src/components/AnalyticsPanel/TeamBreakdownView.tsx
import React from 'react';
import { pointsFor, RISK_LABELS, type CardItem, type Risk } from '../../types/f1';

interface TeamBreakdownViewProps {
    team: CardItem[];
    risk: Risk;
}

export const TeamBreakdownView: React.FC<TeamBreakdownViewProps> = ({ team, risk }) => {
    const total = team.reduce((acc, item) => acc + Math.max(0, pointsFor(item, risk)), 0);

    if (team.length === 0 || total <= 0) {
        return <div className="breakdown-empty">No roster selections yet.</div>;
    }

    const rows = [...team].sort((a, b) => pointsFor(b, risk) - pointsFor(a, risk));

    return (
        <div className="breakdown-wrapper">
            <span className="breakdown-title">
                Share of team {RISK_LABELS[risk].toLowerCase()} points ({total.toFixed(1)} pts)
            </span>
            <div className="breakdown-stacked-bar">
                {rows.map((item) => (
                    <div
                        key={item.id}
                        className="stacked-bar-segment"
                        style={{
                            width: `${(Math.max(0, pointsFor(item, risk)) / total) * 100}%`,
                            backgroundColor: item.avatarColor,
                        }}
                        title={`${item.name}: ${pointsFor(item, risk)} pts`}
                    />
                ))}
            </div>

            <div className="breakdown-chips-grid">
                {rows.map((item) => (
                    <div key={item.id} className="breakdown-chip">
                        <span className="chip-dot" style={{ backgroundColor: item.avatarColor }} />
                        <span className="chip-name">{item.kind === 'driver' ? item.code : item.name}</span>
                        <strong className="chip-val">
                            {Math.round((Math.max(0, pointsFor(item, risk)) / total) * 100)}%
                        </strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

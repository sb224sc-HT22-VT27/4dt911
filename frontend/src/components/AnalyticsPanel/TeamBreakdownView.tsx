// src/components/AnalyticsPanel/TeamBreakdownView.tsx
import React from 'react';
import type { CardItem } from '../../types/f1';

interface TeamBreakdownViewProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    totalPredictedPoints: number;
}

export const TeamBreakdownView: React.FC<TeamBreakdownViewProps> = ({
    drivers,
    constructors,
    totalPredictedPoints,
}) => {
    const allRoster = [...drivers.filter(Boolean), ...constructors.filter(Boolean)] as CardItem[];

    if (allRoster.length === 0 || totalPredictedPoints <= 0) {
        return <div className="breakdown-empty">No roster selections yet.</div>;
    }

    return (
        <div className="breakdown-wrapper">
            {/* 1. Stacked Percentage Bar */}
            <div className="breakdown-stacked-bar">
                {allRoster.map((item) => {
                    const pct = Math.round((item.expectedPoints / totalPredictedPoints) * 100);
                    return (
                        <div
                            key={item.id}
                            className="stacked-bar-segment"
                            style={{
                                width: `${pct}%`,
                                backgroundColor: item.avatarColor || '#2dd4bf',
                            }}
                            title={`${item.name}: ${item.expectedPoints} pts (${pct}%)`}
                        />
                    );
                })}
            </div>

            {/* 2. Chip List of Shares */}
            <div className="breakdown-chips-grid">
                {allRoster.map((item) => {
                    const pct = Math.round((item.expectedPoints / totalPredictedPoints) * 100);
                    return (
                        <div key={item.id} className="breakdown-chip">
                            <span className="chip-dot" style={{ backgroundColor: item.avatarColor || '#2dd4bf' }} />
                            <span className="chip-name">{item.name.split(' ').pop()}</span>
                            <strong className="chip-val">{pct}%</strong>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
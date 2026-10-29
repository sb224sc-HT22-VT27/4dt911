// src/components/AnalyticsPanel/PpmEfficiencyView.tsx
import React from 'react';
import { MOCK_DRIVERS } from '../../data/cards';
import type { CardItem } from '../../types/f1';

interface PpmEfficiencyViewProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
}

export const PpmEfficiencyView: React.FC<PpmEfficiencyViewProps> = ({ drivers }) => {
    const selectedDriverIds = new Set(drivers.filter(Boolean).map((d) => d!.id));

    // Sort drivers by efficiency: predictedPoints / price (highest to lowest)
    const sortedDrivers = [...MOCK_DRIVERS].sort((a, b) => {
        const ppmA = a.predictedPoints / a.price;
        const ppmB = b.predictedPoints / b.price;
        return ppmB - ppmA;
    });

    return (
        <div className="efficiency-wrapper">
            <div className="efficiency-legend">
                <span className="legend-hint">
                    <span className="legend-indicator team-active" /> Your Team
                </span>
                <span className="legend-hint">
                    <span className="legend-indicator" /> Rivals
                </span>
            </div>

            <div className="efficiency-bars">
                {sortedDrivers.map((driver) => {
                    const isSelected = selectedDriverIds.has(driver.id);
                    const ppm = (driver.predictedPoints / driver.price).toFixed(2);
                    const barHeightPct = Math.min(100, Math.round((parseFloat(ppm) / 1.4) * 100));

                    return (
                        <div
                            key={driver.id}
                            className={`efficiency-col ${isSelected ? 'is-selected' : ''}`}
                            title={`${driver.name} (${driver.team}): ${ppm} pts/€M`}
                        >
                            <div className="bar-track">
                                <div
                                    className="bar-fill"
                                    style={{
                                        height: `${barHeightPct}%`,
                                        backgroundColor: isSelected ? (driver.avatarColor || '#2dd4bf') : '#334155',
                                    }}
                                />
                            </div>
                            <span className="bar-code">{driver.code}</span>
                            <span className="bar-val">{ppm}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
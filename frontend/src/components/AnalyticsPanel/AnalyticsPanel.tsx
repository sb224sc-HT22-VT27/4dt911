// src/components/AnalyticsPanel/AnalyticsPanel.tsx
import React, { useState } from 'react';
import { DistGraph } from './DistGraph';
import { PpmEfficiencyView } from './PpmEfficiencyView';
import { TeamBreakdownView } from './TeamBreakdownView';
import type { CardItem } from '../../types/f1';
import './AnalyticsPanel.css';

export type AnalyticsTab = 'distribution' | 'efficiency' | 'breakdown';

interface AnalyticsPanelProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    totalPredictedPoints: number;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    drivers,
    constructors,
    totalPredictedPoints,
}) => {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('distribution');

    return (

        <div className="analytics-container">
            {/* Tab Switcher Header */}
            <div className="analytics-header">
                <div className="analytics-tabs">
                    <button
                        type="button"
                        className={`analytics-tab-btn ${activeTab === 'distribution' ? 'active' : ''}`}
                        onClick={() => setActiveTab('distribution')}
                    >
                        Distribution Graph
                    </button>
                    <button
                        type="button"
                        className={`analytics-tab-btn ${activeTab === 'efficiency' ? 'active' : ''}`}
                        onClick={() => setActiveTab('distribution')}
                    >
                        PPM Graph (TBD)
                    </button>
                    <button
                        type="button"
                        className={`analytics-tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                        onClick={() => setActiveTab('breakdown')}
                    >
                        Other
                    </button>
                </div>
            </div>

            {/* Tab Content Views */}
            <div className="analytics-content">
                {activeTab === 'distribution' && (
                    <DistGraph p50={totalPredictedPoints} />
                )}

                {activeTab === 'efficiency' && (
                    <PpmEfficiencyView drivers={drivers} constructors={constructors} />
                )}

                {activeTab === 'breakdown' && (
                    <TeamBreakdownView
                        drivers={drivers}
                        constructors={constructors}
                        totalPredictedPoints={totalPredictedPoints}
                    />
                )}
            </div>
        </div>
    );
};
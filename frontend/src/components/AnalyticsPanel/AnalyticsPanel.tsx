// src/components/AnalyticsPanel/AnalyticsPanel.tsx
import React, { useState } from 'react';
import { DistGraph } from './DistGraph';
import { PpmEfficiencyView } from './PpmEfficiencyView';
import type { CardItem, Risk, TeamEvaluation } from '../../types/f1';
import './AnalyticsPanel.css';

export type AnalyticsTab = 'efficiency' | 'distribution';

const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'efficiency', label: 'PPM Graph' },
    { id: 'distribution', label: 'Points Distribution' },
];

interface AnalyticsPanelProps {
    team: CardItem[];
    evaluation: TeamEvaluation | null;
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    team,
    evaluation,
    allDrivers,
    allConstructors,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('efficiency');

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <div className="analytics-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`analytics-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="analytics-content">
                {activeTab === 'distribution' && (
                    <DistGraph
                        p10={evaluation?.floor ?? 0}
                        p50={evaluation?.expected ?? 0}
                        p90={evaluation?.ceiling ?? 0}
                        risk={risk}
                    />
                )}

                {activeTab === 'efficiency' && (
                    <PpmEfficiencyView
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        teamIds={new Set(team.map((i) => i.id))}
                        risk={risk}
                        addBlocker={addBlocker}
                        onAdd={onAdd}
                        onRemove={onRemove}
                    />
                )}

            </div>
        </div>
    );
};

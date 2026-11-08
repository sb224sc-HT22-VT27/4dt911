// src/components/AnalyticsPanel/AnalyticsPanel.tsx
import React, { useState } from 'react';
import { DistGraph } from './DistGraph';
import { PpmEfficiencyView } from './PpmEfficiencyView';
import { TeamBreakdownView } from './TeamBreakdownView';
import type { CardItem, Risk } from '../../types/f1';
import './AnalyticsPanel.css';

export type AnalyticsTab = 'distribution' | 'efficiency' | 'breakdown';

const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'distribution', label: 'Points Distribution' },
    { id: 'efficiency', label: 'PPM Graph' },
    { id: 'breakdown', label: 'Breakdown' },
];

interface AnalyticsPanelProps {
    team: CardItem[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

const sum = (items: CardItem[], pick: (i: CardItem) => number) =>
    Number(items.reduce((acc, i) => acc + pick(i), 0).toFixed(1));

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    team,
    allDrivers,
    allConstructors,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('distribution');

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
                        p10={sum(team, (i) => i.floor)}
                        p50={sum(team, (i) => i.expectedPoints)}
                        p90={sum(team, (i) => i.ceiling)}
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

                {activeTab === 'breakdown' && <TeamBreakdownView team={team} risk={risk} />}
            </div>
        </div>
    );
};

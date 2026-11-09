// src/components/AnalyticsPanel/AnalyticsPanel.tsx
import React from 'react';
import { ValueBubbleChart } from './ValueBubbleChart';
import type { CardItem, Risk } from '../../types/f1';
import './AnalyticsPanel.css';

interface AnalyticsPanelProps {
    team: CardItem[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    team,
    allDrivers,
    allConstructors,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => (
    <div className="analytics-container">
        <h3 className="analytics-title">Value finder · points vs price</h3>
        <div className="analytics-content">
            <ValueBubbleChart
                allDrivers={allDrivers}
                allConstructors={allConstructors}
                teamIds={new Set(team.map((i) => i.id))}
                risk={risk}
                addBlocker={addBlocker}
                onAdd={onAdd}
                onRemove={onRemove}
            />
        </div>
    </div>
);

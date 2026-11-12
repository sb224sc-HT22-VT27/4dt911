// src/components/AnalyticsPanel/AnalyticsPanel.tsx
import React, { useState } from 'react';
import { ValueBubbleChart } from './ValueBubbleChart';
import { RacePlanner } from './RacePlanner';
import type { CardItem, Race, Risk, RoundPoints } from '../../types/f1';
import './AnalyticsPanel.css';

type Tab = 'value' | 'planner';

interface AnalyticsPanelProps {
    team: CardItem[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    plannerRaces: Race[];
    plannerCount: number;
    plannerMax: number;
    onPlannerCountChange: (count: number) => void;
    plannerData: RoundPoints[];
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    team,
    allDrivers,
    allConstructors,
    plannerRaces,
    plannerCount,
    plannerMax,
    onPlannerCountChange,
    plannerData,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => {
    const [tab, setTab] = useState<Tab>('value');
    const teamIds = new Set(team.map((i) => i.id));

    return (
        <div className="analytics-container">
            <div className="analytics-tabs">
                <button type="button" className={tab === 'value' ? 'active' : ''} onClick={() => setTab('value')}>
                    Value finder
                </button>
                <button type="button" className={tab === 'planner' ? 'active' : ''} onClick={() => setTab('planner')}>
                    Race planner
                </button>
            </div>
            <div className="analytics-content">
                {tab === 'value' ? (
                    <ValueBubbleChart
                        allDrivers={allDrivers}
                        allConstructors={allConstructors}
                        teamIds={teamIds}
                        risk={risk}
                        addBlocker={addBlocker}
                        onAdd={onAdd}
                        onRemove={onRemove}
                    />
                ) : (
                    <RacePlanner
                        races={plannerRaces}
                        raceCount={plannerCount}
                        maxRaces={plannerMax}
                        onRaceCountChange={onPlannerCountChange}
                        data={plannerData}
                        players={new Map([...allDrivers, ...allConstructors].map((p) => [p.id, p]))}
                        teamIds={teamIds}
                        risk={risk}
                        addBlocker={addBlocker}
                        onAdd={onAdd}
                    />
                )}
            </div>
        </div>
    );
};

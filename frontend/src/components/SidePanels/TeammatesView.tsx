// src/components/SidePanels/TeammatesView.tsx
import React, { useState } from 'react';
import { COLOR_A, COLOR_B, CompareRow } from './CompareRow';
import type { CardItem, DriverInfo, TeammateStats } from '../../types/f1';

interface TeammatesViewProps {
    teammates: TeammateStats[];
    driverInfo: Map<string, DriverInfo>;
    constructors: CardItem[];
    defaultConstructorId?: string;
}

export const TeammatesView: React.FC<TeammatesViewProps> = ({ teammates, driverInfo, constructors, defaultConstructorId }) => {
    const [constructorId, setConstructorId] = useState('');
    const pair =
        teammates.find((t) => t.constructorId === constructorId) ??
        teammates.find((t) => t.constructorId === defaultConstructorId) ??
        teammates[0];
    if (!pair) return null;

    const [a, b] = pair.drivers.map((id) => driverInfo.get(id));
    const nameA = a?.name ?? 'Driver A';
    const nameB = b?.name ?? 'Driver B';
    const teams = constructors.filter((c) => teammates.some((t) => t.constructorId === c.id));

    const h2h = (label: string, [winsA, winsB]: [number, number]) => (
        <div className="h2h-row">
            <span className="h2h-label">{label}</span>
            <div className="h2h-score">
                <strong className={winsA >= winsB ? 'lead' : ''}>{winsA}</strong>
                <div className="h2h-bar">
                    <span style={{ flex: winsA || 0.001, backgroundColor: COLOR_A }} />
                    <span style={{ flex: winsB || 0.001, backgroundColor: COLOR_B }} />
                </div>
                <strong className={winsB >= winsA ? 'lead' : ''}>{winsB}</strong>
            </div>
        </div>
    );

    return (
        <div className="teammates-view">
            <div className="h2h-top">
                <select className="team-select" value={pair.constructorId} onChange={(e) => setConstructorId(e.target.value)}>
                    {teams.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <div className="h2h-names">
                    <span>
                        <i className="name-dot" style={{ backgroundColor: COLOR_A }} />
                        {nameA}
                    </span>
                    <span className="compare-vs">{pair.races} races together</span>
                    <span>
                        <i className="name-dot" style={{ backgroundColor: COLOR_B }} />
                        {nameB}
                    </span>
                </div>
            </div>

            <div className="compare-grid">
                {h2h('Qualifying head-to-head', pair.quali)}
                {h2h('Race head-to-head', pair.race)}
                <CompareRow label="Points together" a={pair.points[0]} b={pair.points[1]} format={(v) => `${v}`} />
                {pair.avgQuali[0] !== null && pair.avgQuali[1] !== null && (
                    <CompareRow
                        label="Avg quali"
                        a={pair.avgQuali[0]}
                        b={pair.avgQuali[1]}
                        format={(v) => `P${v}`}
                    />
                )}
                {pair.avgFinish[0] !== null && pair.avgFinish[1] !== null && (
                    <CompareRow
                        label="Avg finish"
                        a={pair.avgFinish[0]}
                        b={pair.avgFinish[1]}
                        format={(v) => `P${v}`}
                    />
                )}
                <CompareRow label="DNFs" a={pair.dnfs[0]} b={pair.dnfs[1]} format={(v) => `${v}`} />
            </div>
        </div>
    );
};

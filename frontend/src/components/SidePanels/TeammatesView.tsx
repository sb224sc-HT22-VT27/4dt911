// src/components/SidePanels/TeammatesView.tsx
import React, { useState } from 'react';
import { HexChart } from '../Charts/HexChart';
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
                <strong style={{ color: winsA >= winsB ? COLOR_A : undefined }}>{winsA}</strong>
                <div className="h2h-bar">
                    <span style={{ flex: winsA || 0.001, backgroundColor: COLOR_A }} />
                    <span style={{ flex: winsB || 0.001, backgroundColor: COLOR_B }} />
                </div>
                <strong style={{ color: winsB >= winsA ? COLOR_B : undefined }}>{winsB}</strong>
            </div>
        </div>
    );

    return (
        <div className="teammates-view">
            <select className="team-select" value={pair.constructorId} onChange={(e) => setConstructorId(e.target.value)}>
                {teams.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>

            <div className="h2h-names">
                <span style={{ color: COLOR_A }}>{nameA}</span>
                <span className="compare-vs">{pair.races} races together</span>
                <span style={{ color: COLOR_B }}>{nameB}</span>
            </div>

            {h2h('Qualifying head-to-head', pair.quali)}
            {h2h('Race head-to-head', pair.race)}

            {a?.ratings && b?.ratings && (
                <HexChart
                    series={[
                        { label: nameA, color: COLOR_A, values: a.ratings },
                        { label: nameB, color: COLOR_B, values: b.ratings },
                    ]}
                />
            )}

            <div className="compare-group">
                <CompareRow label="Points together" a={pair.points[0]} b={pair.points[1]} format={(v) => `${v}`} />
                {pair.avgQuali[0] !== null && pair.avgQuali[1] !== null && (
                    <CompareRow
                        label="Avg quali"
                        a={pair.avgQuali[0]}
                        b={pair.avgQuali[1]}
                        format={(v) => `P${v}`}
                        lowerIsBetter
                    />
                )}
                {pair.avgFinish[0] !== null && pair.avgFinish[1] !== null && (
                    <CompareRow
                        label="Avg finish"
                        a={pair.avgFinish[0]}
                        b={pair.avgFinish[1]}
                        format={(v) => `P${v}`}
                        lowerIsBetter
                    />
                )}
                <CompareRow label="DNFs" a={pair.dnfs[0]} b={pair.dnfs[1]} format={(v) => `${v}`} lowerIsBetter />
            </div>
        </div>
    );
};

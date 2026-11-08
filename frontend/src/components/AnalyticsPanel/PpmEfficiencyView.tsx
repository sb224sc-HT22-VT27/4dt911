// src/components/AnalyticsPanel/PpmEfficiencyView.tsx
import React, { useState } from 'react';
import { pointsFor, RISK_LABELS, type CardItem, type ItemKind, type Risk } from '../../types/f1';

interface PpmEfficiencyViewProps {
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    teamIds: Set<string>;
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
    onRemove: (id: string) => void;
}

const ppmOf = (item: CardItem, risk: Risk) => (item.price > 0 ? pointsFor(item, risk) / item.price : 0);

export const PpmEfficiencyView: React.FC<PpmEfficiencyViewProps> = ({
    allDrivers,
    allConstructors,
    teamIds,
    risk,
    addBlocker,
    onAdd,
    onRemove,
}) => {
    const [kind, setKind] = useState<ItemKind>('driver');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const items = (kind === 'driver' ? allDrivers : allConstructors)
        .map((item) => ({ item, ppm: ppmOf(item, risk) }))
        .sort((a, b) => b.ppm - a.ppm);
    const maxPpm = Math.max(...items.map((i) => i.ppm), 0.1);

    // Default to the best value pick that isn't in the team yet
    const selected =
        items.find((i) => i.item.id === selectedId) ?? items.find((i) => !teamIds.has(i.item.id)) ?? items[0];
    const inTeam = selected ? teamIds.has(selected.item.id) : false;
    const blocker = selected && !inTeam ? addBlocker(selected.item) : null;

    return (
        <div className="ppm-wrapper">
            <div className="ppm-toolbar">
                <div className="ppm-kind-toggle">
                    {(['driver', 'constructor'] as ItemKind[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            className={kind === k ? 'active' : ''}
                            onClick={() => {
                                setKind(k);
                                setSelectedId(null);
                            }}
                        >
                            {k === 'driver' ? 'Drivers' : 'Constructors'}
                        </button>
                    ))}
                </div>
                <span className="ppm-axis-hint">
                    {RISK_LABELS[risk]} points per €1M · click a bar
                </span>
            </div>

            {selected && (
                <div className="ppm-detail" style={{ borderColor: selected.item.avatarColor }}>
                    <span className="ppm-detail-dot" style={{ backgroundColor: selected.item.avatarColor }} />
                    <div className="ppm-detail-name">
                        <strong>{selected.item.name}</strong>
                        <span>{selected.item.kind === 'driver' ? selected.item.team : 'Constructor'}</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>€{selected.item.price}M</strong>
                        <span>Price</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>{pointsFor(selected.item, risk)}</strong>
                        <span>{RISK_LABELS[risk]} pts</span>
                    </div>
                    <div className="ppm-detail-stat">
                        <strong>{selected.ppm.toFixed(2)}</strong>
                        <span>Pts / €M</span>
                    </div>
                    {inTeam ? (
                        <button type="button" className="ppm-action remove" onClick={() => onRemove(selected.item.id)}>
                            Remove
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="ppm-action"
                            disabled={!!blocker}
                            title={blocker ?? ''}
                            onClick={() => onAdd(selected.item)}
                        >
                            {blocker ?? '+ Add to team'}
                        </button>
                    )}
                </div>
            )}

            <div className="ppm-bars">
                {items.map(({ item, ppm }) => {
                    const isTeam = teamIds.has(item.id);
                    const isSelected = selected?.item.id === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`ppm-col ${isTeam ? 'in-team' : ''} ${isSelected ? 'selected' : ''}`}
                            title={`${item.name}: ${ppm.toFixed(2)} pts/€M`}
                            onClick={() => setSelectedId(item.id)}
                        >
                            <span className="ppm-track">
                                <span className="ppm-val">{ppm.toFixed(1)}</span>
                                <span
                                    className="ppm-fill"
                                    style={{
                                        height: `${Math.max(2, (Math.max(ppm, 0) / maxPpm) * 100)}%`,
                                        backgroundColor: item.avatarColor,
                                    }}
                                />
                            </span>
                            <span className="ppm-code">{item.code}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

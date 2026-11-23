// src/components/TeamPanel/TeamPanel.tsx
import React, { useState } from 'react';
import { PickerModal } from './PickerModal';
import { TeamBadge } from './TeamBadge';
import { linkClass, pointsFor, type CardItem, type PlayerLink, type ItemKind, type Params } from '../../types/f1';
import './TeamPanel.css';

interface TeamPanelProps {
    budgetRow: React.ReactNode; // budget pill + clear button, shown under the title
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    remainingBudget: number;
    params: Params;
    drsId: string | null;
    link: PlayerLink;
    replacingOutId: string | null;
    candidate: CardItem | null;
    onReplace: (kind: ItemKind, slot: number, outId: string) => void;
    onToggleDrs: (id: string) => void;
    onSelect: (kind: ItemKind, slot: number, item: CardItem) => void;
    onRemove: (id: string) => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
    budgetRow,
    drivers,
    constructors,
    allDrivers,
    allConstructors,
    remainingBudget,
    params,
    drsId,
    link,
    replacingOutId,
    candidate,
    onReplace,
    onToggleDrs,
    onSelect,
    onRemove,
}) => {
    const [picker, setPicker] = useState<{ kind: ItemKind; slot: number } | null>(null);
    const risk = params.risk;

    const selectedIds = new Set([...drivers, ...constructors].filter(Boolean).map((i) => i!.id));

    const renderRow = (item: CardItem | null, kind: ItemKind, slot: number) => {
        if (!item) {
            return (
                <button
                    key={`${kind}-slot-${slot}`}
                    type="button"
                    className="team-row team-row-empty"
                    onClick={() => setPicker({ kind, slot })}
                >
                    + Add {kind}
                </button>
            );
        }
        const isDrs = item.id === drsId;
        return (
            <div
                key={item.id}
                className={`team-row ${linkClass(link, item.id)} ${isDrs ? 'is-drs' : ''} ${item.id === replacingOutId ? 'is-replacing' : ''}`}
                onClick={(e) => link.onPick(item.id, e)}
                onMouseEnter={() => link.onHover(item.id)}
                onMouseLeave={() => link.onHover(null)}
            >
                <TeamBadge item={item} />
                <span className="team-row-name" title={item.id === replacingOutId && candidate ? `${item.name} → ${candidate.name}` : item.name}>
                    {item.id === replacingOutId && candidate ? `${item.name} → ${candidate.name}` : item.name}
                </span>
                <span className="team-row-price">
                    €{item.id === replacingOutId && candidate ? candidate.price : item.price}M
                </span>
                <span className={`team-row-pts risk-${risk}`} title="Expected points for the chosen risk">
                    {pointsFor(item.id === replacingOutId && candidate ? candidate : item, risk)}
                </span>
                {kind === 'driver' ? (
                    <button
                        type="button"
                        className={`drs-btn ${isDrs ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleDrs(item.id);
                        }}
                        title={isDrs ? 'Remove DRS Boost' : 'Give DRS Boost (2x points)'}
                    >
                        DRS
                    </button>
                ) : (
                    <span className="drs-btn-space" />
                )}
                <button
                    type="button"
                    className="row-replace-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReplace(kind, slot, item.id);
                    }}
                    title="Replace this player"
                    aria-label="Replace"
                >
                    ⇄
                </button>
                <button
                    type="button"
                    className="row-remove-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                    }}
                    aria-label="Remove"
                >
                    ✕
                </button>
            </div>
        );
    };

    return (
        <div className="team-workspace">
            <h3 className="side-title">My Team</h3>
            {budgetRow}
            <div className="team-rows">
                {drivers.map((d, i) => renderRow(d, 'driver', i))}
                <div className="team-rows-gap" />
                {constructors.map((c, i) => renderRow(c, 'constructor', i))}
            </div>

            {picker && (
                <PickerModal
                    type={picker.kind}
                    items={picker.kind === 'driver' ? allDrivers : allConstructors}
                    selectedIds={selectedIds}
                    remainingBudget={remainingBudget}
                    risk={risk}
                    onSelect={(item) => {
                        onSelect(picker.kind, picker.slot, item);
                        setPicker(null);
                    }}
                    onClose={() => setPicker(null)}
                />
            )}
        </div>
    );
};

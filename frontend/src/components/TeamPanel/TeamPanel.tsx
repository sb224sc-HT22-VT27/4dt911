// src/components/TeamPanel/TeamPanel.tsx
import React, { useState } from 'react';
import { F1Card } from '../F1Card/F1Card';
import { PickerModal } from './PickerModal';
import { BudgetPill } from './BudgetPill';
import type { CardItem, ItemKind, Params } from '../../types/f1';
import './TeamPanel.css';

interface TeamPanelProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    budget: number;
    remainingBudget: number;
    onBudgetChange: (budget: number) => void;
    params: Params;
    onClearTeam: () => void;
    drsId: string | null;
    onToggleDrs: (id: string) => void;
    onSelect: (kind: ItemKind, slot: number, item: CardItem) => void;
    onRemove: (id: string) => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
    drivers,
    constructors,
    allDrivers,
    allConstructors,
    budget,
    remainingBudget,
    onBudgetChange,
    params,
    onClearTeam,
    drsId,
    onToggleDrs,
    onSelect,
    onRemove,
}) => {
    const [picker, setPicker] = useState<{ kind: ItemKind; slot: number } | null>(null);
    const risk = params.risk;

    const selectedIds = new Set([...drivers, ...constructors].filter(Boolean).map((i) => i!.id));

    return (
        <div className="team-workspace">
            <div className="team-header-bar">
                <h2 className="team-title">My Team</h2>

                <div className="team-header-actions">
                    <BudgetPill totalBudget={budget} remainingBudget={remainingBudget} onBudgetChange={onBudgetChange} />
                    <button type="button" className="clear-team-btn" onClick={onClearTeam}>
                        Clear team
                    </button>
                </div>
            </div>

            <div className="team-grid-5">
                {drivers.map((driver, index) => (
                    <F1Card
                        key={driver ? driver.id : `driver-slot-${index}`}
                        item={driver ?? undefined}
                        type="driver"
                        slotIndex={index}
                        risk={risk}
                        isDrs={!!driver && driver.id === drsId}
                        onToggleDrs={onToggleDrs}
                        onRemove={onRemove}
                        onAdd={(slot, kind) => setPicker({ slot, kind })}
                    />
                ))}
            </div>

            <div className="team-grid-2">
                {constructors.map((c, index) => (
                    <F1Card
                        key={c ? c.id : `constructor-slot-${index}`}
                        item={c ?? undefined}
                        type="constructor"
                        slotIndex={index}
                        risk={risk}
                        onRemove={onRemove}
                        onAdd={(slot, kind) => setPicker({ slot, kind })}
                    />
                ))}
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

// src/components/TeamPanel/TeamPanel.tsx
import React, { useState } from 'react';
import { F1Card } from '../F1Card/F1Card';
import { TeamHeader } from './TeamHeader';
import { PickerModal } from './PickerModal';
import { RISK_LABELS, type CardItem, type ItemKind, type Params } from '../../types/f1';
import './TeamPanel.css';

interface TeamPanelProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    budget: number;
    remainingBudget: number;
    params: Params;
    onBudgetChange: (budget: number) => void;
    onSelect: (kind: ItemKind, slot: number, item: CardItem) => void;
    onRemove: (id: string) => void;
    onOptimize: () => string;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
    drivers,
    constructors,
    allDrivers,
    allConstructors,
    budget,
    remainingBudget,
    params,
    onBudgetChange,
    onSelect,
    onRemove,
    onOptimize,
}) => {
    const [picker, setPicker] = useState<{ kind: ItemKind; slot: number } | null>(null);
    const [message, setMessage] = useState('');
    const risk = params.risk;

    const selectedIds = new Set([...drivers, ...constructors].filter(Boolean).map((i) => i!.id));

    return (
        <div className="team-workspace">
            <TeamHeader totalBudget={budget} remainingBudget={remainingBudget} onBudgetChange={onBudgetChange} />

            <div className="team-grid-5">
                {drivers.map((driver, index) => (
                    <F1Card
                        key={driver ? driver.id : `driver-slot-${index}`}
                        item={driver ?? undefined}
                        type="driver"
                        slotIndex={index}
                        risk={risk}
                        onRemove={onRemove}
                        onAdd={(slot, kind) => setPicker({ slot, kind })}
                    />
                ))}
            </div>

            <div className="team-grid-5">
                {constructors.map((c, index) => (
                    <div key={c ? c.id : `constructor-slot-${index}`} className="constructor-span-2">
                        <F1Card
                            item={c ?? undefined}
                            type="constructor"
                            slotIndex={index}
                            risk={risk}
                            onRemove={onRemove}
                            onAdd={(slot, kind) => setPicker({ slot, kind })}
                        />
                    </div>
                ))}

                <div className="team-actions-col">
                    <span className="risk-label">Optimizer</span>
                    <div className="optimize-summary">
                        <span className={`summary-risk risk-${risk}`}>{RISK_LABELS[risk]}</span>
                        <span>
                            Form {params.formWeight}% · Track {params.trackWeight}% · DNF {params.dnfWeight}%
                        </span>
                    </div>
                    <button type="button" className="optimize-btn" onClick={() => setMessage(onOptimize())}>
                        Optimize
                    </button>
                    <span className="optimize-msg">{message || 'Change settings in the top right'}</span>
                </div>
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

// src/components/TeamPanel/TeamPanel.tsx
import React, { useState } from 'react';
import { F1Card } from '../F1Card/F1Card';
import { PickerModal } from './PickerModal';
import { RISK_LABELS, type CardItem, type ItemKind, type OptimizerMode, type Params } from '../../types/f1';
import './TeamPanel.css';

interface TeamPanelProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    remainingBudget: number;
    params: Params;
    drsId: string | null;
    optimizerMode: OptimizerMode;
    onModeChange: (mode: OptimizerMode) => void;
    onToggleDrs: (id: string) => void;
    onSelect: (kind: ItemKind, slot: number, item: CardItem) => void;
    onRemove: (id: string) => void;
    onOptimize: () => Promise<string>;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
    drivers,
    constructors,
    allDrivers,
    allConstructors,
    remainingBudget,
    params,
    drsId,
    optimizerMode,
    onModeChange,
    onToggleDrs,
    onSelect,
    onRemove,
    onOptimize,
}) => {
    const [picker, setPicker] = useState<{ kind: ItemKind; slot: number } | null>(null);
    const [message, setMessage] = useState('');
    const [optimizing, setOptimizing] = useState(false);
    const risk = params.risk;

    const selectedIds = new Set([...drivers, ...constructors].filter(Boolean).map((i) => i!.id));

    const handleOptimize = async () => {
        setOptimizing(true);
        setMessage(await onOptimize());
        setOptimizing(false);
    };

    return (
        <div className="team-workspace">
            <div className="team-header-bar">
                <h2 className="team-title">My Team</h2>
                <span className="team-hint">Click + to add a player, i for details, DRS for 2x points</span>
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
                    <div className="mode-toggle">
                        {(['best', 'transfers'] as OptimizerMode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                className={optimizerMode === m ? 'active' : ''}
                                onClick={() => {
                                    onModeChange(m);
                                    setMessage('');
                                }}
                            >
                                {m === 'best' ? 'Best team' : 'Transfers'}
                            </button>
                        ))}
                    </div>
                    <div className="optimize-summary">
                        <span className={`summary-risk risk-${risk}`}>{RISK_LABELS[risk]}</span>
                        <span>
                            Form {params.form}% · Track {params.track}% · DNF {params.dnf}%
                        </span>
                    </div>
                    <button type="button" className="optimize-btn" onClick={handleOptimize} disabled={optimizing}>
                        {optimizing ? 'Working…' : optimizerMode === 'best' ? 'Optimize' : 'Suggest transfers'}
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

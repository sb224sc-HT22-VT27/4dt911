// src/components/TeamPanel/TeamPanel.tsx
import React, { useState } from 'react';
import { F1Card } from '../F1Card/F1Card';
import { PickerModal } from './PickerModal';
import type { CardItem, ItemKind, OptimizerMode, Params } from '../../types/f1';
import './TeamPanel.css';

interface TeamPanelProps {
    drivers: (CardItem | null)[];
    constructors: (CardItem | null)[];
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    remainingBudget: number;
    params: Params;
    onClearTeam: () => void;
    drsId: string | null;
    optimizerMode: OptimizerMode;
    freeTransfers: number;
    onModeChange: (mode: OptimizerMode) => void;
    onFreeTransfersChange: (value: number) => void;
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
    onClearTeam,
    drsId,
    optimizerMode,
    freeTransfers,
    onModeChange,
    onFreeTransfersChange,
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

                <div className="optimizer-bar">
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

                    {optimizerMode === 'transfers' && (
                        <div className="free-transfers" title="Each transfer beyond the free ones costs 10 pts">
                            <span>Free</span>
                            <div className="stepper">
                                <button
                                    type="button"
                                    disabled={freeTransfers <= 0}
                                    onClick={() => onFreeTransfersChange(freeTransfers - 1)}
                                >
                                    −
                                </button>
                                <strong>{freeTransfers}</strong>
                                <button
                                    type="button"
                                    disabled={freeTransfers >= 7}
                                    onClick={() => onFreeTransfersChange(freeTransfers + 1)}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    <button type="button" className="optimize-btn" onClick={handleOptimize} disabled={optimizing}>
                        {optimizing ? 'Working…' : optimizerMode === 'best' ? 'Optimize team' : 'Suggest transfers'}
                    </button>
                    <span className="optimize-msg">{message}</span>
                </div>

                <button type="button" className="clear-team-btn" onClick={onClearTeam}>
                    Clear team
                </button>
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

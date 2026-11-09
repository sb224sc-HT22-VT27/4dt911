// src/components/SidePanels/TransfersPanel.tsx
import React from 'react';
import type { CardItem, OptimizeResult } from '../../types/f1';
import './SidePanels.css';

interface TransfersPanelProps {
    freeTransfers: number;
    penalty: number;
    suggestion: OptimizeResult | null;
    players: Map<string, CardItem>;
    onFreeTransfersChange: (value: number) => void;
    onPenaltyChange: (value: number) => void;
    onApply: () => void;
    onDismiss: () => void;
}

const Stepper: React.FC<{ value: number; min: number; max: number; step?: number; onChange: (v: number) => void }> = ({
    value,
    min,
    max,
    step = 1,
    onChange,
}) => (
    <div className="stepper">
        <button type="button" disabled={value <= min} onClick={() => onChange(value - step)}>
            −
        </button>
        <strong>{value}</strong>
        <button type="button" disabled={value >= max} onClick={() => onChange(value + step)}>
            +
        </button>
    </div>
);

export const TransfersPanel: React.FC<TransfersPanelProps> = ({
    freeTransfers,
    penalty,
    suggestion,
    players,
    onFreeTransfersChange,
    onPenaltyChange,
    onApply,
    onDismiss,
}) => {
    const name = (id: string | null) => (id ? players.get(id)?.name ?? id : 'Empty slot');
    const moves = suggestion?.transfers ?? [];

    return (
        <div className="transfers">
            <span className="share-title">Transfers</span>
            <div className="transfer-settings">
                <label>
                    Free transfers
                    <Stepper value={freeTransfers} min={0} max={7} onChange={onFreeTransfersChange} />
                </label>
                <label>
                    Penalty per extra
                    <Stepper value={penalty} min={0} max={30} step={5} onChange={onPenaltyChange} />
                </label>
            </div>

            {!suggestion && <p className="side-empty">Press "Suggest transfers" to get the best moves for your team.</p>}

            {suggestion && moves.length === 0 && (
                <p className="side-empty">Your team is already the best option with these settings.</p>
            )}

            {suggestion && moves.length > 0 && (
                <div className="transfer-suggestion">
                    {moves.map((m) => (
                        <div key={m.in} className="transfer-move">
                            <span className="move-out">{name(m.out)}</span>
                            <span className="move-arrow">→</span>
                            <span className="move-in">{name(m.in)}</span>
                        </div>
                    ))}
                    <div className="transfer-result">
                        <span>
                            {moves.length} transfer{moves.length > 1 ? 's' : ''}
                            {suggestion.penaltyPoints ? ` · −${suggestion.penaltyPoints} pts penalty` : ' · no penalty'}
                        </span>
                        <strong>
                            {suggestion.currentPoints} → {suggestion.points} pts
                        </strong>
                    </div>
                    <div className="transfer-actions">
                        <button type="button" className="apply" onClick={onApply}>
                            Apply transfers
                        </button>
                        <button type="button" onClick={onDismiss}>
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

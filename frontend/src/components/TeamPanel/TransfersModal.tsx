// src/components/TeamPanel/TransfersModal.tsx
import React from 'react';
import { pointsFor, RISK_LABELS, type CardItem, type OptimizeResult, type Risk } from '../../types/f1';

interface TransfersModalProps {
    suggestion: OptimizeResult;
    freeTransfers: number;
    players: Map<string, CardItem>;
    risk: Risk;
    onApply: () => void;
    onClose: () => void;
}

const PlayerCell: React.FC<{ player?: CardItem; risk: Risk; empty?: boolean }> = ({ player, risk, empty }) =>
    empty || !player ? (
        <div className="move-player empty">Empty slot</div>
    ) : (
        <div className="move-player">
            <span className="picker-color-strip" style={{ backgroundColor: player.avatarColor }} />
            <div>
                <strong>{player.name}</strong>
                <span>
                    €{player.price}M · {pointsFor(player, risk)} {RISK_LABELS[risk].toLowerCase()} pts
                </span>
            </div>
        </div>
    );

export const TransfersModal: React.FC<TransfersModalProps> = ({
    suggestion,
    freeTransfers,
    players,
    risk,
    onApply,
    onClose,
}) => {
    const moves = suggestion.transfers ?? [];
    const extra = Math.max(0, moves.length - freeTransfers);

    return (
        <div className="picker-overlay" onClick={onClose}>
            <div className="picker-dialog transfers-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="picker-header">
                    <div>
                        <h3>Suggested transfers</h3>
                        <span className="picker-budget-hint">
                            {freeTransfers} free transfer{freeTransfers === 1 ? '' : 's'} · each extra costs 10 pts
                        </span>
                    </div>
                    <button type="button" className="picker-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {moves.length === 0 ? (
                    <p className="transfers-empty">Your current team is already the best option. No transfers needed.</p>
                ) : (
                    <div className="transfer-moves">
                        {moves.map((m) => (
                            <div key={m.in} className="transfer-move">
                                <span className="move-tag out">OUT</span>
                                <PlayerCell player={m.out ? players.get(m.out) : undefined} risk={risk} empty={!m.out} />
                                <span className="move-arrow">→</span>
                                <span className="move-tag in">IN</span>
                                <PlayerCell player={players.get(m.in)} risk={risk} />
                            </div>
                        ))}
                    </div>
                )}

                <div className="transfer-summary">
                    <div>
                        <span>Transfers</span>
                        <strong>
                            {moves.length}
                            {extra > 0 && <small> ({extra} extra)</small>}
                        </strong>
                    </div>
                    <div>
                        <span>Penalty</span>
                        <strong className={suggestion.penaltyPoints ? 'negative' : ''}>
                            {suggestion.penaltyPoints ? `−${suggestion.penaltyPoints}` : '0'} pts
                        </strong>
                    </div>
                    <div>
                        <span>Team points</span>
                        <strong>
                            {suggestion.currentPoints} → {suggestion.points}
                        </strong>
                    </div>
                </div>

                <div className="transfer-actions">
                    <button type="button" className="apply" onClick={onApply} disabled={moves.length === 0}>
                        Apply transfers
                    </button>
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

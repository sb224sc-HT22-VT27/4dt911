// src/components/TeamPanel/TransfersModal.tsx
import React, { useState } from 'react';
import {
    pointsFor,
    RISK_LABELS,
    type CardItem,
    type OptimizeResult,
    type Risk,
    type TransferPlans,
} from '../../types/f1';

interface TransfersModalProps {
    freeTransfers: number;
    plans: TransferPlans | null;
    players: Map<string, CardItem>;
    risk: Risk;
    onFreeTransfersChange: (value: number) => void;
    onApply: (plan: OptimizeResult) => void;
    onClose: () => void;
}

const MAX_FREE = 3;

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const TransfersModal: React.FC<TransfersModalProps> = ({
    freeTransfers,
    plans,
    players,
    risk,
    onFreeTransfersChange,
    onApply,
    onClose,
}) => {
    const [view, setView] = useState<'best' | 'free'>('best');
    const loading = !plans || plans.free !== freeTransfers;
    const best = plans?.best ?? null;
    const freeOnly = plans?.freeOnly ?? null;

    const bestCount = best?.transfers?.length ?? 0;
    const extra = Math.max(0, bestCount - freeTransfers);
    const plansDiffer = !!best && !!freeOnly && extra > 0;
    const shown = view === 'free' && plansDiffer ? freeOnly : best;
    const moves = shown?.transfers ?? [];
    const shownExtra = Math.max(0, moves.length - freeTransfers);

    // What the comparison between the two plans says
    let advice = '';
    if (best && !loading) {
        if (bestCount === 0) advice = 'Your team is already the best option. No transfers needed.';
        else if (plansDiffer)
            advice = `Make ${plural(extra, 'extra transfer')}: it costs −${extra * 10} pts but still gains +${(best.points - freeOnly!.points).toFixed(1)} pts compared with using only your free transfers.`;
        else if (bestCount <= freeTransfers)
            advice = `Use ${plural(bestCount, 'free transfer')}. Extra transfers would cost more than they gain.`;
    }

    return (
        <div className="picker-overlay" onClick={onClose}>
            <div className="picker-dialog transfers-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="picker-header">
                    <div>
                        <h3>Suggest transfers</h3>
                        <span className="picker-budget-hint">Each transfer beyond your free ones costs 10 pts</span>
                    </div>
                    <button type="button" className="picker-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="free-picker">
                    <span>How many free transfers do you have?</span>
                    <div className="free-options">
                        {Array.from({ length: MAX_FREE + 1 }, (_, n) => (
                            <button
                                key={n}
                                type="button"
                                className={freeTransfers === n ? 'active' : ''}
                                onClick={() => {
                                    onFreeTransfersChange(n);
                                    setView('best');
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <p className="transfers-empty">Finding the best transfers…</p>
                ) : !best ? (
                    <p className="transfers-empty">No team fits your budget with these settings.</p>
                ) : (
                    <>
                        {advice && <p className={`transfer-advice ${plansDiffer ? 'extra' : ''}`}>{advice}</p>}

                        {plansDiffer && (
                            <div className="plan-toggle">
                                <button type="button" className={view === 'best' ? 'active' : ''} onClick={() => setView('best')}>
                                    Recommended · {plural(bestCount, 'transfer')}
                                </button>
                                <button type="button" className={view === 'free' ? 'active' : ''} onClick={() => setView('free')}>
                                    Free only · {plural(freeOnly!.transfers?.length ?? 0, 'transfer')}
                                </button>
                            </div>
                        )}

                        {moves.length > 0 && (
                            <div className="transfer-moves">
                                {moves.map((m, i) => (
                                    <div key={m.in} className={`transfer-move ${i >= freeTransfers ? 'paid' : ''}`}>
                                        <span className="move-tag out">OUT</span>
                                        <PlayerCell player={m.out ? players.get(m.out) : undefined} risk={risk} empty={!m.out} />
                                        <span className="move-arrow">→</span>
                                        <span className="move-tag in">IN</span>
                                        <PlayerCell player={players.get(m.in)} risk={risk} />
                                        <span className="move-cost">{i >= freeTransfers ? '−10' : 'Free'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="transfer-summary">
                            <div>
                                <span>Transfers</span>
                                <strong>
                                    {moves.length}
                                    {shownExtra > 0 && <small> ({shownExtra} extra)</small>}
                                </strong>
                            </div>
                            <div>
                                <span>Penalty</span>
                                <strong className={shown?.penaltyPoints ? 'negative' : ''}>
                                    {shown?.penaltyPoints ? `−${shown.penaltyPoints}` : '0'} pts
                                </strong>
                            </div>
                            <div>
                                <span>Team points</span>
                                <strong>
                                    {shown?.currentPoints} → {shown?.points}
                                </strong>
                            </div>
                        </div>

                        <p className="transfer-note">
                            The −10s are only used to decide if extra transfers are worth it. After you apply, your team
                            totals show the normal points without any penalty.
                        </p>
                    </>
                )}

                <div className="transfer-actions">
                    <button
                        type="button"
                        className="apply"
                        onClick={() => shown && onApply(shown)}
                        disabled={loading || !shown || moves.length === 0}
                    >
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

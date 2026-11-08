// src/components/SidePanels/TeamSummary.tsx
import React from 'react';
import { BudgetPill } from './BudgetPill';
import { RISK_LABELS, type CardItem, type Risk, type TeamEvaluation } from '../../types/f1';
import './SidePanels.css';

interface TeamSummaryProps {
    team: CardItem[];
    evaluation: TeamEvaluation | null;
    budget: number;
    remainingBudget: number;
    risk: Risk;
    onBudgetChange: (budget: number) => void;
}

const RISKS: Risk[] = ['floor', 'expected', 'ceiling'];

export const TeamSummary: React.FC<TeamSummaryProps> = ({
    team,
    evaluation,
    budget,
    remainingBudget,
    risk,
    onBudgetChange,
}) => {
    const byId = new Map(team.map((i) => [i.id, i]));
    const maxShare = Math.max(1, ...(evaluation?.players.map((p) => p.share) ?? []));

    return (
        <div className="side-panel">
            <h3 className="side-title">Team info</h3>

            <BudgetPill totalBudget={budget} remainingBudget={remainingBudget} onBudgetChange={onBudgetChange} />

            <div className="stat-tiles">
                {RISKS.map((r) => (
                    <div key={r} className={`stat-tile risk-${r} ${risk === r ? 'active' : ''}`}>
                        <span className="stat-tile-label">{RISK_LABELS[r]}</span>
                        <strong>{evaluation ? evaluation[r] : '–'}</strong>
                    </div>
                ))}
            </div>

            <div className="summary-meta">
                <span>
                    Team value <strong>€{evaluation?.cost ?? 0}M</strong>
                </span>
                <span>
                    Players <strong>{team.length} / 7</strong>
                </span>
            </div>

            <div className="share-list">
                <span className="share-title">Share of {RISK_LABELS[risk].toLowerCase()} points</span>
                {evaluation?.players.length ? (
                    evaluation.players.map((p) => {
                        const item = byId.get(p.id);
                        if (!item) return null;
                        return (
                            <div key={p.id} className="share-row">
                                <span className="share-dot" style={{ backgroundColor: item.avatarColor }} />
                                <span className="share-name">{item.name}</span>
                                <span className="share-points">{p.points}</span>
                                <span className="share-bar">
                                    <span style={{ width: `${(p.share / maxShare) * 100}%`, backgroundColor: item.avatarColor }} />
                                </span>
                                <span className="share-pct">{p.share}%</span>
                            </div>
                        );
                    })
                ) : (
                    <p className="side-empty">No players picked yet.</p>
                )}
            </div>
        </div>
    );
};

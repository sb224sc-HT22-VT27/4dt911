// src/components/TeamPanel/TeamHeader.tsx
import React, { useState } from 'react';

interface TeamHeaderProps {
    totalBudget: number;
    remainingBudget: number;
    onBudgetChange: (newBudget: number) => void;
}

export const TeamHeader: React.FC<TeamHeaderProps> = ({
    totalBudget,
    remainingBudget,
    onBudgetChange,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(totalBudget.toString());
    const isOverBudget = remainingBudget < 0;

    const saveBudget = () => {
        const parsed = parseFloat(tempValue);
        if (!isNaN(parsed) && parsed > 0) {
            onBudgetChange(Number(parsed.toFixed(1)));
        } else {
            setTempValue(totalBudget.toString());
        }
        setIsEditing(false);
    };

    return (
        <div className="team-header-bar">
            <h2 className="team-title">My Team</h2>

            <div className={`budget-pill-container ${isOverBudget ? 'budget-warning' : ''}`}>
                <div className="budget-meta">
                    <span className="budget-label">
                        {isOverBudget ? '⚠️ OVER BUDGET' : 'BUDGET REMAINING'}
                    </span>
                    <div className="budget-values">
                        <strong className={`budget-rem-val ${isOverBudget ? 'rem-negative' : 'rem-positive'}`}>
                            €{remainingBudget}M
                        </strong>
                        <span className="budget-slash">/</span>
                        {isEditing ? (
                            <div className="budget-edit-wrapper">
                                <span>€</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    autoFocus
                                    className="budget-input"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={saveBudget}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveBudget();
                                        if (e.key === 'Escape') setIsEditing(false);
                                    }}
                                />
                                <span>M</span>
                            </div>
                        ) : (
                            <span className="budget-total-val" onClick={() => setIsEditing(true)}>
                                €{totalBudget.toFixed(1)}M
                                <button type="button" className="budget-edit-icon" title="Edit budget">✎</button>
                            </span>
                        )}
                    </div>
                </div>
                {isOverBudget && (
                    <div className="budget-alert-badge">
                        Exceeds by €{Math.abs(remainingBudget).toFixed(1)}M
                    </div>
                )}
            </div>
        </div>
    );
};
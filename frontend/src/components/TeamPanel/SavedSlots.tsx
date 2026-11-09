// src/components/TeamPanel/SavedSlots.tsx
import React from 'react';
import { RISK_LABELS, type Risk, type SavedTeam, type TeamEvaluation } from '../../types/f1';

interface SavedSlotsProps {
    slots: (SavedTeam | null)[];
    evaluations: (TeamEvaluation | null)[];
    activeSlot: number | null;
    risk: Risk;
    onSave: (slot: number) => void;
    onLoad: (slot: number) => void;
}

export const SavedSlots: React.FC<SavedSlotsProps> = ({ slots, evaluations, activeSlot, risk, onSave, onLoad }) => (
    <div className="saved-slots">
        {slots.map((slot, i) => {
            const evaluation = evaluations[i];
            return (
                <div key={i} className={`saved-slot ${slot ? '' : 'empty'} ${activeSlot === i ? 'active' : ''}`}>
                    <button
                        type="button"
                        className="slot-load"
                        disabled={!slot}
                        onClick={() => onLoad(i)}
                        title={slot ? 'Load this team' : 'Empty slot'}
                    >
                        <span className="slot-name">Team {i + 1}</span>
                        <span className="slot-points">
                            {slot && evaluation
                                ? `${evaluation[risk]} ${RISK_LABELS[risk].toLowerCase()} pts · €${evaluation.cost}M`
                                : 'Empty'}
                        </span>
                    </button>
                    <button type="button" className="slot-save" onClick={() => onSave(i)} title="Save current team here">
                        Save
                    </button>
                </div>
            );
        })}
    </div>
);

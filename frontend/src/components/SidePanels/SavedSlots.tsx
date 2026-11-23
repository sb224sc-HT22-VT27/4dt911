// src/components/SidePanels/SavedSlots.tsx
import React, { useState } from 'react';
import { RISK_LABELS, type Risk, type SavedTeam, type TeamEvaluation } from '../../types/f1';
import './SidePanels.css';

interface SavedSlotsProps {
    slots: (SavedTeam | null)[];
    evaluations: (TeamEvaluation | null)[];
    activeSlot: number | null;
    risk: Risk;
    onSave: (slot: number) => void;
    onLoad: (slot: number) => void;
    onDelete: (slot: number) => void;
}

export const SavedSlots: React.FC<SavedSlotsProps> = ({ slots, evaluations, activeSlot, risk, onSave, onLoad, onDelete }) => {
    const [selected, setSelected] = useState(0);
    const slot = slots[selected];

    return (
        <div className="saved-slots">
            <h3 className="side-title">Saved teams</h3>
            <div className="saved-row">
                <select
                    className={`saved-select ${activeSlot === selected ? 'active' : ''}`}
                    value={selected}
                    onChange={(e) => setSelected(Number(e.target.value))}
                    title={`Points for ${RISK_LABELS[risk].toLowerCase()}`}
                >
                    {slots.map((s, i) => (
                        <option key={i} value={i}>
                            Team {i + 1} · {s && evaluations[i] ? `${evaluations[i]![risk]} pts` : 'Empty'}
                        </option>
                    ))}
                </select>
                <button type="button" className="saved-btn save" onClick={() => onSave(selected)} title="Save current team here">
                    Save
                </button>
                <button type="button" className="saved-btn" disabled={!slot} onClick={() => onLoad(selected)}>
                    Load
                </button>
                <button type="button" className="saved-btn delete" disabled={!slot} onClick={() => onDelete(selected)}>
                    Delete
                </button>
            </div>
        </div>
    );
};

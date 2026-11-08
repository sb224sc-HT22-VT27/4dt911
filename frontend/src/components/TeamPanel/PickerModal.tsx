// src/components/TeamPanel/PickerModal.tsx
import React from 'react';
import { pointsFor, RISK_LABELS, type CardItem, type ItemKind, type Risk } from '../../types/f1';

interface PickerModalProps {
    type: ItemKind;
    items: CardItem[];
    selectedIds: Set<string>;
    remainingBudget: number;
    risk: Risk;
    onSelect: (item: CardItem) => void;
    onClose: () => void;
}

export const PickerModal: React.FC<PickerModalProps> = ({
    type,
    items,
    selectedIds,
    remainingBudget,
    risk,
    onSelect,
    onClose,
}) => {
    const sorted = [...items].sort((a, b) => pointsFor(b, risk) - pointsFor(a, risk));

    return (
        <div className="picker-overlay" onClick={onClose}>
            <div className="picker-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="picker-header">
                    <div>
                        <h3>Select a {type === 'driver' ? 'Driver' : 'Constructor'}</h3>
                        <span className="picker-budget-hint">
                            Available budget: <strong>€{remainingBudget}M</strong> · sorted by {RISK_LABELS[risk].toLowerCase()}
                        </span>
                    </div>
                    <button type="button" className="picker-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="picker-list">
                    {sorted.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        const isTooExpensive = item.price > remainingBudget;
                        const isDisabled = isSelected || isTooExpensive;

                        return (
                            <div
                                key={item.id}
                                className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                onClick={() => !isDisabled && onSelect(item)}
                            >
                                <span className="picker-color-strip" style={{ backgroundColor: item.avatarColor }} />
                                <div className="picker-meta">
                                    <strong>{item.name}</strong>
                                    <span>{type === 'driver' ? `${item.team} · #${item.number}` : item.code}</span>
                                </div>
                                <div className="picker-stats">
                                    <span className={isTooExpensive ? 'stat-price-over' : ''}>€{item.price}M</span>
                                    <span>
                                        {item.floor} / <b>{item.expectedPoints}</b> / {item.ceiling}
                                    </span>
                                </div>
                                <button type="button" className="picker-select-btn" disabled={isDisabled}>
                                    {isSelected ? 'In Team' : isTooExpensive ? 'Over Budget' : 'Select'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

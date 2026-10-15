// src/components/TeamPanel/PickerModal.tsx
import React from 'react';
import { type Driver, type Constructor, type CardItem } from '../../types/f1';

interface PickerModalProps {
    isOpen: boolean;
    type: 'driver' | 'constructor';
    remainingBudget: number;
    selectedIds: Set<string>;
    drivers: Driver[];
    constructors: Constructor[];
    onSelect: (item: CardItem) => void;
    onClose: () => void;
}

export const PickerModal: React.FC<PickerModalProps> = ({
    isOpen,
    type,
    remainingBudget,
    selectedIds,
    drivers,
    constructors,
    onSelect,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="picker-overlay" onClick={onClose}>
            <div className="picker-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="picker-header">
                    <div>
                        <h3>Select a {type === 'driver' ? 'Driver' : 'Constructor'}</h3>
                        <span className="picker-budget-hint">
                            Available Budget: <strong>€{remainingBudget}M</strong>
                        </span>
                    </div>
                    <button type="button" className="picker-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="picker-list">
                    {type === 'driver'
                        ? drivers.map((d) => {
                            const isSelected = selectedIds.has(d.id);
                            const isTooExpensive = d.price > remainingBudget;
                            const isDisabled = isSelected || isTooExpensive;

                            return (
                                <div
                                    key={d.id}
                                    className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                    onClick={() => {
                                        if (!isDisabled) {
                                            onSelect({
                                                id: d.id,
                                                name: d.name,
                                                number: d.number,
                                                team: d.team,
                                                price: d.price,
                                                ownership: d.ownership,
                                                expectedPoints: d.predictedPoints,
                                                avatarColor: d.avatarColor,
                                            });
                                        }
                                    }}
                                >
                                    <span className="picker-color-strip" style={{ backgroundColor: d.avatarColor }} />
                                    <div className="picker-meta">
                                        <strong>{d.name}</strong>
                                        <span>{d.team} (#{d.number})</span>
                                    </div>
                                    <div className="picker-stats">
                                        <span className={isTooExpensive ? 'stat-price-over' : ''}>€{d.price}M</span>
                                        <span>{d.predictedPoints} pts</span>
                                    </div>
                                    <button type="button" className="picker-select-btn" disabled={isDisabled}>
                                        {isSelected ? 'In Team' : isTooExpensive ? 'Over Budget' : 'Select'}
                                    </button>
                                </div>
                            );
                        })
                        : constructors.map((c) => {
                            const isSelected = selectedIds.has(c.id);
                            const isTooExpensive = c.price > remainingBudget;
                            const isDisabled = isSelected || isTooExpensive;

                            return (
                                <div
                                    key={c.id}
                                    className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                    onClick={() => {
                                        if (!isDisabled) {
                                            onSelect({
                                                id: c.id,
                                                name: c.name,
                                                number: c.code,
                                                team: 'Constructor',
                                                price: c.price,
                                                ownership: c.ownership,
                                                expectedPoints: c.predictedPoints,
                                                avatarColor: c.avatarColor,
                                            });
                                        }
                                    }}
                                >
                                    <span className="picker-color-strip" style={{ backgroundColor: c.avatarColor }} />
                                    <div className="picker-meta">
                                        <strong>{c.name}</strong>
                                        <span>{c.code}</span>
                                    </div>
                                    <div className="picker-stats">
                                        <span className={isTooExpensive ? 'stat-price-over' : ''}>€{c.price}M</span>
                                        <span>{c.predictedPoints} pts</span>
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
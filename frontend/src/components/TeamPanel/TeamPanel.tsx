// src/components/TeamPanel.tsx
import React, { useState, useEffect } from 'react';
import { F1Card, type CardItem } from '../F1Card/F1Card';
import { MOCK_DRIVERS, MOCK_CONSTRUCTORS, type Driver, type Constructor } from '../../data/cards';
import './TeamPanel.css';

const driverToCardItem = (d: Driver): CardItem => ({
    id: d.id,
    name: d.name,
    number: d.number,
    team: d.team,
    price: d.price,
    ownership: d.ownership,
    expectedPoints: d.predictedPoints,
    avatarColor: d.avatarColor,
});

const constructorToCardItem = (c: Constructor): CardItem => ({
    id: c.id,
    name: c.name,
    number: c.code,
    team: 'Constructor',
    price: c.price,
    ownership: c.ownership,
    expectedPoints: c.predictedPoints,
    avatarColor: c.avatarColor,
});

const INITIAL_DRIVERS: (CardItem | null)[] = [
    driverToCardItem(MOCK_DRIVERS.find((d) => d.id === 'alo')!),
    driverToCardItem(MOCK_DRIVERS.find((d) => d.id === 'ver')!),
    driverToCardItem(MOCK_DRIVERS.find((d) => d.id === 'nor')!),
    driverToCardItem(MOCK_DRIVERS.find((d) => d.id === 'lec')!),
    driverToCardItem(MOCK_DRIVERS.find((d) => d.id === 'ham')!),
];

const INITIAL_CONSTRUCTORS: (CardItem | null)[] = [
    constructorToCardItem(MOCK_CONSTRUCTORS.find((c) => c.id === 'c-redbull')!),
    constructorToCardItem(MOCK_CONSTRUCTORS.find((c) => c.id === 'c-mclaren')!),
];

interface PickerState {
    isOpen: boolean;
    type: 'driver' | 'constructor';
    slotIndex: number;
}

interface TeamPanelProps {
    onTeamChange?: (
        drivers: (CardItem | null)[],
        constructors: (CardItem | null)[]
    ) => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({ onTeamChange }) => {
    const [drivers, setDrivers] = useState<(CardItem | null)[]>(INITIAL_DRIVERS);
    const [constructors, setConstructors] = useState<(CardItem | null)[]>(INITIAL_CONSTRUCTORS);

    // Sync with App whenever roster changes
    useEffect(() => {
        if (onTeamChange) {
            onTeamChange(drivers, constructors);
        }
    }, [drivers, constructors, onTeamChange]);

    // Budget State: Default 100.0M
    const [totalBudget, setTotalBudget] = useState<number>(100.0);
    const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
    const [tempBudgetValue, setTempBudgetValue] = useState<string>('100.0');

    const [picker, setPicker] = useState<PickerState>({
        isOpen: false,
        type: 'driver',
        slotIndex: 0,
    });



    // Calculate current total cost of the team
    const currentCost = [
        ...drivers.filter(Boolean),
        ...constructors.filter(Boolean),
    ].reduce((acc, item) => acc + (item?.price || 0), 0);

    const remainingBudget = Number((totalBudget - currentCost).toFixed(1));
    const isOverBudget = remainingBudget < 0;

    // Handlers for budget input
    const handleSaveBudget = () => {
        const parsed = parseFloat(tempBudgetValue);
        if (!isNaN(parsed) && parsed > 0) {
            setTotalBudget(Number(parsed.toFixed(1)));
        } else {
            setTempBudgetValue(totalBudget.toString());
        }
        setIsEditingBudget(false);
    };

    const handleKeyDownBudget = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSaveBudget();
        if (e.key === 'Escape') {
            setTempBudgetValue(totalBudget.toString());
            setIsEditingBudget(false);
        }
    };

    const handleRemoveDriver = (id: string) => {
        setDrivers((prev) => prev.map((item) => (item?.id === id ? null : item)));
    };

    const handleRemoveConstructor = (id: string) => {
        setConstructors((prev) => prev.map((item) => (item?.id === id ? null : item)));
    };

    const handleOpenPicker = (slotIndex: number, type: 'driver' | 'constructor') => {
        setPicker({ isOpen: true, type, slotIndex });
    };

    const handleSelectItem = (selectedCard: CardItem) => {
        if (picker.type === 'driver') {
            setDrivers((prev) => {
                const updated = [...prev];
                updated[picker.slotIndex] = selectedCard;
                return updated;
            });
        } else {
            setConstructors((prev) => {
                const updated = [...prev];
                updated[picker.slotIndex] = selectedCard;
                return updated;
            });
        }
        setPicker((prev) => ({ ...prev, isOpen: false }));
    };

    const selectedDriverIds = new Set(drivers.filter(Boolean).map((d) => d!.id));
    const selectedConstructorIds = new Set(constructors.filter(Boolean).map((c) => c!.id));


    return (
        <div className="team-workspace">
            {/* Top Header Row with Budget Indicator in Top-Left */}
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
                            {isEditingBudget ? (
                                <div className="budget-edit-wrapper">
                                    <span>€</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        autoFocus
                                        className="budget-input"
                                        value={tempBudgetValue}
                                        onChange={(e) => setTempBudgetValue(e.target.value)}
                                        onBlur={handleSaveBudget}
                                        onKeyDown={handleKeyDownBudget}
                                    />
                                    <span>M</span>
                                </div>
                            ) : (
                                <span className="budget-total-val" onClick={() => setIsEditingBudget(true)}>
                                    €{totalBudget.toFixed(1)}M
                                    <button
                                        type="button"
                                        className="budget-edit-icon"
                                        title="Edit total budget"
                                        aria-label="Edit budget"
                                    >
                                        ✎
                                    </button>
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

            {/* Row 1: 5 Drivers */}
            <div className="team-grid-5">
                {drivers.map((driver, index) => (
                    <F1Card
                        key={driver ? driver.id : `driver-slot-${index}`}
                        item={driver || undefined}
                        type="driver"
                        slotIndex={index}
                        onRemove={handleRemoveDriver}
                        onAdd={handleOpenPicker}
                    />
                ))}
            </div>

            {/* Row 2: Two 2-column Constructors + 3 Buttons */}
            <div className="team-grid-5">
                {constructors.map((c, index) => (
                    <div key={c ? c.id : `constructor-slot-${index}`} className="constructor-span-2">
                        <F1Card
                            item={c || undefined}
                            type="constructor"
                            slotIndex={index}
                            onRemove={handleRemoveConstructor}
                            onAdd={handleOpenPicker}
                        />
                    </div>
                ))}

                {/* 3 stacked buttons occupying column 5 (under driver card 5) */}
                <div className="team-actions-col">
                    <button type="button" className="team-action-btn">
                        Optimize
                    </button>
                    <button type="button" className="team-action-btn">
                        Transfers
                    </button>
                    <button type="button" className="team-action-btn">
                        Chips
                    </button>
                </div>
            </div>

            {/* Modal Picker with Budget Limit Blocker */}
            {picker.isOpen && (
                <div className="picker-overlay" onClick={() => setPicker((p) => ({ ...p, isOpen: false }))}>
                    <div className="picker-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="picker-header">
                            <div>
                                <h3>Select a {picker.type === 'driver' ? 'Driver' : 'Constructor'}</h3>
                                <span className="picker-budget-hint">
                                    Available Budget: <strong>€{remainingBudget}M</strong>
                                </span>
                            </div>
                            <button
                                type="button"
                                className="picker-close-btn"
                                onClick={() => setPicker((p) => ({ ...p, isOpen: false }))}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="picker-list">
                            {picker.type === 'driver'
                                ? MOCK_DRIVERS.map((d) => {
                                    const isSelected = selectedDriverIds.has(d.id);
                                    const isTooExpensive = d.price > remainingBudget;
                                    const isDisabled = isSelected || isTooExpensive;

                                    return (
                                        <div
                                            key={d.id}
                                            className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleSelectItem(driverToCardItem(d))}
                                        >
                                            <span className="picker-color-strip" style={{ backgroundColor: d.avatarColor }} />
                                            <div className="picker-meta">
                                                <strong>{d.name}</strong>
                                                <span>{d.team} (#{d.number})</span>
                                            </div>
                                            <div className="picker-stats">
                                                <span className={isTooExpensive ? 'stat-price-over' : ''}>
                                                    €{d.price}M
                                                </span>
                                                <span>{d.predictedPoints} pts</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="picker-select-btn"
                                                disabled={isDisabled}
                                            >
                                                {isSelected ? 'In Team' : isTooExpensive ? 'Over Budget' : 'Select'}
                                            </button>
                                        </div>
                                    );
                                })
                                : MOCK_CONSTRUCTORS.map((c) => {
                                    const isSelected = selectedConstructorIds.has(c.id);
                                    const isTooExpensive = c.price > remainingBudget;
                                    const isDisabled = isSelected || isTooExpensive;

                                    return (
                                        <div
                                            key={c.id}
                                            className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleSelectItem(constructorToCardItem(c))}
                                        >
                                            <span className="picker-color-strip" style={{ backgroundColor: c.avatarColor }} />
                                            <div className="picker-meta">
                                                <strong>{c.name}</strong>
                                                <span>{c.code}</span>
                                            </div>
                                            <div className="picker-stats">
                                                <span className={isTooExpensive ? 'stat-price-over' : ''}>
                                                    €{c.price}M
                                                </span>
                                                <span>{c.predictedPoints} pts</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="picker-select-btn"
                                                disabled={isDisabled}
                                            >
                                                {isSelected ? 'In Team' : isTooExpensive ? 'Over Budget' : 'Select'}
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
// src/components/TeamPanel/TeamPanel.tsx
import React, { useState, useEffect } from 'react';
import { F1Card, type CardItem } from '../F1Card/F1Card';
import type { Driver, Constructor } from '../../types/f1';
import './TeamPanel.css';

const API_BASE = 'http://localhost:8000';

// Convert backend Driver schema to CardItem
const driverToCardItem = (d: any): CardItem => ({
    id: d.id,
    name: d.name,
    number: d.number,
    team: d.team,
    price: Number(d.price) || 0,
    ownership: Number(d.ownership) || 0,
    expectedPoints: Number(d.predictedPoints ?? d.predicted_points ?? 0),
    avatarColor: d.avatarColor || d.avatar_color || '#1e3a8a',
});

// Convert backend Constructor schema to CardItem
const constructorToCardItem = (c: any): CardItem => ({
    id: c.id,
    name: c.name,
    number: c.code,
    team: 'Constructor',
    price: Number(c.price) || 0,
    ownership: Number(c.ownership) || 0,
    expectedPoints: Number(c.predictedPoints ?? c.predicted_points ?? 0),
    avatarColor: c.avatarColor || c.avatar_color || '#1e3a8a',
});

// Knapsack/Roster Optimizer
function findOptimalRoster(
    allDrivers: CardItem[],
    allConstructors: CardItem[],
    budgetLimit: number
): { bestDrivers: CardItem[]; bestConstructors: CardItem[] } | null {
    if (allDrivers.length < 5 || allConstructors.length < 2) return null;

    // 1. All 2-constructor pairs
    const constructorPairs: { items: [CardItem, CardItem]; cost: number; points: number }[] = [];
    for (let i = 0; i < allConstructors.length; i++) {
        for (let j = i + 1; j < allConstructors.length; j++) {
            const c1 = allConstructors[i];
            const c2 = allConstructors[j];
            const cost = c1.price + c2.price;
            if (cost < budgetLimit) {
                constructorPairs.push({
                    items: [c1, c2],
                    cost,
                    points: c1.expectedPoints + c2.expectedPoints,
                });
            }
        }
    }

    // 2. All 5-driver combinations
    const driverGroups: { items: CardItem[]; cost: number; points: number }[] = [];
    const n = allDrivers.length;

    for (let a = 0; a < n - 4; a++) {
        for (let b = a + 1; b < n - 3; b++) {
            for (let c = b + 1; c < n - 2; c++) {
                for (let d = c + 1; d < n - 1; d++) {
                    for (let e = d + 1; e < n; e++) {
                        const group = [allDrivers[a], allDrivers[b], allDrivers[c], allDrivers[d], allDrivers[e]];
                        const cost = group.reduce((sum, d) => sum + d.price, 0);
                        if (cost < budgetLimit) {
                            const points = group.reduce((sum, d) => sum + d.expectedPoints, 0);
                            driverGroups.push({ items: group, cost, points });
                        }
                    }
                }
            }
        }
    }

    // 3. Find highest point total within budget
    let maxPoints = -1;
    let bestDrivers: CardItem[] = [];
    let bestConstructors: CardItem[] = [];

    for (const cPair of constructorPairs) {
        const budgetLeft = budgetLimit - cPair.cost;
        for (const dGroup of driverGroups) {
            if (dGroup.cost <= budgetLeft + 0.0001) {
                const totalPoints = cPair.points + dGroup.points;
                if (totalPoints > maxPoints) {
                    maxPoints = totalPoints;
                    bestDrivers = dGroup.items;
                    bestConstructors = cPair.items;
                }
            }
        }
    }

    if (maxPoints === -1) return null;
    return { bestDrivers, bestConstructors };
}

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
    const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
    const [availableConstructors, setAvailableConstructors] = useState<Constructor[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [drivers, setDrivers] = useState<(CardItem | null)[]>([null, null, null, null, null]);
    const [constructors, setConstructors] = useState<(CardItem | null)[]>([null, null]);

    const [totalBudget, setTotalBudget] = useState<number>(100.0);
    const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
    const [tempBudgetValue, setTempBudgetValue] = useState<string>('100.0');

    const [picker, setPicker] = useState<PickerState>({
        isOpen: false,
        type: 'driver',
        slotIndex: 0,
    });

    useEffect(() => {
        const fetchRoster = async () => {
            try {
                setLoading(true);
                setError(null);

                const [driversRes, constructorsRes] = await Promise.all([
                    fetch(`${API_BASE}/drivers/`),
                    fetch(`${API_BASE}/constructors/`),
                ]);

                if (!driversRes.ok || !constructorsRes.ok) {
                    throw new Error('Failed to fetch roster from the FastAPI server.');
                }

                const driversData = await driversRes.json();
                const constructorsData = await constructorsRes.json();

                setAvailableDrivers(driversData);
                setAvailableConstructors(constructorsData);

                const preferredDriverIds = ['alo', 'ver', 'nor', 'lec', 'ham'];
                const initialDriversList: (CardItem | null)[] = preferredDriverIds.map((id) => {
                    const match = driversData.find((d: any) => d.id === id);
                    return match ? driverToCardItem(match) : null;
                });

                const remainingDrivers = driversData
                    .filter((d: any) => !preferredDriverIds.includes(d.id))
                    .map(driverToCardItem);

                const finalDrivers = initialDriversList.map((d) => d || remainingDrivers.shift() || null);
                setDrivers(finalDrivers);

                const preferredConstructorIds = ['c-redbull', 'c-mclaren'];
                const initialConstructorsList: (CardItem | null)[] = preferredConstructorIds.map((id) => {
                    const match = constructorsData.find((c: any) => c.id === id);
                    return match ? constructorToCardItem(match) : null;
                });

                const remainingConstructors = constructorsData
                    .filter((c: any) => !preferredConstructorIds.includes(c.id))
                    .map(constructorToCardItem);

                const finalConstructors = initialConstructorsList.map((c) => c || remainingConstructors.shift() || null);
                setConstructors(finalConstructors);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown connection error');
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
    }, []);

    useEffect(() => {
        if (onTeamChange) {
            onTeamChange(drivers, constructors);
        }
    }, [drivers, constructors, onTeamChange]);

    const currentCost = [
        ...drivers.filter(Boolean),
        ...constructors.filter(Boolean),
    ].reduce((acc, item) => acc + (item?.price || 0), 0);

    const remainingBudget = Number((totalBudget - currentCost).toFixed(1));
    const isOverBudget = remainingBudget < 0;

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

    // Optimize Button Logic
    const handleOptimize = () => {
        const driverItems = availableDrivers.map(driverToCardItem);
        const constructorItems = availableConstructors.map(constructorToCardItem);

        const result = findOptimalRoster(driverItems, constructorItems, totalBudget);

        if (!result) {
            alert(`No team could be found under €${totalBudget}M. Please increase your budget.`);
            return;
        }

        setDrivers(result.bestDrivers);
        setConstructors(result.bestConstructors);
    };

    const selectedDriverIds = new Set(drivers.filter(Boolean).map((d) => d!.id));
    const selectedConstructorIds = new Set(constructors.filter(Boolean).map((c) => c!.id));

    if (loading) {
        return (
            <div className="team-workspace" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
                <p style={{ color: '#2dd4bf', fontWeight: 600 }}>Loading F1 Fantasy data from FastAPI...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="team-workspace" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 250, gap: '1rem' }}>
                <p style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Connection Error: {error}</p>
                <button
                    type="button"
                    className="team-action-btn"
                    style={{ padding: '6px 14px', maxWidth: 140 }}
                    onClick={() => window.location.reload()}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="team-workspace">
            {/* Top Header Row with Budget Indicator in Top-Right */}
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

                {/* 3 stacked buttons occupying column 5 */}
                <div className="team-actions-col">
                    <button
                        type="button"
                        className="team-action-btn"
                        onClick={handleOptimize}
                    >
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

            {/* Modal Picker populated directly from FastAPI */}
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
                                ? availableDrivers.map((d: any) => {
                                    const isSelected = selectedDriverIds.has(d.id);
                                    const price = Number(d.price) || 0;
                                    const isTooExpensive = price > remainingBudget;
                                    const isDisabled = isSelected || isTooExpensive;
                                    const predictedPts = Number(d.predictedPoints ?? d.predicted_points ?? 0);
                                    const color = d.avatarColor || d.avatar_color || '#1e3a8a';

                                    return (
                                        <div
                                            key={d.id}
                                            className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleSelectItem(driverToCardItem(d))}
                                        >
                                            <span className="picker-color-strip" style={{ backgroundColor: color }} />
                                            <div className="picker-meta">
                                                <strong>{d.name}</strong>
                                                <span>{d.team} (#{d.number})</span>
                                            </div>
                                            <div className="picker-stats">
                                                <span className={isTooExpensive ? 'stat-price-over' : ''}>
                                                    €{price}M
                                                </span>
                                                <span>{predictedPts} pts</span>
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
                                : availableConstructors.map((c: any) => {
                                    const isSelected = selectedConstructorIds.has(c.id);
                                    const price = Number(c.price) || 0;
                                    const isTooExpensive = price > remainingBudget;
                                    const isDisabled = isSelected || isTooExpensive;
                                    const predictedPts = Number(c.predictedPoints ?? c.predicted_points ?? 0);
                                    const color = c.avatarColor || c.avatar_color || '#1e3a8a';

                                    return (
                                        <div
                                            key={c.id}
                                            className={`picker-row ${isDisabled ? 'picker-row-disabled' : ''}`}
                                            onClick={() => !isDisabled && handleSelectItem(constructorToCardItem(c))}
                                        >
                                            <span className="picker-color-strip" style={{ backgroundColor: color }} />
                                            <div className="picker-meta">
                                                <strong>{c.name}</strong>
                                                <span>{c.code}</span>
                                            </div>
                                            <div className="picker-stats">
                                                <span className={isTooExpensive ? 'stat-price-over' : ''}>
                                                    €{price}M
                                                </span>
                                                <span>{predictedPts} pts</span>
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
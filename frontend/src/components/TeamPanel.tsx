// src/components/TeamPanel.tsx
import React, { useState } from 'react';
import { F1Card, type CardItem } from './F1Card';

const INITIAL_DRIVERS: (CardItem | null)[] = [
    { id: 'alo', name: 'Fernando Alonso', number: '14', team: 'Aston Martin', price: 8, ownership: 8, expectedPoints: 12, accentColor: '#17362d' },
    { id: 'ver', name: 'Max Verstappen', number: '1', team: 'Red Bull Racing', price: 30, ownership: 68, expectedPoints: 25, accentColor: '#1e293b' },
    { id: 'nor', name: 'Lando Norris', number: '4', team: 'McLaren', price: 27, ownership: 55, expectedPoints: 21, accentColor: '#3d2516' },
    { id: 'lec', name: 'Charles Leclerc', number: '16', team: 'Ferrari', price: 24, ownership: 42, expectedPoints: 19, accentColor: '#3b1818' },
    { id: 'ham', name: 'Lewis Hamilton', number: '44', team: 'Mercedes', price: 21, ownership: 30, expectedPoints: 15, accentColor: '#163835' },
];

const INITIAL_CONSTRUCTORS: (CardItem | null)[] = [
    { id: 'c-redbull', name: 'Red Bull Racing', number: 'RB', team: 'Constructor', price: 29, ownership: 62, expectedPoints: 37, accentColor: '#1e293b' },
    { id: 'c-mclaren', name: 'McLaren', number: 'MCL', team: 'Constructor', price: 28, ownership: 58, expectedPoints: 38, accentColor: '#3d2516' },
];

export const TeamPanel: React.FC = () => {
    const [drivers, setDrivers] = useState<(CardItem | null)[]>(INITIAL_DRIVERS);
    const [constructors, setConstructors] = useState<(CardItem | null)[]>(INITIAL_CONSTRUCTORS);

    const handleRemoveDriver = (id: string) => {
        setDrivers((prev) => prev.map((item) => (item?.id === id ? null : item)));
    };

    const handleRemoveConstructor = (id: string) => {
        setConstructors((prev) => prev.map((item) => (item?.id === id ? null : item)));
    };

    const handleAdd = (slotIndex: number, type: 'driver' | 'constructor') => {
        if (type === 'driver') {
            const restored: CardItem = {
                id: `driver-${Date.now()}`,
                name: 'New Driver',
                number: '00',
                team: 'Reserve Team',
                price: 10,
                ownership: 5,
                expectedPoints: 10,
            };
            setDrivers((prev) => {
                const copy = [...prev];
                copy[slotIndex] = restored;
                return copy;
            });
        } else {
            const restored: CardItem = {
                id: `constructor-${Date.now()}`,
                name: 'New Constructor',
                number: 'NC',
                team: 'Constructor',
                price: 15,
                ownership: 10,
                expectedPoints: 20,
            };
            setConstructors((prev) => {
                const copy = [...prev];
                copy[slotIndex] = restored;
                return copy;
            });
        }
    };

    return (
        <div className="team-workspace">
            {/* Row 1: 5 Drivers */}
            <div className="team-grid-5">
                {drivers.map((driver, index) => (
                    <F1Card
                        key={driver ? driver.id : `driver-slot-${index}`}
                        item={driver || undefined}
                        type="driver"
                        slotIndex={index}
                        onRemove={handleRemoveDriver}
                        onAdd={handleAdd}
                    />
                ))}
            </div>

            {/* Row 2: 2 Constructors on Left + 3 Slots Space for Other Stuff */}
            <div className="team-grid-5">
                {constructors.map((c, index) => (
                    <F1Card
                        key={c ? c.id : `constructor-slot-${index}`}
                        item={c || undefined}
                        type="constructor"
                        slotIndex={index}
                        onRemove={handleRemoveConstructor}
                        onAdd={handleAdd}
                    />
                ))}
                {/* The remaining 3-column empty space reserved for other stuff */}
                <div className="team-extra-space">
                    {/* Future components or widgets will go here */}
                </div>
            </div>
        </div>
    );
};
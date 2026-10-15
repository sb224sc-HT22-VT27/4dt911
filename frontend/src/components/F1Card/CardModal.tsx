// src/components/F1Card/CardModal.tsx
import React from 'react';
import { type CardItem } from '../../types/f1';

interface CardModalProps {
    item: CardItem;
    onClose: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({ item, onClose }) => {
    return (
        <div className="f1-info-overlay" onClick={onClose}>
            <div className="f1-info-dialog" onClick={(e) => e.stopPropagation()}>
                <h4>{item.name}</h4>
                <p><strong>Team:</strong> {item.team}</p>
                <p><strong>Price:</strong> €{item.price}M</p>
                <p><strong>Exp. Points:</strong> {item.expectedPoints}</p>
                <p><strong>Ownership:</strong> {item.ownership}%</p>
                <button className="f1-info-close" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};
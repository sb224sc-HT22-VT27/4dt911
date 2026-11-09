// src/components/SidePanels/CompareRow.tsx
import React from 'react';

export const COLOR_A = '#3987e5';
export const COLOR_B = '#d95926';

interface CompareRowProps {
    label: string;
    a: number;
    b: number;
    format: (v: number) => string;
    lowerIsBetter?: boolean;
}

// Bar share for A: 50% when equal, leaning towards whoever is better
const shareA = (a: number, b: number, lowerIsBetter?: boolean) => {
    if (a === b) return 50;
    const better = lowerIsBetter ? a < b : a > b;
    const gap = Math.min(Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1), 1);
    return better ? 50 + 45 * gap : 50 - 45 * gap;
};

export const CompareRow: React.FC<CompareRowProps> = ({ label, a, b, format, lowerIsBetter }) => {
    const share = shareA(a, b, lowerIsBetter);
    return (
        <div className="compare-row">
            <div className="compare-row-head">
                <span className={share > 50 ? 'winner' : ''}>{format(Number(a.toFixed(2)))}</span>
                <span className="compare-label">{label}</span>
                <span className={share < 50 ? 'winner' : ''}>{format(Number(b.toFixed(2)))}</span>
            </div>
            <div className="compare-track">
                <span style={{ width: `${share}%`, backgroundColor: COLOR_A }} />
                <span style={{ width: `${100 - share}%`, backgroundColor: COLOR_B }} />
            </div>
        </div>
    );
};

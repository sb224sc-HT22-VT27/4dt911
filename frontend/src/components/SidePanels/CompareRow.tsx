// src/components/SidePanels/CompareRow.tsx
import React from 'react';

export const COLOR_A = '#3987e5';
export const COLOR_B = '#d95926';

interface CompareRowProps {
    label: string;
    a: number;
    b: number;
    format: (v: number) => string;
}

// Bar share for A: 50% when equal, leaning towards the larger value
const shareA = (a: number, b: number) => {
    if (a === b) return 50;
    const gap = Math.min(Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1), 1);
    return a > b ? 50 + 45 * gap : 50 - 45 * gap;
};

export const CompareRow: React.FC<CompareRowProps> = ({ label, a, b, format }) => {
    const share = shareA(a, b);
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

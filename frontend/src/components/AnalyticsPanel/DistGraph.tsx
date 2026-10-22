// src/components/PpmGraph.tsx
import React, { useMemo } from 'react';
import * as d3 from 'd3';

interface DistGraphProps {
    p50: number; // Base predicted points from the selected team
}

export const DistGraph: React.FC<DistGraphProps> = ({ p50 }) => {
    // P10 (30% drop) and P90 (50% boost)
    const p10 = Math.round(p50 * 0.7);
    const p90 = Math.round(p50 * 1.5);
    const median = Math.round(p50);

    const width = 420;
    const height = 150;
    const margin = { top: 32, right: 30, bottom: 25, left: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Approximate normal distribution curve over standard deviations [-3, 3]
    const { pathData, areaData, getXForVal, getYForVal } = useMemo(() => {
        // Treat P10 as -1.28 standard deviations and P90 as +1.28 standard deviations
        const stdDev = (p90 - p10) / 2.56 || 10;
        const minX = median - 3.2 * stdDev;
        const maxX = median + 3.2 * stdDev;

        const xScale = d3.scaleLinear().domain([minX, maxX]).range([0, innerWidth]);

        // Gaussian probability density function: f(x) = exp(-0.5 * ((x - mu) / sigma)^2)
        const points: [number, number][] = [];
        const stepCount = 80;
        const stepSize = (maxX - minX) / stepCount;

        let maxY = 0;
        for (let i = 0; i <= stepCount; i++) {
            const val = minX + i * stepSize;
            const z = (val - median) / stdDev;
            const yVal = Math.exp(-0.5 * z * z);
            if (yVal > maxY) maxY = yVal;
            points.push([val, yVal]);
        }

        const yScale = d3.scaleLinear().domain([0, maxY]).range([innerHeight, 0]);

        // Line and area generators
        const lineGenerator = d3
            .line<[number, number]>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveBasis);

        const areaGenerator = d3
            .area<[number, number]>()
            .x((d) => xScale(d[0]))
            .y0(innerHeight)
            .y1((d) => yScale(d[1]))
            .curve(d3.curveBasis);

        const calcY = (val: number) => {
            const z = (val - median) / stdDev;
            const yVal = Math.exp(-0.5 * z * z);
            return yScale(yVal);
        };

        return {
            pathData: lineGenerator(points) || '',
            areaData: areaGenerator(points) || '',
            getXForVal: (v: number) => xScale(v),
            getYForVal: calcY,
        };
    }, [p10, p90, median, innerWidth, innerHeight]);

    const p10X = getXForVal(p10);
    const p10Y = getYForVal(p10);

    const p50X = getXForVal(median);
    const p50Y = getYForVal(median);

    const p90X = getXForVal(p90);
    const p90Y = getYForVal(p90);

    return (
        <div className="ppm-curve-container">
            <div className="ppm-curve-header">
                <div className="ppm-legend">
                    <span className="legend-item"><span className="legend-dot floor" />P10 (Floor): <strong>{p10}</strong></span>
                    <span className="legend-item"><span className="legend-dot median" />P50 (Exp): <strong>{median}</strong></span>
                    <span className="legend-item"><span className="legend-dot ceiling" />P90 (Ceiling): <strong>{p90}</strong></span>
                </div>
            </div>

            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="ppm-curve-svg"
            >
                <defs>
                    {/* Violet / Indigo gradient matching the provided SVG */}
                    <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#95f881" stopOpacity="0.45" />
                        <stop offset="65%" stopColor="#6df163" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#46e5b3" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Base bottom baseline */}
                    <line
                        x1={0}
                        y1={innerHeight}
                        x2={innerWidth}
                        y2={innerHeight}
                        stroke="#1e3b21"
                        strokeWidth={1.5}
                    />

                    {/* Shaded Area */}
                    <path d={areaData} fill="url(#curveGradient)" />

                    {/* Smooth Bell Curve Stroke */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="#63f1af"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                    />

                    {/* P10 Marker (Dashed vertical line) */}
                    <line
                        x1={p10X}
                        y1={p10Y}
                        x2={p10X}
                        y2={innerHeight}
                        stroke="#a5b4fc"
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        opacity={0.65}
                    />
                    <text
                        x={p10X}
                        y={p10Y - 8}
                        textAnchor="middle"
                        fill="#a5b4fc"
                        fontSize="10"
                        fontWeight="600"
                    >
                        {p10} pts
                    </text>
                    <text
                        x={p10X}
                        y={innerHeight + 16}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="700"
                    >
                        P10
                    </text>

                    {/* P50 Median Marker (Peak) */}
                    <line
                        x1={p50X}
                        y1={p50Y}
                        x2={p50X}
                        y2={innerHeight}
                        stroke="#e0e7ff"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        opacity={0.8}
                    />
                    <text
                        x={p50X}
                        y={p50Y - 10}
                        textAnchor="middle"
                        fill="#f1f5f9"
                        fontSize="12"
                        fontWeight="800"
                    >
                        {median} pts
                    </text>
                    <text
                        x={p50X}
                        y={innerHeight + 16}
                        textAnchor="middle"
                        fill="#818cf8"
                        fontSize="9"
                        fontWeight="700"
                    >
                        P50
                    </text>

                    {/* P90 Marker */}
                    <line
                        x1={p90X}
                        y1={p90Y}
                        x2={p90X}
                        y2={innerHeight}
                        stroke="#a5b4fc"
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        opacity={0.65}
                    />
                    <text
                        x={p90X}
                        y={p90Y - 8}
                        textAnchor="middle"
                        fill="#a5b4fc"
                        fontSize="10"
                        fontWeight="600"
                    >
                        {p90} pts
                    </text>
                    <text
                        x={p90X}
                        y={innerHeight + 16}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="700"
                    >
                        P90
                    </text>
                </g>
            </svg>
        </div>
    );
};
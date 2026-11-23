// src/components/AnalyticsPanel/ValueBubbleChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { linkClass, pointsFor, RISK_LABELS, type CardItem, type PlayerLink, type Risk } from '../../types/f1';

type Filter = 'driver' | 'constructor' | 'all';
type Mode = 'predicted' | 'season';

// Two colours only: your players vs the rest. Team colours can't be told apart in a scatter
// (Ferrari and Haas red are almost identical), names come from the labels and tooltips instead.
const TEAM_FILL = '#3987e5';
const OTHER_FILL = '#56677a';
const CHAR_W = 8;

interface ValueBubbleChartProps {
    allDrivers: CardItem[];
    allConstructors: CardItem[];
    teamIds: Set<string>;
    link: PlayerLink;
    risk: Risk;
    addBlocker: (item: CardItem) => string | null;
    onAdd: (item: CardItem) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'driver', label: 'Drivers' },
    { id: 'constructor', label: 'Constructors' },
    { id: 'all', label: 'All' },
];
const MARGIN = { top: 12, right: 24, bottom: 48, left: 60 };

export const ValueBubbleChart: React.FC<ValueBubbleChartProps> = ({
    allDrivers,
    allConstructors,
    teamIds,
    link,
    risk,
    addBlocker,
    onAdd,
}) => {
    const [filter, setFilter] = useState<Filter>('driver');
    const [mode, setMode] = useState<Mode>('predicted');
    const plotRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 700, height: 260 });

    // Keep the SVG in pixels so the bubbles stay round when the panel resizes
    useEffect(() => {
        const el = plotRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) =>
            setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Predicted points for the chosen risk, or fantasy points scored so far this season
    const yOf = (i: CardItem) => (mode === 'predicted' ? pointsFor(i, risk) : i.season?.fantasyPoints ?? 0);
    const yLabel = mode === 'predicted' ? `${RISK_LABELS[risk]} pts` : 'Season pts';
    const ppmOf = (i: CardItem) => (mode === 'predicted' ? i.ppm : i.season?.fantasyPpm ?? 0);

    const items =
        filter === 'driver' ? allDrivers : filter === 'constructor' ? allConstructors : [...allDrivers, ...allConstructors];
    const byValue = [...items].sort((a, b) => ppmOf(b) - ppmOf(a));

    const width = Math.max(size.width, 200);
    const height = Math.max(size.height, 120);
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    // Scales use every player so the axes stay the same when switching filter
    const everyone = [...allDrivers, ...allConstructors];
    const points = everyone.map(yOf);
    const x = d3
        .scaleLinear()
        .domain([0, (d3.max(everyone, (i) => i.price) ?? 30) * 1.08])
        .nice()
        .range([0, innerW]);
    const y = d3
        .scaleLinear()
        .domain([Math.min(0, d3.min(points) ?? 0), (d3.max(points) ?? 10) * 1.1])
        .nice()
        .range([innerH, 0]);
    const r = d3
        .scaleSqrt()
        .domain([0, d3.max(everyone, (i) => i.ownership) ?? 50])
        .range([4, 18]);

    // Guide lines for half, equal and double the median points per €M
    const median = Math.max(d3.median(everyone, ppmOf) ?? 1, 0.01);
    const guides = [median / 2, median, median * 2].map((k) => {
        const [xMax, yMax] = [x.domain()[1], y.domain()[1]];
        const endX = Math.min(xMax, yMax / k);
        return { k, x2: x(endX), y2: y(endX * k) };
    });

    // Top 5 by the backend's points per €M among the shown players
    const topValue = new Set(byValue.slice(0, 5).map((i) => i.id));

    // Label team + top value picks; skip a label that would overlap one already placed
    const priority = (id: string) =>
        id === link.selectedId ? 3 : id === link.compareId ? 2 : teamIds.has(id) ? 1 : 0;
    const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' }>();
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const candidates = items
        .filter((i) => teamIds.has(i.id) || topValue.has(i.id) || i.id === link.selectedId || i.id === link.compareId)
        .sort((a, b) => priority(b.id) - priority(a.id));
    for (const item of candidates) {
        const w = item.code.length * CHAR_W;
        const rad = r(item.ownership) + 8;
        const cx = x(item.price);
        const cy = y(yOf(item));
        const options = [
            { x: cx + rad, anchor: 'start' as const, y: cy },
            { x: cx - rad, anchor: 'end' as const, y: cy },
            { x: cx + rad, anchor: 'start' as const, y: cy - 14 },
            { x: cx + rad, anchor: 'start' as const, y: cy + 14 },
        ];
        const fits = (o: (typeof options)[number]) => {
            const x1 = o.anchor === 'start' ? o.x : o.x - w;
            const box = { x1, x2: x1 + w, y1: o.y - 8, y2: o.y + 8 };
            const free = !placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1);
            return free ? box : null;
        };
        for (const o of options) {
            const box = fits(o);
            if (box) {
                placed.push(box);
                labels.set(item.id, o);
                break;
            }
        }
    }

    return (
        <div className="bubble-wrapper">
            <div className="ppm-toolbar">
                <div className="ppm-kind-toggle">
                    {(['predicted', 'season'] as Mode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            className={mode === m ? 'active' : ''}
                            onClick={() => setMode(m)}
                        >
                            {m === 'predicted' ? 'Predicted' : 'Season so far'}
                        </button>
                    ))}
                </div>
                <div className="ppm-kind-toggle">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={filter === f.id ? 'active' : ''}
                            onClick={() => setFilter(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <span
                    className="ppm-axis-hint"
                    title="Click = select · ⌘/Ctrl-click = compare · double-click = add · bubble size = ownership"
                >
                    <span className="legend-dot team" /> your team <span className="legend-dot" /> others{' '}
                    <span className="legend-stripes" /> constructor <span className="legend-ring" /> top 5 points per €M
                </span>
            </div>

            <div className="bubble-plot" ref={plotRef}>
                <svg width={width} height={height}>
                    <defs>
                        {[
                            ['team', TEAM_FILL],
                            ['other', OTHER_FILL],
                        ].map(([id, color]) => (
                            <pattern
                                key={id}
                                id={`stripes-${id}`}
                                patternUnits="userSpaceOnUse"
                                width="6"
                                height="6"
                                patternTransform="rotate(45)"
                            >
                                <rect width="6" height="6" fill={color} fillOpacity="0.3" />
                                <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="3.5" />
                            </pattern>
                        ))}
                    </defs>
                    <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                        {y.ticks(5).map((t) => (
                            <g key={`y${t}`}>
                                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="bubble-grid" />
                                <text x={-8} y={y(t)} className="bubble-tick" textAnchor="end" dominantBaseline="middle">
                                    {t}
                                </text>
                            </g>
                        ))}
                        {x.ticks(7).map((t) => (
                            <g key={`x${t}`}>
                                <line x1={x(t)} x2={x(t)} y1={0} y2={innerH} className="bubble-grid" />
                                <text x={x(t)} y={innerH + 20} className="bubble-tick" textAnchor="middle">
                                    €{t}M
                                </text>
                            </g>
                        ))}
                        <text x={innerW} y={innerH + 42} className="bubble-axis-title" textAnchor="end">
                            Price →
                        </text>
                        <text x={8} y={6} className="bubble-axis-title" dominantBaseline="hanging">
                            ↑ {mode === 'predicted' ? `${RISK_LABELS[risk]} points` : 'Season fantasy points'}
                        </text>

                        {guides.map((g) => (
                            <g key={g.k} className="bubble-guide">
                                <line x1={x(0)} y1={y(0)} x2={g.x2} y2={g.y2} />
                                <text x={g.x2 - 4} y={g.y2 + 14} textAnchor="end">
                                    {g.k.toFixed(1)} pts/€M
                                </text>
                            </g>
                        ))}

                        {[...items]
                            .sort((a, b) => b.ownership - a.ownership)
                            .sort((a, b) => priority(a.id) - priority(b.id))
                            .map((item) => {
                                const isTeam = teamIds.has(item.id);
                                const ringed = [link.selectedId, link.compareId, link.hoverId].includes(item.id);
                                const cx = x(item.price);
                                const cy = y(yOf(item));
                                const fill =
                                    item.kind === 'constructor'
                                        ? `url(#stripes-${isTeam ? 'team' : 'other'})`
                                        : isTeam
                                          ? TEAM_FILL
                                          : OTHER_FILL;
                                return (
                                    <g
                                        key={item.id}
                                        className={`bubble ${item.kind} ${isTeam ? 'in-team' : ''} ${link.fade(item.id) ? 'faded' : ''} ${linkClass(link, item.id)}`}
                                        onClick={(e) => link.onPick(item.id, e)}
                                        onMouseEnter={() => link.onHover(item.id)}
                                        onMouseLeave={() => link.onHover(null)}
                                        onDoubleClick={() => !link.replacing && !addBlocker(item) && onAdd(item)}
                                    >
                                        <title>{`${item.name} · €${item.price}M · ${yOf(item)} ${yLabel.toLowerCase()} · ${item.ownership}% owned`}</title>
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={r(item.ownership)}
                                            fill={fill}
                                        />
                                        {ringed && (
                                            <circle cx={cx} cy={cy} r={r(item.ownership) + 7} className="link-ring" />
                                        )}
                                        {topValue.has(item.id) && (
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={r(item.ownership) + 4}
                                                className="value-ring"
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        <g className="bubble-labels">
                            {items
                                .filter((i) => labels.has(i.id))
                                .map((item) => {
                                    const l = labels.get(item.id)!;
                                    return (
                                        <text
                                            key={item.id}
                                            x={l.x}
                                            y={l.y}
                                            textAnchor={l.anchor}
                                            dominantBaseline="middle"
                                            className={`${linkClass(link, item.id)} ${link.fade(item.id) ? 'faded' : ''}`}
                                        >
                                            {item.code}
                                        </text>
                                    );
                                })}
                        </g>
                    </g>
                </svg>
            </div>
        </div>
    );
};

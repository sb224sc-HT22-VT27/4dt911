// src/components/Guide/GuideTour.tsx
import React, { useCallback, useEffect, useState } from 'react';
import './GuideTour.css';

interface Step {
    target?: string; // CSS selector to highlight, none = centered card
    title: string;
    text: string;
    tryIt?: string;
    click?: string; // element to click before showing the step (e.g. switch tab)
    corner?: boolean; // show the card in the bottom-left corner so pop-ups opened during the step stay readable
}

const STEPS: Step[] = [
    {
        title: 'Welcome to OptiGrid',
        text: 'OptiGrid helps you build the best F1 Fantasy team using predictions for the coming races. This short tour shows every tool. You can use the page while the tour is open.',
    },
    {
        target: '.race-select',
        title: 'Pick the Grand Prix',
        text: 'Choose which race you are planning for. Only upcoming races are listed, and the tag shows the track type (street, high speed or technical).',
    },
    {
        target: '.panel-settings',
        title: 'Settings',
        text: 'Horizon plans for 1 or 3 races. Risk decides which prediction to trust: Floor (safe P10), Middle (expected P50) or Ceiling (upside P90). The sliders boost drivers in good form, drivers who suit the track type, and punish DNF risk.',
        tryIt: 'Switch Risk to Ceiling and watch every number update.',
    },
    {
        target: '.settings-optimizer',
        title: 'Optimizer',
        text: 'Best team builds the highest scoring team within your budget, including the best DRS Boost pick. Transfers keeps your current team and suggests the best swaps. Every transfer beyond your free ones costs 10 points.',
        click: '.settings-optimizer .toggle button:first-child',
    },
    {
        target: '.panel-team',
        title: 'My Team',
        text: '5 drivers and 2 constructors. Each card shows the P10 / P50 / P90 points, with the current risk highlighted. Empty slots have a + to pick a player.',
    },
    {
        target: '.team-grid-5 .f1-card',
        title: 'Player cards',
        text: 'DRS gives a driver double points (one per team). i opens a detailed view with the points range, ratings, last 5 races and season stats. ✕ removes the player.',
        tryIt: 'Press i on a card. This card stays down here so you can read both.',
        corner: true,
    },
    {
        target: '.budget-pill-container',
        title: 'Budget',
        text: 'Shows how much budget is left. Click the total to change it, it turns red if your team costs too much.',
    },
    {
        target: '.panel-helper',
        title: 'Value finder',
        text: 'Every player by price and points. Up and to the left is good value, the dashed lines mark points per €1M. Blue bubbles are your players, striped ones are constructors and bigger bubbles are more owned. Switch between predicted points and points scored so far this season.',
        tryIt: 'Double-click a bubble to add that player.',
        click: '.analytics-tabs button:first-child',
    },
    {
        target: '.panel-helper',
        title: 'Race planner',
        text: 'Points per player for each of the next 1 to 10 races, darker cells are fewer points. Use it to see who has a good run of races coming up and when to bring them in.',
        tryIt: 'Click a race column to sort by it.',
        click: '.analytics-tabs button:nth-child(2)',
    },
    {
        target: '.panel-comparison',
        title: 'Comparison',
        text: 'Compare two drivers or two teams on ratings, F1 stats and fantasy numbers. Teammates shows how the two drivers of a team stack up head to head.',
        click: '.segmented button:first-child',
    },
    {
        target: '.panel-saved',
        title: 'Saved teams',
        text: 'Save up to 3 teams to try different ideas. Each slot shows its points with the current settings, click a slot to load it.',
    },
    {
        target: '.panel-summary',
        title: 'Team info',
        text: 'Your team total for floor, middle and ceiling, the spread of likely points, and who has the DRS Boost.',
    },
    {
        target: '.header-actions',
        title: "You're all set",
        text: 'Up here you can read the F1 Fantasy rules, see how the predictions work, and open this guide again. Good luck this weekend!',
        click: '.analytics-tabs button:first-child',
    },
];

const CARD_WIDTH = 330;
const GAP = 14;

interface GuideTourProps {
    onClose: () => void;
}

export const GuideTour: React.FC<GuideTourProps> = ({ onClose }) => {
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const step = STEPS[index];

    const measure = useCallback(() => {
        const el = step.target ? document.querySelector(step.target) : null;
        setRect(el ? el.getBoundingClientRect() : null);
    }, [step]);

    // Run the step's click (switch tab etc.), then measure once the page has updated
    useEffect(() => {
        if (step.click) (document.querySelector(step.click) as HTMLElement | null)?.click();
        const timer = setTimeout(measure, 80);
        window.addEventListener('resize', measure);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', measure);
        };
    }, [step, measure]);

    const next = useCallback(() => (index < STEPS.length - 1 ? setIndex(index + 1) : onClose()), [index, onClose]);
    const back = useCallback(() => setIndex(Math.max(0, index - 1)), [index]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') back();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [next, back, onClose]);

    // Place the card beside the highlighted area: right, left, below, above, in that order
    const cardStyle = (): React.CSSProperties => {
        if (step.corner) return { left: 16, bottom: 16 };
        if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampTop = (top: number) => Math.max(12, Math.min(top, vh - 260));
        const clampLeft = (left: number) => Math.max(12, Math.min(left, vw - CARD_WIDTH - 12));
        if (rect.right + GAP + CARD_WIDTH < vw) return { left: rect.right + GAP, top: clampTop(rect.top) };
        if (rect.left - GAP - CARD_WIDTH > 0) return { left: rect.left - GAP - CARD_WIDTH, top: clampTop(rect.top) };
        if (rect.bottom + GAP + 220 < vh) return { left: clampLeft(rect.left), top: rect.bottom + GAP };
        return { left: clampLeft(rect.left), top: Math.max(12, rect.top - GAP - 230) };
    };

    return (
        <>
            <div className="guide-layer">
                {rect ? (
                    <div
                        className="guide-spotlight"
                        style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
                    />
                ) : (
                    <div className="guide-backdrop" />
                )}
            </div>

                <div className="guide-card" style={{ ...cardStyle(), width: CARD_WIDTH }} role="dialog" aria-label={step.title}>
                    <div className="guide-progress">
                        {STEPS.map((_, i) => (
                            <span key={i} className={i <= index ? 'done' : ''} />
                        ))}
                    </div>
                    <span className="guide-count">
                        Step {index + 1} of {STEPS.length}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    {step.tryIt && (
                        <p className="guide-try">
                            <strong>Try it:</strong> {step.tryIt}
                        </p>
                    )}
                    <div className="guide-actions">
                        <button type="button" className="guide-skip" onClick={onClose}>
                            {index === STEPS.length - 1 ? 'Close' : 'Skip tour'}
                        </button>
                        <div>
                            {index > 0 && (
                                <button type="button" className="guide-back" onClick={back}>
                                    Back
                                </button>
                            )}
                            <button type="button" className="guide-next" onClick={next}>
                                {index === 0 ? 'Start tour' : index === STEPS.length - 1 ? 'Finish' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>
        </>
    );
};

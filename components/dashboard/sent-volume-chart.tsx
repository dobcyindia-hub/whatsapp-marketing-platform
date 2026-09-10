"use client";

import { useState } from "react";

export type DailyPoint = { day: string; count: number };

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic, locale-independent formatting — toLocaleDateString's output
// depends on the runtime's ICU locale data, which differs between the Node
// server and the browser and causes hydration mismatches.
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function formatWeekdayDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_ABBR[d.getUTCDay()]}, ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;

export function SentVolumeChart({ data }: { data: DailyPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - 8;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  // round the axis ceiling to a clean number
  const niceMax = Math.ceil(maxCount / 5) * 5 || 5;

  const barSlot = plotWidth / data.length;
  const barWidth = Math.min(24, barSlot * 0.6);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: HEIGHT }}>
        {gridLines.map((val) => {
          const y = PAD_TOP + plotHeight - (val / niceMax) * plotHeight;
          return (
            <g key={val}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - 8}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize={10} fill="var(--chart-muted)">
                {val}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barHeight = niceMax > 0 ? (d.count / niceMax) * plotHeight : 0;
          const x = PAD_LEFT + i * barSlot + (barSlot - barWidth) / 2;
          const y = PAD_TOP + plotHeight - barHeight;
          const isHover = hoverIdx === i;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={barHeight > 0 ? y : PAD_TOP + plotHeight - 1}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={4}
                fill={isHover ? "var(--chart-bar-hover)" : "var(--chart-bar)"}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
              />
              {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 7) === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--chart-muted)"
                >
                  {formatShortDate(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <div
          className="pointer-events-none absolute rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: `${((PAD_LEFT + hoverIdx * barSlot + barSlot / 2) / WIDTH) * 100}%`,
            top: 4,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium text-zinc-900 dark:text-zinc-50">{data[hoverIdx].count} sent</div>
          <div className="text-zinc-500 dark:text-zinc-400">{formatWeekdayDate(data[hoverIdx].day)}</div>
        </div>
      )}
    </div>
  );
}

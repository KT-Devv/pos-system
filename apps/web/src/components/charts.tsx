"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@pos/shared";

/** Tracks an element's rendered width so SVG charts can draw at exact pixel size. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round a maximum up to a clean axis value (1, 2, 2.5, 5 x 10^n). */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

export type TrendPoint = {
  key: string;
  /** Short axis label, e.g. "12 Sep". */
  label: string;
  /** Long label for the tooltip, e.g. "Sat, 12 Sep". */
  title: string;
  value: number;
  detail?: string;
};

const MARGIN = { top: 20, right: 14, bottom: 28, left: 52 };

/**
 * Single-series trend: 2px line, ~10% area wash, hairline grid, crosshair + tooltip on
 * hover or arrow keys, the peak labelled directly, and an end marker with a surface ring.
 */
export function TrendChart({
  data,
  formatValue,
  formatTick,
  height = 260,
  ariaLabel,
}: {
  data: TrendPoint[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const width = Math.max(measured, 280);
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const count = data.length;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const x = (i: number) => MARGIN.left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const base = MARGIN.top + innerH;
  const area = count > 0 ? `${line} L${x(count - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z` : "";

  const ticks = [0, 1, 2, 3, 4].map(i => (max * i) / 4);
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerW / 84))));
  const labelIdx = data.map((_, i) => i).filter(i => i % labelEvery === 0 || i === count - 1)
    // drop the second-to-last label when it would collide with the last one
    .filter((i, pos, all) => !(pos === all.length - 2 && all[all.length - 1] - i < labelEvery * 0.7));

  const peakIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const peak = data[peakIdx];

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (count === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - MARGIN.left) / innerW;
    setActive(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive(a => Math.min(count - 1, (a ?? -1) + 1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); setActive(a => Math.max(0, (a ?? count) - 1)); }
    else if (event.key === "Escape") setActive(null);
  };

  const point = active !== null ? data[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 86), width - 86) : 0;

  return (
    <div
      ref={ref}
      className="relative w-full select-none outline-offset-4"
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to read each point.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-hidden="true"
        className="block touch-pan-y"
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth={1} />
            <text x={MARGIN.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--chart-label)">
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {labelIdx.map(i => (
          <text key={data[i].key} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"} fontSize={11} fill="var(--chart-label)">
            {data[i].label}
          </text>
        ))}

        {count > 0 && (
          <>
            <path d={area} fill="var(--primary)" fillOpacity={0.1} />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {active === null && peak && peak.value > 0 && (
          <g>
            <circle cx={x(peakIdx)} cy={y(peak.value)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
            <text
              x={Math.min(Math.max(x(peakIdx), MARGIN.left + 30), width - MARGIN.right - 30)}
              y={y(peak.value) - 12}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="var(--foreground)"
              stroke="var(--card)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {formatValue(peak.value)}
            </text>
          </g>
        )}

        {count > 0 && active === null && peakIdx !== count - 1 && (
          <circle cx={x(count - 1)} cy={y(data[count - 1].value)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
        )}

        {point && active !== null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={base} stroke="var(--chart-axis)" strokeWidth={1} />
            <circle cx={x(active)} cy={y(point.value)} r={5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {point && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{ left: tipLeft, top: Math.max(0, y(point.value) - 14), transform: "translate(-50%, -100%)" }}
        >
          <p className="whitespace-nowrap font-semibold text-muted-foreground">{point.title}</p>
          <p className="whitespace-nowrap text-sm font-extrabold tabular-nums">{formatValue(point.value)}</p>
          {point.detail && <p className="whitespace-nowrap text-muted-foreground">{point.detail}</p>}
        </div>
      )}
    </div>
  );
}

export type BarSegment = { key: string; label: string; value: number; color: string };

/**
 * Part-to-whole bar: one 20px row, 2px surface gaps between segments, 4px outer corners.
 * Identity lives in the legend beside it, so color is never the only channel.
 */
export function StackedBar({
  segments,
  activeKey,
  onActiveChange,
  className,
  children,
}: {
  segments: BarSegment[];
  activeKey: string | null;
  onActiveChange: (key: string | null) => void;
  className?: string;
  children?: ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter(s => s.value > 0);
  return (
    <div className={className}>
      <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded bg-muted" role="img" aria-label="Share of revenue by payment method">
        {total > 0 && visible.map(segment => (
          <div
            key={segment.key}
            title={segment.label}
            onPointerEnter={() => onActiveChange(segment.key)}
            onPointerLeave={() => onActiveChange(null)}
            className={cn("h-full", activeKey && activeKey !== segment.key && "opacity-40")}
            style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

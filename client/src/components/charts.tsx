import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A small set of charts, drawn as SVG by hand.
 *
 * No charting library: the statistics page needs five shapes, and the
 * smallest library that draws them would be several times the size of
 * this file — downloaded by every reader who opens one player's charts.
 *
 * The rules they share, so the page reads as one system:
 *
 *  - Colours come from the site's tokens, so both themes and the
 *    high-contrast reader settings apply. Won and lost use the chart pair
 *    (`--c-chart-won`, `--c-chart-lost`), checked for colour-blind
 *    separation; a won bar also sits above the line and a lost one
 *    below, so colour is never the only signal.
 *  - Text is always ink, never the series colour.
 *  - One y-axis per chart. Two measures get two charts.
 *  - Every mark has a hover tooltip, and every figure a table of the same
 *    numbers — the way in for a screen reader and for anyone who would
 *    rather read figures than bars.
 *  - Sizes are in the page's own units, so the A / A+ / A++ control makes
 *    the axis text bigger too.
 */

export const COLOR = {
  won: "rgb(var(--c-chart-won))",
  lost: "rgb(var(--c-chart-lost))",
  player: "rgb(var(--c-brand))",
  others: "rgb(var(--c-line-strong))",
  grid: "rgb(var(--c-line))",
  ink: "rgb(var(--c-ink))",
  muted: "rgb(var(--c-ink-muted))",
  surface: "rgb(var(--c-surface))",
} as const;

/** A ring of page colour behind a label, so a line or dot under it cannot make it unreadable. */
const HALO = { stroke: COLOR.surface, strokeWidth: 4, paintOrder: "stroke", strokeLinejoin: "round" } as const;

// ---------------------------------------------------------------------------
// Frame: size, font, tooltip
// ---------------------------------------------------------------------------

/** The width the chart has to fill, and the size of the text inside it. */
function useFrame() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, font: 14 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const font = Number.parseFloat(getComputedStyle(node).fontSize) || 14;
      setSize({ width: Math.max(260, Math.floor(node.clientWidth)), font });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function useTip(frame: React.RefObject<HTMLDivElement | null>) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (event: PointerEvent, lines: string[]) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, lines });
  };
  return { tip, show, hide: () => setTip(null) };
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  // Kept inside the frame: flipped to the left of the pointer on the right half.
  const left = tip.x > width / 2;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 max-w-[16rem] rounded-card bg-ink px-3 py-2 text-canvas shadow-lifted"
      style={{
        top: Math.max(0, tip.y - 12),
        left: left ? undefined : tip.x + 14,
        right: left ? width - tip.x + 14 : undefined,
        transform: "translateY(-100%)",
      }}
    >
      {tip.lines.map((line, index) => (
        <p key={index} className={cn("tabular leading-snug", index === 0 && "font-semibold")}>
          {line}
        </p>
      ))}
    </div>
  );
}

function Frame({
  frame,
  tip,
  width,
  label,
  height,
  children,
}: {
  frame: ReturnType<typeof useFrame>;
  tip: Tip | null;
  width: number;
  label: string;
  height: number;
  children: ReactNode;
}) {
  return (
    <div ref={frame.ref} className="relative w-full text-[0.8em]">
      <svg
        role="img"
        aria-label={label}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full overflow-visible"
      >
        {children}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

/** Round tick values covering [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step / 1e6; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

const linear = (d0: number, d1: number, r0: number, r1: number) => (value: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);

/** A rough width for a label, so the layout can leave room before drawing it. */
const textWidth = (text: string, font: number) => text.length * font * 0.56;

function truncate(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Categories along the bottom: straight when they fit, angled when they do not. */
function XLabels({
  labels,
  x,
  y,
  band,
  font,
}: {
  labels: string[];
  x: (index: number) => number;
  y: number;
  band: number;
  font: number;
}) {
  const shown = labels.map((label) => truncate(label));
  const widest = Math.max(...shown.map((label) => textWidth(label, font)));
  const angled = widest > band - 4;
  // Thin them out when even angled they would sit on top of each other.
  const every = angled ? Math.max(1, Math.ceil((font * 1.7) / band)) : 1;
  return (
    <g fill={COLOR.muted} fontSize="1em">
      {shown.map((label, index) =>
        index % every !== 0 ? null : angled ? (
          <text
            key={index}
            transform={`translate(${x(index)},${y + 6}) rotate(-40)`}
            textAnchor="end"
            dominantBaseline="hanging"
          >
            {label}
          </text>
        ) : (
          <text key={index} x={x(index)} y={y + font + 4} textAnchor="middle">
            {label}
          </text>
        ),
      )}
    </g>
  );
}

/**
 * How far the plot must start from the left so the first label, angled
 * down and to the left, is not cut off by the edge of the card.
 */
function angledLeft(labels: string[], left: number, right: number, width: number, font: number): number {
  const band = (width - left - right) / Math.max(labels.length, 1);
  const widest = Math.max(0, ...labels.map((label) => textWidth(truncate(label), font)));
  if (widest <= band - 4 || labels.length === 0) return left;
  // cos 40° of the first label's length reaches back past its own column.
  const reach = textWidth(truncate(labels[0]!), font) * 0.77 + 4;
  return Math.max(left, reach - band / 2);
}

function xLabelSpace(labels: string[], band: number, font: number): number {
  const widest = Math.max(0, ...labels.map((label) => textWidth(truncate(label), font)));
  return widest > band - 4 ? widest * 0.68 + font + 10 : font * 1.8;
}

export function Legend({ items }: { items: Array<{ label: string; color: string; line?: boolean; dashed?: boolean }> }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-ink-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          {item.line ? (
            <svg width="22" height="10" aria-hidden="true">
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                stroke={item.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={item.dashed ? "4 4" : undefined}
              />
            </svg>
          ) : (
            <span aria-hidden="true" className="inline-block size-3 rounded-sm" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A column with a 4px rounded end away from the baseline, square at it. */
function columnPath(x: number, width: number, base: number, end: number): string {
  const r = Math.min(4, width / 2, Math.abs(end - base));
  if (end < base) {
    return `M${x},${base}V${end + r}Q${x},${end} ${x + r},${end}H${x + width - r}Q${x + width},${end} ${x + width},${end + r}V${base}Z`;
  }
  return `M${x},${base}V${end - r}Q${x},${end} ${x + r},${end}H${x + width - r}Q${x + width},${end} ${x + width},${end - r}V${base}Z`;
}

// ---------------------------------------------------------------------------
// Columns — one series, or won above the line and lost below it
// ---------------------------------------------------------------------------

export interface ColumnSeries {
  label: string;
  values: number[];
  /** One colour, or one per column. */
  color: string | ((index: number) => string);
}

export function ColumnChart({
  categories,
  up,
  down,
  label,
  tip,
  height = 260,
  yLabel,
  yMax,
  legend = true,
}: {
  categories: string[];
  up: ColumnSeries;
  /** Drawn below the line, as a positive count. */
  down?: ColumnSeries;
  label: string;
  tip: (index: number) => string[];
  height?: number;
  yLabel?: string;
  yMax?: number;
  legend?: boolean;
}) {
  const frame = useFrame();
  const { tip: shown, show, hide } = useTip(frame.ref);
  const { width, font } = frame;

  const top = Math.max(yMax ?? 0, ...up.values, 1);
  const bottom = down ? Math.max(...down.values, 0) : 0;
  const left = angledLeft(categories, textWidth(String(Math.max(top, bottom)), font) + 14 + (yLabel ? font + 4 : 0), 8, width, font);
  const plotWidth = width - left - 8;
  const band = plotWidth / Math.max(categories.length, 1);
  const bottomSpace = xLabelSpace(categories, band, font);
  const plotTop = 10;
  const plotBottom = height - bottomSpace;
  const y = linear(-bottom, top, plotBottom, plotTop);
  const x = (index: number) => left + band * index + band / 2;
  const barWidth = Math.max(3, Math.min(24, band * 0.6));
  const ticks = niceTicks(-bottom, top, down ? 6 : 4).filter((t) => Number.isInteger(t));
  const colorOf = (series: ColumnSeries, index: number) =>
    typeof series.color === "function" ? series.color(index) : series.color;

  return (
    <>
      {legend && down ? (
        <Legend
          items={[
            { label: up.label, color: colorOf(up, 0) },
            { label: down.label, color: colorOf(down, 0) },
          ]}
        />
      ) : null}
      <Frame frame={frame} tip={shown} width={width} height={height} label={label}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - 8} y1={y(tick)} y2={y(tick)} stroke={COLOR.grid} strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={left - 6} y={y(tick)} dy="0.35em" textAnchor="end" fill={COLOR.muted} fontSize="1em" className="tabular">
              {Math.abs(tick)}
            </text>
          </g>
        ))}
        {yLabel ? (
          <text transform={`translate(${font * 0.9},${(plotTop + plotBottom) / 2}) rotate(-90)`} textAnchor="middle" fill={COLOR.muted} fontSize="1em">
            {yLabel}
          </text>
        ) : null}
        {categories.map((_, index) => (
          <g key={index}>
            {up.values[index]! > 0 ? (
              <path d={columnPath(x(index) - barWidth / 2, barWidth, y(0) - 1, y(up.values[index]!))} fill={colorOf(up, index)} />
            ) : null}
            {down && down.values[index]! > 0 ? (
              <path d={columnPath(x(index) - barWidth / 2, barWidth, y(0) + 1, y(-down.values[index]!))} fill={colorOf(down, index)} />
            ) : null}
            {/* The hover target is the whole band, not the bar: easier to hit. */}
            <rect
              x={x(index) - band / 2}
              y={plotTop}
              width={band}
              height={plotBottom - plotTop}
              fill="transparent"
              onPointerMove={(event) => show(event, tip(index))}
              onPointerLeave={hide}
            />
          </g>
        ))}
        <XLabels labels={categories} x={x} y={plotBottom} band={band} font={font} />
      </Frame>
    </>
  );
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

export interface LineSeries {
  label: string;
  values: Array<number | null>;
  color: string;
  dashed?: boolean;
  /** The series the chart is about: drawn with markers. */
  main?: boolean;
  /** A text label beside chosen points, sparingly. */
  pointLabels?: Array<string | null>;
}

export function LineChart({
  categories,
  series,
  label,
  tip,
  domain,
  reverse = false,
  format = (value: number) => String(value),
  height = 260,
  area = false,
  integerTicks = false,
}: {
  categories: string[];
  series: LineSeries[];
  label: string;
  tip: (index: number) => string[];
  domain: [number, number];
  reverse?: boolean;
  format?: (value: number) => string;
  height?: number;
  /** A faint wash under the main series. */
  area?: boolean;
  integerTicks?: boolean;
}) {
  const frame = useFrame();
  const { tip: shown, show, hide } = useTip(frame.ref);
  const [hover, setHover] = useState<number | null>(null);
  const { width, font } = frame;

  const ticks = niceTicks(domain[0], domain[1], 4).filter((t) => !integerTicks || Number.isInteger(t));
  const right = 18;
  const left = angledLeft(categories, Math.max(...ticks.map((t) => textWidth(format(t), font))) + 14, right, width, font);
  const plotWidth = width - left - right;
  const band = plotWidth / Math.max(categories.length, 1);
  const bottomSpace = xLabelSpace(categories, band, font);
  const plotTop = 14;
  const plotBottom = height - bottomSpace;
  const y = reverse ? linear(domain[0], domain[1], plotTop, plotBottom) : linear(domain[0], domain[1], plotBottom, plotTop);
  const x = (index: number) => left + band * index + band / 2;

  const pathOf = (values: Array<number | null>) => {
    let d = "";
    let pen = false;
    values.forEach((value, index) => {
      if (value === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(index)},${y(value)}`;
      pen = true;
    });
    return d;
  };

  return (
    <>
      {series.length > 1 ? (
        <Legend items={series.map((s) => ({ label: s.label, color: s.color, line: true, dashed: s.dashed }))} />
      ) : null}
      <Frame frame={frame} tip={shown} width={width} height={height} label={label}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={COLOR.grid} />
            <text x={left - 6} y={y(tick)} dy="0.35em" textAnchor="end" fill={COLOR.muted} fontSize="1em" className="tabular">
              {format(tick)}
            </text>
          </g>
        ))}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={plotTop} y2={plotBottom} stroke={COLOR.others} /> : null}
        {series.map((s) => {
          const d = pathOf(s.values);
          const first = s.values.findIndex((v) => v !== null);
          const last = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null);
          return (
            <g key={s.label}>
              {area && s.main && first >= 0 ? (
                <path d={`${d}L${x(last)},${y(reverse ? domain[1] : domain[0])}L${x(first)},${y(reverse ? domain[1] : domain[0])}Z`} fill={s.color} opacity={0.1} />
              ) : null}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 5" : undefined} />
              {s.main
                ? s.values.map((value, index) =>
                    value === null ? null : (
                      <g key={index}>
                        <circle cx={x(index)} cy={y(value)} r={hover === index ? 6 : 4.5} fill={s.color} stroke={COLOR.surface} strokeWidth={2} />
                        {s.pointLabels?.[index] ? (
                          <text x={x(index)} y={y(value)} dy={reverse ? "1.6em" : "-0.9em"} textAnchor="middle" fill={COLOR.ink} fontSize="1em" fontWeight={700} {...HALO}>
                            {s.pointLabels[index]}
                          </text>
                        ) : null}
                      </g>
                    ),
                  )
                : null}
            </g>
          );
        })}
        {categories.map((_, index) => (
          <rect
            key={index}
            x={x(index) - band / 2}
            y={plotTop}
            width={band}
            height={plotBottom - plotTop}
            fill="transparent"
            onPointerMove={(event) => {
              setHover(index);
              show(event, tip(index));
            }}
            onPointerLeave={() => {
              setHover(null);
              hide();
            }}
          />
        ))}
        <XLabels labels={categories} x={x} y={plotBottom} band={band} font={font} />
      </Frame>
    </>
  );
}

// ---------------------------------------------------------------------------
// Dots — a strip along one axis, or a scatter of two
// ---------------------------------------------------------------------------

export interface Dot {
  x: number;
  /** Omitted for a strip: the dots are spread vertically so none hide. */
  y?: number;
  label: string;
  main?: boolean;
  /** Write the name beside it. */
  named?: boolean;
  tip: string[];
}

export function DotChart({
  dots,
  label,
  xDomain,
  yDomain,
  xFormat = String,
  yFormat = String,
  xLabel,
  yLabel,
  height = 240,
}: {
  dots: Dot[];
  label: string;
  xDomain: [number, number];
  yDomain?: [number, number];
  xFormat?: (value: number) => string;
  yFormat?: (value: number) => string;
  xLabel: string;
  yLabel?: string;
  height?: number;
}) {
  const frame = useFrame();
  const { tip: shown, show, hide } = useTip(frame.ref);
  const { width, font } = frame;

  const yTicks = yDomain ? niceTicks(yDomain[0], yDomain[1], 4) : [];
  const left = yDomain ? Math.max(...yTicks.map((t) => textWidth(yFormat(t), font))) + 14 : 14;
  const right = 18;
  const plotTop = 18;
  const plotBottom = height - font * 3.2;
  const x = linear(xDomain[0], xDomain[1], left, width - right);
  const y = yDomain ? linear(yDomain[0], yDomain[1], plotBottom - 8, plotTop) : null;
  const xTicks = niceTicks(xDomain[0], xDomain[1], width < 420 ? 4 : 6);

  // A strip spreads its dots over rows so that equal values do not stack.
  const stripY = (index: number) => {
    const rows = 5;
    const middle = (plotTop + plotBottom) / 2;
    const spread = Math.min(16, (plotBottom - plotTop) / (rows + 1));
    return middle + ((index % rows) - (rows - 1) / 2) * spread;
  };

  // The one the chart is about is drawn last, on top.
  const ordered = [...dots].sort((a, b) => Number(Boolean(a.main)) - Number(Boolean(b.main)));

  return (
    <Frame frame={frame} tip={shown} width={width} height={height} label={label}>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={width - right} y1={y!(tick)} y2={y!(tick)} stroke={COLOR.grid} />
          <text x={left - 6} y={y!(tick)} dy="0.35em" textAnchor="end" fill={COLOR.muted} fontSize="1em" className="tabular">
            {yFormat(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={tick}>
          {!yDomain ? <line x1={x(tick)} x2={x(tick)} y1={plotTop} y2={plotBottom} stroke={COLOR.grid} /> : null}
          <text x={x(tick)} y={plotBottom + font + 4} textAnchor="middle" fill={COLOR.muted} fontSize="1em" className="tabular">
            {xFormat(tick)}
          </text>
        </g>
      ))}
      <text x={(left + width - right) / 2} y={plotBottom + font * 2.6} textAnchor="middle" fill={COLOR.muted} fontSize="1em">
        {xLabel}
      </text>
      {yLabel && yDomain ? (
        <text x={left} y={plotTop - 6} fill={COLOR.muted} fontSize="1em">
          {yLabel}
        </text>
      ) : null}
      {ordered.map((dot, index) => {
        const cx = x(dot.x);
        const cy = y && dot.y !== undefined ? y(dot.y) : stripY(index);
        const anchor = cx > width * 0.7 ? "end" : "start";
        return (
          <g key={`${dot.label}-${index}`}>
            <circle
              cx={cx}
              cy={cy}
              r={dot.main ? 7 : 5}
              fill={dot.main ? COLOR.player : COLOR.others}
              stroke={COLOR.surface}
              strokeWidth={2}
            />
            {dot.named ? (
              <text
                x={cx + (anchor === "end" ? -10 : 10)}
                y={cy}
                dy="0.35em"
                textAnchor={anchor}
                fill={dot.main ? COLOR.ink : COLOR.muted}
                fontSize="1em"
                fontWeight={dot.main ? 700 : 400}
                {...HALO}
              >
                {dot.label}
              </text>
            ) : null}
            <circle
              cx={cx}
              cy={cy}
              r={12}
              fill="transparent"
              onPointerMove={(event) => show(event, dot.tip)}
              onPointerLeave={hide}
            />
          </g>
        );
      })}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Won-and-lost bars, one row each — plain HTML, the label says it all
// ---------------------------------------------------------------------------

export function WonLostBars({ rows, unit = "won" }: { rows: Array<{ label: string; won: number; lost: number }>; unit?: string }) {
  const widest = Math.max(1, ...rows.map((row) => row.won + row.lost));
  return (
    <>
      <Legend
        items={[
          { label: "Won", color: COLOR.won },
          { label: "Lost", color: COLOR.lost },
        ]}
      />
      <ul className="space-y-3">
        {rows.map((row) => {
          const total = row.won + row.lost;
          return (
            <li key={row.label} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-3">
              <span className="font-semibold">{row.label}</span>
              <span className="flex items-center gap-3">
                <span className="flex h-5 flex-1 gap-0.5" aria-hidden="true">
                  {row.won > 0 ? (
                    <span className="h-full rounded-l" style={{ width: `${(row.won / widest) * 100}%`, background: COLOR.won }} />
                  ) : null}
                  {row.lost > 0 ? (
                    <span className="h-full rounded-r" style={{ width: `${(row.lost / widest) * 100}%`, background: COLOR.lost }} />
                  ) : null}
                </span>
                <span className="w-44 shrink-0 whitespace-nowrap text-right tabular text-ink-muted">
                  {row.won} of {total} {unit}
                  {total > 0 ? ` · ${Math.round((row.won / total) * 100)}%` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// The figure around every chart
// ---------------------------------------------------------------------------

export interface ChartTable {
  head: string[];
  rows: Array<Array<string | number>>;
}

/**
 * A chart with its title, the question it answers, one line saying what
 * it shows for this player, and the numbers behind it on request.

 */
export function ChartFigure({
  title,
  question,
  reading,
  table,
  wide = false,
  children,
}: {
  title: string;
  question: string;
  reading?: ReactNode;
  table?: ChartTable;
  wide?: boolean;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <figure
      className={cn(
        "min-w-0 rounded-card border border-line bg-surface p-5 shadow-card",
        wide && "lg:col-span-2",
      )}
    >
      <figcaption className="mb-4">
        <h3 className="text-xl">{title}</h3>
        <p className="mt-1 text-ink-muted">{question}</p>
      </figcaption>
      {children}
      {reading ? <p className="mt-4 border-t border-line pt-3">{reading}</p> : null}
      {table ? (
        <div className="mt-3 no-print">
          <button
            type="button"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((open) => !open)}
            className="link min-h-touch font-semibold"
          >
            {showTable ? "Hide the numbers" : "Show the numbers"}
          </button>
          <div id={tableId} hidden={!showTable} className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {table.head.map((cell, index) => (
                    <th key={index} scope="col" className={cn("border-b border-line bg-surface-sunken px-3 py-2 font-semibold", index > 0 && "text-right")}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, index) => (
                      <td key={index} className={cn("border-b border-line px-3 py-2", index > 0 && "text-right tabular")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </figure>
  );
}

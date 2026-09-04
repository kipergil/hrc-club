import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockPageScroll } from "@/lib/scroll";

/**
 * The photographed card, kept where the person checking it can see it.
 *
 * Checking a read card is a comparison, and a comparison needs both
 * things. The photograph used to vanish the moment the draft arrived,
 * which left the reviewer confirming forty-odd numbers against a card
 * they could no longer see — so the only way to check anything was to
 * find the original on their phone.
 *
 * A phone photograph of an A4 sheet is also unreadable at thumbnail size,
 * which is why the enlarged view can be dragged and zoomed rather than
 * merely being bigger. The gesture people already have for this is the
 * one they use on every photo on their phone: drag to move, pinch or
 * wheel to zoom, double-tap to get closer.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 0.5;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The enlarged card: a full-screen viewer that can be dragged and zoomed.
 *
 * Pointer events rather than mouse and touch handlers separately, so a
 * finger, a mouse and a stylus are one code path — and pointer capture so
 * a drag that leaves the image does not simply stop, which is what makes
 * dragging feel broken at exactly the moment somebody is trying to reach
 * the edge of a card.
 */
export function PhotoViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // The page behind must not scroll while this covers it, or closing the
  // viewer leaves the reviewer somewhere else in the form.
  useEffect(() => lockPageScroll(), []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((current) => {
      const next = clamp(current + delta, MIN_SCALE, MAX_SCALE);
      // Back to fully zoomed out means back to centred: a card left
      // panned off-screen at 1× reads as a broken viewer.
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const nudge = 40;
      switch (event.key) {
        case "Escape":
          onClose();
          return;
        case "+":
        case "=":
          zoomBy(STEP);
          break;
        case "-":
          zoomBy(-STEP);
          break;
        // Arrow keys pan, so the whole card is reachable without a mouse.
        case "ArrowLeft":
          setOffset((o) => ({ ...o, x: o.x + nudge }));
          break;
        case "ArrowRight":
          setOffset((o) => ({ ...o, x: o.x - nudge }));
          break;
        case "ArrowUp":
          setOffset((o) => ({ ...o, y: o.y + nudge }));
          break;
        case "ArrowDown":
          setOffset((o) => ({ ...o, y: o.y - nudge }));
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, zoomBy]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale === MIN_SCALE) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragging.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragging.current = { id: drag.id, x: event.clientX, y: event.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current?.id === event.pointerId) dragging.current = null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 no-print"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface px-4 py-2">
        <p id={titleId} className="font-semibold text-ink">
          The card you photographed
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-STEP)}
            disabled={scale <= MIN_SCALE}
            className="flex size-11 items-center justify-center rounded-card border border-line-strong bg-surface text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
          >
            <Minus aria-hidden="true" className="size-5" />
            <span className="sr-only">Zoom out</span>
          </button>
          {/* The number is here because "am I zoomed in?" is otherwise only
              answerable by dragging and seeing whether anything moves. */}
          <span aria-hidden="true" className="tabular min-w-[3.5rem] text-center text-ink-muted">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(STEP)}
            disabled={scale >= MAX_SCALE}
            className="flex size-11 items-center justify-center rounded-card border border-line-strong bg-surface text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="size-5" />
            <span className="sr-only">Zoom in</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="flex size-11 items-center justify-center rounded-card border border-line-strong bg-surface text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <RotateCcw aria-hidden="true" className="size-5" />
            <span className="sr-only">Fit the whole card on screen</span>
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <X aria-hidden="true" className="size-5" />
            Close
          </button>
        </div>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => (scale > MIN_SCALE ? zoomBy(-MAX_SCALE) : zoomBy(1.5))}
        onWheel={(event) => zoomBy(event.deltaY < 0 ? STEP : -STEP)}
        className={cn(
          "flex flex-1 items-center justify-center overflow-hidden",
          // `touch-none` so a drag pans the card rather than scrolling the
          // page underneath, which on a phone is the difference between
          // inspecting a card and closing it by accident.
          scale > MIN_SCALE ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-zoom-in",
        )}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      <p className="bg-surface px-4 py-2 text-ink-muted">
        Drag to move the card, and use + and − or the scroll wheel to zoom. Escape closes it.
      </p>
    </div>
  );
}

/**
 * The photograph as it sits beside the form: a thumbnail that opens.
 *
 * A button rather than an image with a click handler, so it is reachable
 * by keyboard and announces itself as something that does something.
 */
export function CardPhoto({
  src,
  className,
  onRemove,
}: {
  src: string;
  className?: string;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full overflow-hidden rounded-card border border-line transition-colors hover:border-brand"
      >
        <img
          src={src}
          alt="The card you photographed. Select to enlarge it."
          className="max-h-96 w-full bg-surface-sunken object-contain"
        />
        <span className="flex items-center justify-center gap-2 bg-surface px-3 py-2 font-semibold text-ink-muted transition-colors group-hover:text-brand">
          <Maximize2 aria-hidden="true" className="size-5" />
          Enlarge to check against the card
        </span>
      </button>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-card border border-line bg-surface text-ink"
        >
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Remove this photograph</span>
        </button>
      ) : null}

      {open ? (
        <PhotoViewer
          src={src}
          alt="The scorecard you photographed"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

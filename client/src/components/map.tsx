import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Venue } from "@shared/types.js";
import { ExternalLink } from "lucide-react";
import { TILE_LAYER_OPTIONS, TILE_URL, addressText, extentOf, googleMapsUrl } from "@/lib/maps";
import { buttonBase, buttonSizes, buttonVariants, type ButtonVariant } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * A map of one venue or of all of them.
 *
 * Three constraints shaped this, and each rules out the way a map is
 * usually added to a React site:
 *
 *  - **`script-src 'self'`.** The site's CSP has no exceptions, so Leaflet
 *    cannot come from a CDN the way its own documentation suggests. It is
 *    an npm dependency, bundled and served from this origin.
 *  - **Every page is prerendered with `renderToString`.** Leaflet reaches
 *    for `document` as it initialises, so importing it at module scope
 *    breaks the build for all 238 routes. It is loaded with a dynamic
 *    `import()` inside an effect, which never runs on the server — and as
 *    a bonus keeps ~150KB of mapping library out of the initial bundle for
 *    the pages that have no map on them.
 *  - **The map is never the only copy of the information.** Every page
 *    that shows one also lists the venues in text, with their addresses,
 *    above or beside it. A map is an illustration of the list, not a
 *    replacement for it, and the page has to work for someone who cannot
 *    see it, has JavaScript off, or is on a connection where the tiles
 *    never arrive.
 */

export interface MapPin {
  venue: Venue;
  /** Shown under the venue name in the pin's popup — usually the club. */
  detail?: string;
  href?: string;
}

/**
 * The pin, as inline SVG in a `divIcon`.
 *
 * Leaflet's default marker is a PNG whose URL it resolves relative to its
 * own stylesheet, which every bundler breaks and every project then works
 * around by re-pointing the icon paths. Drawing the pin instead avoids
 * that entirely, costs no image requests, and lets the marker take the
 * site's own brand colour in both themes rather than being the one blue
 * object on the page.
 */
function pinHtml(label: string): string {
  return `
    <span class="hrc-pin" role="img" aria-label="${label.replace(/[<>&"]/g, "")}">
      <svg viewBox="0 0 24 32" width="28" height="37" aria-hidden="true" focusable="false">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"/>
        <circle cx="12" cy="12" r="4.5" class="hrc-pin-hole"/>
      </svg>
    </span>`;
}

function popupHtml(pin: MapPin): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const address = addressText(pin.venue);
  const name = pin.href
    ? `<a href="${escape(pin.href)}">${escape(pin.venue.name)}</a>`
    : escape(pin.venue.name);

  return [
    `<strong>${name}</strong>`,
    pin.detail ? `<span class="hrc-popup-detail">${escape(pin.detail)}</span>` : "",
    address ? `<span class="hrc-popup-address">${escape(address)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");
}

export function VenueMap({
  pins,
  className,
  /** Zoom used when there is a single pin and nothing to fit. */
  singleZoom = 15,
  label = "Map of the venues",
}: {
  pins: MapPin[];
  className?: string;
  singleZoom?: number;
  label?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [failed, setFailed] = useState(false);

  const extent = extentOf(pins.map((pin) => pin.venue));

  useEffect(() => {
    // Nothing to plot. The page still lists the venues; a map with no pins
    // would be a grey rectangle claiming to be information.
    if (extent.points.length === 0) return;

    let cancelled = false;
    let created: LeafletMap | null = null;

    (async () => {
      let L: typeof import("leaflet");
      try {
        // Both loaded here rather than at module scope: see the note above.
        [L] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      } catch {
        // A chunk that never arrives is a map that never appears, which
        // the surrounding page is written to survive. Say so rather than
        // leaving an empty box.
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !container.current) return;

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      created = L.map(container.current, {
        // Scroll-wheel zoom hijacks the page scroll on the way past a map,
        // which on a phone is the difference between reading a page and
        // fighting it. Pinch, the +/- buttons and the keyboard all still
        // zoom.
        scrollWheelZoom: false,
        zoomAnimation: !reduceMotion,
        fadeAnimation: !reduceMotion,
        markerZoomAnimation: !reduceMotion,
        attributionControl: true,
      });
      map.current = created;

      L.tileLayer(TILE_URL, TILE_LAYER_OPTIONS).addTo(created);

      for (const pin of pins) {
        if (typeof pin.venue.latitude !== "number" || typeof pin.venue.longitude !== "number") continue;
        L.marker([pin.venue.latitude, pin.venue.longitude], {
          // Leaflet makes markers keyboard-focusable when this is on, which
          // is the only way a keyboard user reaches the popups.
          keyboard: true,
          title: pin.venue.name,
          alt: pin.venue.name,
          icon: L.divIcon({
            html: pinHtml(pin.venue.name),
            className: "hrc-pin-wrap",
            iconSize: [28, 37],
            iconAnchor: [14, 37],
            popupAnchor: [0, -34],
          }),
        })
          .addTo(created)
          .bindPopup(popupHtml(pin));
      }

      if (extent.points.length === 1) {
        created.setView([extent.points[0]!.latitude, extent.points[0]!.longitude], singleZoom);
      } else if (extent.bounds) {
        created.fitBounds(extent.bounds, { padding: [40, 40] });
      }
    })();

    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
    };
    // `pins` is rebuilt on every render by its callers, so comparing the
    // array itself would tear the map down and rebuild it constantly.
    // The identity that matters is which venues are plotted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent.points.map((point) => point.venue.id).join("|"), singleZoom]);

  if (extent.points.length === 0 || failed) return null;

  return (
    <div
      ref={container}
      className={cn(
        "hrc-map h-80 w-full overflow-hidden rounded-card border border-line bg-surface-sunken no-print",
        className,
      )}
      role="application"
      aria-label={label}
    />
  );
}

/**
 * "Open in Google Maps".
 *
 * A plain external link, because that is all it needs to be: Google's
 * universal maps URL takes coordinates in the query string, needs no API
 * key, and opens the Google Maps app rather than the website wherever one
 * is installed. Nothing is embedded, nothing is tracked from our page,
 * and no key can leak — which is the reason the architecture note ruled
 * out a Google Maps *embed* and not a link to it.
 *
 * Renders nothing when the venue has neither coordinates nor an address,
 * rather than a button that opens on the middle of England.
 */
export function GoogleMapsLink({
  venue,
  className,
  variant = "secondary",
}: {
  venue: Venue;
  className?: string;
  variant?: ButtonVariant;
}) {
  const url = googleMapsUrl(venue);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonBase, buttonSizes.md, buttonVariants[variant], className)}
    >
      <ExternalLink aria-hidden="true" className="size-5" />
      Open in Google Maps
      <span className="sr-only"> — {venue.name} (opens in a new tab)</span>
    </a>
  );
}

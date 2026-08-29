import { clsx, type ClassValue } from "clsx";
import { format, isValid, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";
import { DIVISION_LABELS, type Division } from "@shared/enums.js";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** "Thursday 9 October 2026" — written out, because an abbreviation is one more thing to decode. */
export function formatDateLong(value: string | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "EEEE d MMMM yyyy") : "Date to be confirmed";
}

/** "Thu 9 Oct" — for table cells, where the full form will not fit. */
export function formatDateShort(value: string | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "EEE d MMM") : "TBC";
}

export function formatDateNumeric(value: string | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "d MMM yyyy") : "";
}

/**
 * Directus returns `time` columns as "19:30:00". Nobody says the seconds,
 * and "7.30pm" is how a club night is written on a noticeboard.
 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number(rawHours);
  if (!Number.isFinite(hours) || rawMinutes === undefined) return value;

  const suffix = hours >= 12 ? "pm" : "am";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return rawMinutes === "00" ? `${display}${suffix}` : `${display}.${rawMinutes}${suffix}`;
}

export function formatDayName(day: string | null | undefined): string {
  if (!day) return "";
  return day.charAt(0).toUpperCase() + day.slice(1);
}


export function divisionLabel(division: Division | string | null | undefined): string {
  if (!division) return "";
  return DIVISION_LABELS[division as Division] ?? String(division);
}

/**
 * The site's own name for a match result, from HRC's point of view, always
 * as a word. Colour alone never carries this — a red cell and a green cell
 * are the same cell to a lot of our readers.
 */
export function resultLabel(result: string | null, status: string): string {
  if (status === "postponed") return "Postponed";
  if (status === "cancelled") return "Cancelled";
  if (status === "void") return "Void";
  if (result === "win") return "Won";
  if (result === "loss") return "Lost";
  if (result === "draw") return "Drawn";
  return "To play";
}

export function fileUrl(id: string | null | undefined, params?: Record<string, string | number>): string | null {
  if (!id) return null;
  const query = params
    ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`
    : "";
  return `/api/files/${id}${query}`;
}

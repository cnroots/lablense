const MONTHS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez"
];

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function parseIso(value: string): Date {
  // Accepts "YYYY-MM-DD" and full ISO timestamps; parses at local noon to
  // avoid timezone off-by-one on date-only strings.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      12,
      0,
      0
    );
  }
  return new Date(value);
}

export function toDate(value: string): Date {
  return parseIso(value);
}

export function isoDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function formatDate(value: string): string {
  const d = parseIso(value);
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
}

export function formatDateShort(value: string): string {
  const d = parseIso(value);
  return `${WEEKDAYS_DE[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.`;
}

export function formatMonthYear(value: string): string {
  const d = parseIso(value);
  return `${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatYear(value: string): string {
  const d = parseIso(value);
  return String(d.getFullYear());
}

/** Formats a numeric value the German way (comma decimal separator). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(".", ",");
}

export type Period = "6M" | "1J" | "3J" | "5J" | "Alle";

export function periodStart(period: Period, latest: Date): Date | null {
  if (period === "Alle") return null;
  const start = new Date(latest);
  if (period === "6M") start.setMonth(start.getMonth() - 6);
  if (period === "1J") start.setFullYear(start.getFullYear() - 1);
  if (period === "3J") start.setFullYear(start.getFullYear() - 3);
  if (period === "5J") start.setFullYear(start.getFullYear() - 5);
  return start;
}

export function isWithinPeriod(
  measuredAt: string,
  period: Period,
  latest: Date
): boolean {
  const start = periodStart(period, latest);
  if (!start) return true;
  const d = parseIso(measuredAt);
  return d >= start && d <= latest;
}

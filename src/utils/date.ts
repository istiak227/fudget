import { AppLanguage } from "../types";

function getLocale(language: AppLanguage = "en") {
  return language === "bn" ? "bn-BD" : "en-US";
}

export function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthLabel(monthKey: string, language: AppLanguage = "en") {
  return new Intl.DateTimeFormat(getLocale(language), {
    month: "long",
    year: "numeric",
  }).format(parseMonthKey(monthKey));
}

export function offsetMonth(monthKey: string, offset: number) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + offset);
  return getMonthKey(date);
}

export function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateLabel(value?: string, language: AppLanguage = "en") {
  const parsed = parseIsoDate(value);
  return parsed
    ? new Intl.DateTimeFormat(getLocale(language), {
        day: "numeric",
        month: "short",
        year: "2-digit",
      }).format(parsed)
    : language === "bn"
      ? "কোনো তারিখ নেই"
      : "No date selected";
}

export function getMonthOptions(
  centerMonthKey: string,
  radius = 18,
  language: AppLanguage = "en",
) {
  const items = [];

  for (let offset = -radius; offset <= radius; offset += 1) {
    const monthKey = offsetMonth(centerMonthKey, offset);
    items.push({
      monthKey,
      label: formatMonthLabel(monthKey, language),
    });
  }

  return items;
}

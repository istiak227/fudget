const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthLabel(monthKey: string) {
  return monthFormatter.format(parseMonthKey(monthKey));
}

export function offsetMonth(monthKey: string, offset: number) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + offset);
  return getMonthKey(date);
}

export function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthOptions(centerMonthKey: string, radius = 18) {
  const items = [];

  for (let offset = -radius; offset <= radius; offset += 1) {
    const monthKey = offsetMonth(centerMonthKey, offset);
    items.push({
      monthKey,
      label: formatMonthLabel(monthKey),
    });
  }

  return items;
}

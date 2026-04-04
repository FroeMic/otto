type ScheduleInput = {
  scheduleExpression: string;
  scheduleJson: Record<string, unknown> | null;
  timezone: string | null;
};

type ParsedField =
  | { kind: "any" }
  | { kind: "every"; step: number }
  | { kind: "exact"; value: number }
  | { kind: "list"; values: number[] };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function describeScheduledTaskSchedule(input: ScheduleInput) {
  const schedule = input.scheduleJson;
  const kind = typeof schedule?.kind === "string" ? schedule.kind : null;

  if (kind === "every") {
    const everyMs =
      typeof schedule?.everyMs === "number" ? schedule.everyMs : null;
    return withTimezone(
      everyMs ? `Every ${formatDurationMs(everyMs)}` : "Recurring",
      input.timezone,
    );
  }

  if (kind === "at") {
    const at = typeof schedule?.at === "string" ? schedule.at : null;
    return withTimezone(formatAtSchedule(at), input.timezone);
  }

  return describeCronExpression(input.scheduleExpression, input.timezone);
}

export function describeCronExpression(
  expression: string,
  timezone?: string | null,
) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return withTimezone(expression, timezone);
  }

  const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] =
    parts;

  const minute = parseField(minuteExpr, { max: 59, min: 0, names: null });
  const hour = parseField(hourExpr, { max: 23, min: 0, names: null });
  const dayOfMonth = parseField(dayOfMonthExpr, {
    max: 31,
    min: 1,
    names: null,
  });
  const month = parseField(monthExpr, {
    max: 12,
    min: 1,
    names: MONTH_NAMES,
  });
  const dayOfWeek = parseField(dayOfWeekExpr, {
    max: 7,
    min: 0,
    names: DAY_NAMES,
  });

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return withTimezone(expression, timezone);
  }

  const dailyPattern =
    isAny(dayOfMonth) && isAny(month) && isAny(dayOfWeek)
      ? describeDailyPattern(minute, hour)
      : null;

  if (dailyPattern) {
    return withTimezone(dailyPattern, timezone);
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isAny(dayOfMonth) &&
    isAny(month) &&
    isNamedOrNumericList(dayOfWeek)
  ) {
    return withTimezone(
      `Every ${formatWeekdays(dayOfWeek)} at ${formatTime(hour.value, minute.value)}`,
      timezone,
    );
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isNamedOrNumericList(dayOfMonth) &&
    isAny(month) &&
    isAny(dayOfWeek)
  ) {
    return withTimezone(
      `Every month on ${formatMonthDays(dayOfMonth)} at ${formatTime(hour.value, minute.value)}`,
      timezone,
    );
  }

  if (
    isExact(minute) &&
    isExact(hour) &&
    isNamedOrNumericList(dayOfMonth) &&
    isNamedOrNumericList(month) &&
    isAny(dayOfWeek)
  ) {
    return withTimezone(
      `Every ${formatMonths(month)} ${formatMonthDays(dayOfMonth)} at ${formatTime(hour.value, minute.value)}`,
      timezone,
    );
  }

  return withTimezone(expression, timezone);
}

function describeDailyPattern(minute: ParsedField, hour: ParsedField) {
  if (isEvery(minute) && minute.step === 1 && isAny(hour)) {
    return "Every minute";
  }

  if (isEvery(minute) && isAny(hour)) {
    return `Every ${minute.step} minutes`;
  }

  if (isExact(minute) && isAny(hour)) {
    return `Every hour at :${pad2(minute.value)}`;
  }

  if (isExact(minute) && isEvery(hour)) {
    return `Every ${hour.step} hours at :${pad2(minute.value)}`;
  }

  if (isExact(minute) && isExact(hour)) {
    return `Every day at ${formatTime(hour.value, minute.value)}`;
  }

  return null;
}

function parseField(
  raw: string,
  options: {
    max: number;
    min: number;
    names: readonly string[] | null;
  },
): ParsedField | null {
  if (raw === "*") {
    return { kind: "any" };
  }

  const everyMatch = /^\*\/(\d+)$/.exec(raw);
  if (everyMatch) {
    const step = Number.parseInt(everyMatch[1], 10);
    if (step >= 1) {
      return { kind: "every", step };
    }

    return null;
  }

  if (raw.includes(",")) {
    const values = raw
      .split(",")
      .map((part) => parseValue(part, options))
      .filter((value): value is number => value !== null);

    if (values.length === raw.split(",").length) {
      return {
        kind: "list",
        values: Array.from(new Set(values)).sort((a, b) => a - b),
      };
    }

    return null;
  }

  const value = parseValue(raw, options);
  if (value === null) {
    return null;
  }

  return { kind: "exact", value };
}

function parseValue(
  raw: string,
  options: {
    max: number;
    min: number;
    names: readonly string[] | null;
  },
) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return options.names ? parseNamedValue(trimmed, options.names) : null;
  }

  const numeric = Number.parseInt(trimmed, 10);

  if (
    Number.isInteger(numeric) &&
    numeric >= options.min &&
    numeric <= options.max
  ) {
    if (options.names === DAY_NAMES && numeric === 7) {
      return 0;
    }

    return numeric;
  }

  return null;
}

function parseNamedValue(trimmed: string, names: readonly string[]) {
  const matchIndex = names.findIndex(
    (name) => name.toLowerCase() === trimmed.slice(0, 3).toLowerCase(),
  );

  if (matchIndex === -1) {
    return null;
  }

  return names === MONTH_NAMES ? matchIndex + 1 : matchIndex;
}

function formatWeekdays(
  field: Extract<ParsedField, { kind: "exact" | "list" }>,
) {
  const values = field.kind === "exact" ? [field.value] : field.values;
  return values.map((value) => DAY_NAMES[value] ?? String(value)).join(", ");
}

function formatMonthDays(
  field: Extract<ParsedField, { kind: "exact" | "list" }>,
) {
  const values = field.kind === "exact" ? [field.value] : field.values;
  return values.map((value) => `day ${value}`).join(", ");
}

function formatMonths(field: Extract<ParsedField, { kind: "exact" | "list" }>) {
  const values = field.kind === "exact" ? [field.value] : field.values;
  return values
    .map((value) => MONTH_NAMES[value - 1] ?? String(value))
    .join(", ");
}

function formatTime(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function formatAtSchedule(at: string | null) {
  if (!at) {
    return "One-time";
  }

  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    return at;
  }

  return `Once at ${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
}

function withTimezone(description: string, timezone?: string | null) {
  if (!timezone || timezone === "UTC") {
    return description;
  }

  return `${description} (${timezone})`;
}

function isAny(field: ParsedField) {
  return field.kind === "any";
}

function isEvery(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "every" }> {
  return field.kind === "every";
}

function isExact(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "exact" }> {
  return field.kind === "exact";
}

function isNamedOrNumericList(
  field: ParsedField,
): field is Extract<ParsedField, { kind: "exact" | "list" }> {
  return field.kind === "exact" || field.kind === "list";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

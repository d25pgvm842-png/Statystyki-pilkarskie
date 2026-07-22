const WARSAW_TIME_ZONE = "Europe/Warsaw";

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function warsawLocalToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}) {
  const target = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0,
  );
  let guess = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = dateParts(new Date(guess));
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = target - represented;
    guess += correction;
    if (correction === 0) break;
  }

  return new Date(guess);
}

export function warsawDateKey(value: Date) {
  const { year, month, day } = dateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function warsawDayBounds(value: Date) {
  const { year, month, day } = dateParts(value);
  const following = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    start: warsawLocalToUtc({ year, month, day }),
    end: warsawLocalToUtc({
      year: following.getUTCFullYear(),
      month: following.getUTCMonth() + 1,
      day: following.getUTCDate(),
    }),
  };
}

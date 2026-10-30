function icsStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function fold(value: string) {
  return value.replace(/\r?\n/g, "\\n");
}

export function bookingIcs(input: {
  uid: string;
  summary: string;
  description?: string;
  start?: Date | null;
  end?: Date | null;
  allDay?: string | null;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Amalfi Media//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}@amalfimedia.xyz`,
    `DTSTAMP:${icsStamp(new Date())}`,
  ];
  if (input.start) {
    lines.push(`DTSTART:${icsStamp(input.start)}`);
    if (input.end) lines.push(`DTEND:${icsStamp(input.end)}`);
  } else if (input.allDay && /^\d{4}-\d{2}-\d{2}$/.test(input.allDay)) {
    lines.push(`DTSTART;VALUE=DATE:${input.allDay.replaceAll("-", "")}`);
  }
  lines.push(`SUMMARY:${fold(input.summary)}`);
  if (input.description) lines.push(`DESCRIPTION:${fold(input.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

import { z } from "zod";

export const ThemeSchema = z.object({
  background: z.string(),
  accent: z.string(),
  text: z.string()
});

export const CalendarSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  enabled: z.boolean()
});

export const ConfigSchema = z.object({
  version: z.number().int(),
  admin: z.object({
    username: z.string(),
    passwordHash: z.string()
  }),
  display: z.object({
    defaultView: z.enum(["month", "activity"]),
    timeFormat: z.enum(["12h", "24h"]),
    theme: ThemeSchema,
    dailyResetMinutes: z.number().int().min(0).max(1440)
  }),
  refresh: z.object({
    calendarMinutes: z.number().int().min(1),
    weatherMinutes: z.number().int().min(1)
  }),
  calendars: z.array(CalendarSourceSchema),
  google: z.object({
    syncDays: z.number().int().min(1).max(365)
  }),
  weather: z.object({
    provider: z.literal("weathergov"),
    units: z.enum(["metric", "imperial"]),
    location: z.object({
      type: z.enum(["city", "coords"]),
      value: z.string(),
      lat: z.number().optional(),
      lon: z.number().optional()
    })
  })
});

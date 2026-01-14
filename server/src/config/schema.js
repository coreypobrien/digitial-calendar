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

export const IcalFeedSchema = z.object({
  url: z.string().url(),
  label: z.string(),
  enabled: z.boolean(),
  color: z.string().optional()
});

export const ConfigSchema = z.object({
  version: z.number().int(),
  admin: z.object({
    username: z.string(),
    passwordHash: z.string()
  }),
  display: z.object({
    defaultView: z.enum(["month", "fourWeek", "week", "activity", "chores"]),
    timeFormat: z.enum(["12h", "24h"]),
    theme: ThemeSchema,
    mergeCalendars: z.boolean(),
    backfillPast: z.object({
      month: z.boolean(),
      fourWeek: z.boolean(),
      week: z.boolean()
    }),
    backfillPastDebounceSeconds: z.number().int().min(5).max(3600)
  }),
  refresh: z.object({
    calendarSyncMinutes: z.number().int().min(1),
    weatherSyncMinutes: z.number().int().min(1),
    clientMinutes: z.number().int().min(1)
  }),
  calendars: z.array(CalendarSourceSchema),
  ical: z.object({
    feeds: z.array(IcalFeedSchema)
  }),
  google: z.object({
    syncDays: z.number().int().min(1).max(365)
  }),
  weather: z.object({
    provider: z.literal("weathergov"),
    units: z.enum(["metric", "imperial"]),
    showIcons: z.boolean(),
    location: z.object({
      type: z.enum(["city", "coords"]),
      value: z.string(),
      lat: z.number().optional(),
      lon: z.number().optional()
    })
  })
});

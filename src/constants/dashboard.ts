import type { LeaderboardRow, SummaryCard } from "@/types";

/**
 * Dummy data only — no backend exists yet. Figures mirror the Workpex dashboard
 * screenshots so the layout can be compared against ui-reference/.
 */
export const SUMMARY_CARDS: readonly SummaryCard[] = [
  {
    id: "overdue",
    label: "Overdue Follow-ups",
    value: "81",
    caption: "Follow-ups missed their scheduled time.",
    tone: "warning",
  },
  {
    id: "hot",
    label: "Hot Leads",
    value: "1735",
    caption: "Leads with high conversion potential",
    tone: "danger",
  },
  {
    id: "today",
    label: "Todays Leads",
    value: "39",
    caption: "Leads assigned today.",
    tone: "info",
  },
  {
    id: "today-follow",
    label: "Todays Follow-ups",
    value: "5",
    caption: "Todays scheduled follow-ups",
    tone: "brand",
  },
  {
    id: "qualified",
    label: "Qualified Leads",
    value: "224",
    caption: "Leads in Qualified Status.",
    tone: "success",
  },
];

export const LEADERBOARD_ROWS: readonly LeaderboardRow[] = [
  {
    id: "1",
    agent: "NIHAD V P",
    leads: 1283,
    calls: 1090,
    convertedAmount: 25201,
    conversionRate: 89.5,
  },
  {
    id: "2",
    agent: "JAHID N",
    leads: 1100,
    calls: 1262,
    convertedAmount: 8691,
    conversionRate: 75.75,
  },
  {
    id: "3",
    agent: "RANJITH LAL",
    leads: 341,
    calls: 714,
    convertedAmount: 5231,
    conversionRate: 62.4,
  },
  {
    id: "4",
    agent: "Ansar UAE",
    leads: 785,
    calls: 1588,
    convertedAmount: 34601,
    conversionRate: 66.5,
  },
  {
    id: "5",
    agent: "SHIBIL P",
    leads: 612,
    calls: 903,
    convertedAmount: 12440,
    conversionRate: 58.2,
  },
  {
    id: "6",
    agent: "ADWAITHA T M",
    leads: 1096,
    calls: 421,
    convertedAmount: 19870,
    conversionRate: 71.1,
  },
  {
    id: "7",
    agent: "RAHIYAD K",
    leads: 498,
    calls: 655,
    convertedAmount: 7310,
    conversionRate: 44.9,
  },
  {
    id: "8",
    agent: "NEHA P",
    leads: 522,
    calls: 733,
    convertedAmount: 9105,
    conversionRate: 51.3,
  },
];

export const TEAM_TOTALS = {
  totalLeads: "4,598",
  totalCalls: "13,414",
  totalConversion: "203,234",
} as const;

/** Signed-in user is not available until Authentication lands; values match the reference. */
export const CURRENT_USER = {
  name: "Ahamed Emarath",
  phone: "8157897198",
  initials: "AE",
} as const;

export const NOTIFICATION_COUNT = 50;

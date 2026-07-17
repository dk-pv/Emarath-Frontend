import type { FilterField } from "@/types";

/** Mock rows only — no backend exists yet. */
export type DemoLead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  agent: string;
  amount: number;
};

export const LEAD_STATUSES = [
  { label: "New", value: "New" },
  { label: "Qualified", value: "Qualified" },
  { label: "Hot", value: "Hot" },
  { label: "Follow-up", value: "Follow-up" },
  { label: "Cancelled", value: "Cancelled" },
] as const;

export const LEAD_SOURCES = [
  { label: "Web Form", value: "Web Form" },
  { label: "Facebook", value: "Facebook" },
  { label: "Walk-in", value: "Walk-in" },
  { label: "Referral", value: "Referral" },
] as const;

export const LEAD_AGENTS = [
  { label: "NIHAD V P", value: "NIHAD V P" },
  { label: "JAHID N", value: "JAHID N" },
  { label: "RANJITH LAL", value: "RANJITH LAL" },
  { label: "Ansar UAE", value: "Ansar UAE" },
] as const;

/**
 * Field definitions handed to the shared filter panel. A real module supplies its own
 * list; the panel itself knows nothing about leads.
 */
export const LEAD_FILTER_FIELDS: readonly FilterField[] = [
  { key: "status", label: "Status", type: "multi", options: LEAD_STATUSES },
  { key: "source", label: "Source", type: "select", options: LEAD_SOURCES },
  {
    key: "agent",
    label: "Assigned agent",
    type: "select",
    options: LEAD_AGENTS,
  },
  { key: "amount", label: "Minimum amount", type: "number" },
];

const NAMES = [
  "Ahmed Hassan",
  "Fatima Ali",
  "Mohammed Rashid",
  "Layla Ibrahim",
  "Omar Khalid",
  "Noor Abdullah",
  "Yusuf Karim",
  "Maryam Saeed",
  "Hamza Nasser",
  "Zainab Farid",
  "Bilal Ahmed",
  "Huda Mansour",
  "Tariq Aziz",
  "Salma Younis",
  "Rami Haddad",
  "Dina Barakat",
  "Khalil Osman",
  "Amira Sultan",
  "Faisal Noor",
  "Rania Jaber",
];

/** Deterministic so server and client render identically — no Math.random(). */
export const DEMO_LEADS: readonly DemoLead[] = NAMES.map((name, i) => ({
  id: String(i + 1),
  name,
  phone: `05${String(50000000 + i * 137911).slice(0, 8)}`,
  source: LEAD_SOURCES[i % LEAD_SOURCES.length].value,
  status: LEAD_STATUSES[i % LEAD_STATUSES.length].value,
  agent: LEAD_AGENTS[i % LEAD_AGENTS.length].value,
  amount: 1500 + i * 1275,
}));

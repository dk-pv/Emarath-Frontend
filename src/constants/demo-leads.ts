import { createMemorySource } from "@/lib/list-source";
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

const FIRST_NAMES = [
  "Ahmed",
  "Fatima",
  "Mohammed",
  "Layla",
  "Omar",
  "Noor",
  "Yusuf",
  "Maryam",
  "Hamza",
  "Zainab",
  "Bilal",
  "Huda",
  "Tariq",
  "Salma",
  "Rami",
  "Dina",
  "Khalil",
  "Amira",
  "Faisal",
  "Rania",
];

const LAST_NAMES = [
  "Hassan",
  "Ali",
  "Rashid",
  "Ibrahim",
  "Khalid",
  "Abdullah",
  "Karim",
  "Saeed",
  "Nasser",
  "Farid",
  "Mansour",
  "Aziz",
  "Younis",
  "Haddad",
  "Barakat",
  "Osman",
  "Sultan",
  "Jaber",
  "Salem",
  "Mubarak",
];

/** FND-03.1 AC5 sets the floor at 15,000; the real Leads list is expected to exceed it. */
const ROW_COUNT = 15_000;

/**
 * Deterministic so server and client render identically — no Math.random(). Generated
 * rather than written out so the size is a constant, not 15,000 lines of bundle.
 *
 * Co-prime strides against the list lengths keep every field from marching in lockstep,
 * which would make filters look like they work when they only ever hit one bucket.
 */
export const DEMO_LEADS: readonly DemoLead[] = Array.from(
  { length: ROW_COUNT },
  (_, i) => ({
    id: String(i + 1),
    name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`,
    phone: `05${50000000 + i * 137}`,
    source: LEAD_SOURCES[(i * 3) % LEAD_SOURCES.length].value,
    status: LEAD_STATUSES[(i * 2) % LEAD_STATUSES.length].value,
    agent: LEAD_AGENTS[(i * 5) % LEAD_AGENTS.length].value,
    amount: 1500 + ((i * 1275) % 400_000),
  }),
);

/**
 * Stands in for the Leads list endpoint until one exists. Everything past `size` stays in
 * here, so the table only ever receives one page — the point of AC1.
 */
export const queryDemoLeads = createMemorySource({
  rows: DEMO_LEADS,
  fields: LEAD_FILTER_FIELDS,
  getValue: (row, key) =>
    (row[key as keyof DemoLead] ?? null) as string | number | null,
  searchFields: ["name", "phone"],
});

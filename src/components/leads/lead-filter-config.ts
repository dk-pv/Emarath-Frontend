import type { LookupType } from "@/services/lookups-service";
import type { SelectOption } from "@/types";

/**
 * The Leads advanced filter — single source of truth (Workpex "Filter", ADR-0039/0040).
 * Every field maps to a kind; every kind maps to an operator family and a value control.
 * The backend whitelist in `lead-conditions.ts` mirrors these field keys + operators.
 */

export type LeadFilterOperator =
  | "equals"
  | "notEquals"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "on"
  | "before"
  | "after"
  | "between"
  | "notBetween"
  | "is"
  | "isnt"
  | "contains"
  | "doesntContain"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty";

export type LeadFilterFieldKind =
  "text" | "numeric" | "date" | "enum" | "user" | "tags";

export type LeadFilterFieldDef = {
  key: string;
  label: string;
  kind: LeadFilterFieldKind;
  /** Enum fields draw their value options from this lookup. */
  lookup?: LookupType;
  /** Shown in the field list but not yet filterable (no backing column). */
  queryable?: boolean;
};

/**
 * The 32 filterable fields in the Workpex order and labels. `Created By` is shown but
 * `queryable: false` — `Lead` records no creator, so it cannot be filtered yet (audit).
 */
export const LEAD_FILTER_FIELDS: readonly LeadFilterFieldDef[] = [
  { key: "actualAmount", label: "Actual Amount", kind: "numeric" },
  { key: "assignedDate", label: "Assigned Date", kind: "date" },
  { key: "assignedAgent", label: "Assigned User", kind: "user" },
  { key: "bookingDate", label: "BOOKING DATE", kind: "date" },
  {
    key: "callStatus",
    label: "Call Status",
    kind: "enum",
    lookup: "callStatus",
  },
  { key: "category", label: "Category", kind: "enum", lookup: "categories" },
  { key: "city", label: "CITY", kind: "text" },
  { key: "complaints", label: "COMPLAINTS", kind: "text" },
  { key: "country", label: "Country", kind: "text" },
  { key: "createdBy", label: "Created By", kind: "user", queryable: false },
  { key: "createdAt", label: "Created Date", kind: "date" },
  { key: "firstName", label: "First name", kind: "text" },
  { key: "followUpDate", label: "Follow Up Date", kind: "date" },
  { key: "forecastedAmount", label: "Forecasted Amount", kind: "numeric" },
  { key: "language", label: "Language", kind: "enum", lookup: "languages" },
  { key: "name", label: "Lead Name", kind: "text" },
  {
    key: "pipeline",
    label: "Lead Pipeline",
    kind: "enum",
    lookup: "pipelines",
  },
  { key: "source", label: "Lead Source", kind: "text" },
  { key: "status", label: "Lead Status", kind: "enum", lookup: "leadStatus" },
  { key: "nationalCode", label: "National Code", kind: "text" },
  { key: "callAttempts", label: "NO.OF CALL ATTEMTS", kind: "numeric" },
  { key: "whatsappAttempts", label: "NO.OF MSG ATTEMPTS", kind: "numeric" },
  {
    key: "paymentMethod",
    label: "Payment Method",
    kind: "enum",
    lookup: "paymentMethods",
  },
  { key: "primaryPhone", label: "Phone", kind: "text" },
  { key: "product", label: "Product", kind: "enum", lookup: "products" },
  { key: "product2", label: "PRODUCT 2", kind: "text" },
  { key: "productQty", label: "QTY", kind: "numeric" },
  { key: "product2Qty", label: "QTY OF PRODUCT 2", kind: "numeric" },
  { key: "secondaryPhone", label: "Secondary Phone", kind: "text" },
  { key: "state", label: "State", kind: "text" },
  { key: "street", label: "Street", kind: "text" },
  { key: "tags", label: "Tags", kind: "tags" },
];

export const FIELD_OPTIONS: SelectOption[] = LEAD_FILTER_FIELDS.map((f) => ({
  value: f.key,
  label: f.label,
}));

export function fieldDef(key: string | null): LeadFilterFieldDef | undefined {
  return LEAD_FILTER_FIELDS.find((f) => f.key === key);
}

const NUMERIC_OPS: LeadFilterOperator[] = [
  "equals",
  "notEquals",
  "lessThan",
  "lessThanOrEqual",
  "greaterThan",
  "greaterThanOrEqual",
  "between",
  "notBetween",
  "isEmpty",
  "isNotEmpty",
];
const DATE_OPS: LeadFilterOperator[] = [
  "on",
  "before",
  "after",
  "between",
  "notBetween",
  "isEmpty",
  "isNotEmpty",
];
const TEXT_OPS: LeadFilterOperator[] = [
  "is",
  "isnt",
  "contains",
  "doesntContain",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];
const CHOICE_OPS: LeadFilterOperator[] = [
  "is",
  "isnt",
  "isEmpty",
  "isNotEmpty",
];

export const OPERATOR_LABEL: Record<LeadFilterOperator, string> = {
  equals: "Equals",
  notEquals: "Not Equals",
  lessThan: "Less Than",
  lessThanOrEqual: "Less Than or Eq..",
  greaterThan: "Greater Than",
  greaterThanOrEqual: "Greater Than or..",
  between: "Between",
  notBetween: "Not Between",
  on: "On",
  before: "Before",
  after: "After",
  is: "Is",
  isnt: "Isn't",
  contains: "Contains",
  doesntContain: "Doesn't Contain",
  startsWith: "Starts With",
  endsWith: "Ends With",
  isEmpty: "Is Empty",
  isNotEmpty: "Is Not Empty",
};

export function operatorsFor(kind: LeadFilterFieldKind): LeadFilterOperator[] {
  switch (kind) {
    case "numeric":
      return NUMERIC_OPS;
    case "date":
      return DATE_OPS;
    case "text":
      return TEXT_OPS;
    default:
      return CHOICE_OPS;
  }
}

export function operatorOptions(kind: LeadFilterFieldKind): SelectOption[] {
  return operatorsFor(kind).map((op) => ({
    value: op,
    label: OPERATOR_LABEL[op],
  }));
}

export function operatorNeedsValue(op: LeadFilterOperator): boolean {
  return op !== "isEmpty" && op !== "isNotEmpty";
}
export function operatorIsRange(op: LeadFilterOperator): boolean {
  return op === "between" || op === "notBetween";
}

/** The value control the third slot renders for a (kind, operator) pair. */
export type ValueControl =
  | "none"
  | "number"
  | "numberRange"
  | "date"
  | "dateRange"
  | "text"
  | "enumMulti"
  | "userMulti"
  | "tagsMulti";

export function valueControl(
  kind: LeadFilterFieldKind,
  op: LeadFilterOperator,
): ValueControl {
  if (!operatorNeedsValue(op)) return "none";
  switch (kind) {
    case "numeric":
      return operatorIsRange(op) ? "numberRange" : "number";
    case "date":
      return operatorIsRange(op) ? "dateRange" : "date";
    case "text":
      return "text";
    case "enum":
      return "enumMulti";
    case "user":
      return "userMulti";
    case "tags":
      return "tagsMulti";
    default:
      return "text";
  }
}

export type LeadFilterRow = {
  id: string;
  field: string | null;
  operator: LeadFilterOperator | null;
  /** enum/user/tags: ids. text/number: [value]. range: [a,b]. date: ISO day string(s). */
  values: string[];
};

let rowCounter = 0;
export function emptyRow(): LeadFilterRow {
  rowCounter += 1;
  return { id: `cond-${rowCounter}`, field: null, operator: null, values: [] };
}

/** A row applies only when its field is queryable and its operator + values are all valid. */
export function rowIsComplete(row: LeadFilterRow): boolean {
  const def = fieldDef(row.field);
  if (!def || def.queryable === false || !row.operator) return false;
  if (!operatorsFor(def.kind).includes(row.operator)) return false;
  const control = valueControl(def.kind, row.operator);
  if (control === "none") return true;
  if (control === "numberRange" || control === "dateRange")
    return row.values.length === 2 && row.values.every(Boolean);
  return row.values.length > 0 && Boolean(row.values[0]);
}

export function activeConditionCount(rows: readonly LeadFilterRow[]): number {
  return rows.filter(rowIsComplete).length;
}

/** Local midnight for a picked day, as an ISO instant the server compares to. */
function startOfDayIso(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}
function nextDayIso(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
}

type ConditionPayload = {
  field: string;
  operator: LeadFilterOperator;
  values: string[];
};

/** A date row's picked day(s) → the half-open instant boundaries the server expects. */
function datePayloadValues(op: LeadFilterOperator, values: string[]): string[] {
  switch (op) {
    case "on":
      return [startOfDayIso(values[0]), nextDayIso(values[0])];
    case "before":
      return [startOfDayIso(values[0])];
    case "after":
      return [nextDayIso(values[0])];
    case "between":
    case "notBetween":
      return [startOfDayIso(values[0]), nextDayIso(values[1])];
    default:
      return [];
  }
}

/**
 * The applied conditions as the JSON `conditions` param, or undefined when none are
 * complete. Date rows convert to boundary instants; every other kind sends its values
 * as-is; non-queryable fields (Created By) are never included.
 */
export function buildConditionsPayload(
  rows: readonly LeadFilterRow[],
): string | undefined {
  const payload: ConditionPayload[] = rows.filter(rowIsComplete).map((row) => {
    const def = fieldDef(row.field)!;
    const operator = row.operator!;
    if (!operatorNeedsValue(operator)) {
      return { field: def.key, operator, values: [] };
    }
    if (def.kind === "date") {
      return {
        field: def.key,
        operator,
        values: datePayloadValues(operator, row.values),
      };
    }
    return { field: def.key, operator, values: row.values };
  });
  return payload.length > 0 ? JSON.stringify(payload) : undefined;
}

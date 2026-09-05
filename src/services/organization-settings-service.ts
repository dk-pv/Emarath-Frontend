import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";

/**
 * Settings → Organization Setup → General Settings.
 *
 * One JSON row in `app_settings`, read and written exactly as the Sales & CRM settings
 * screens are. The vocabularies below mirror `organization-general.dto.ts` so the offered
 * options and the accepted values cannot drift; the currency catalogue is the exception —
 * it is 156 entries, so it is fetched from `GET /api/lookups/currencies` rather than
 * duplicated here (ADR-0065).
 */

export const DATE_DISPLAY_FORMATS = [
  "D, d M Y",
  "d-m-Y",
  "d/m/Y",
  "m-d-Y",
  "m/d/Y",
  "Y-m-d",
  "Y/m/d",
  "Y-d-m",
  "Y/d/m",
] as const;
export type DateDisplayFormat = (typeof DATE_DISPLAY_FORMATS)[number];

export const PAGINATION_LIMITS = [10, 20, 50, 100] as const;
export type PaginationLimit = (typeof PAGINATION_LIMITS)[number];

/** Sunday first, as the reference's Off Days dropdown lists them. */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MERIDIEMS = ["AM", "PM"] as const;
export type Meridiem = (typeof MERIDIEMS)[number];

/** The reference's shift controls: 1–12, 00–59, AM/PM. */
export const SHIFT_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
export const SHIFT_MINUTES = Array.from({ length: 60 }, (_, i) => i);

export interface OrganizationGeneralSettings {
  currency: string;
  dateDisplayFormat: DateDisplayFormat;
  tablePaginationLimit: PaginationLimit;
  organizationalGrouping: boolean;
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftStartPeriod: Meridiem;
  shiftEndHour: number;
  shiftEndMinute: number;
  shiftEndPeriod: Meridiem;
  offDays: Weekday[];
  productModuleEnabled: boolean;
}

export function fetchOrganizationGeneral(
  signal?: AbortSignal,
): Promise<OrganizationGeneralSettings> {
  return apiGet<OrganizationGeneralSettings>(
    "/settings/organization/general",
    undefined,
    signal,
  );
}

export function saveOrganizationGeneral(
  input: OrganizationGeneralSettings,
): Promise<OrganizationGeneralSettings> {
  return apiPut<OrganizationGeneralSettings>(
    "/settings/organization/general",
    input,
  );
}

/**
 * Settings → Organization Setup → Company Details.
 *
 * A second JSON row in `app_settings`, alongside the general settings above. The telephone
 * is kept the way `Lead.primaryPhone` is — dial digits followed by the local number, no
 * "+" — with the dialling country stored beside it so the flag comes back exactly as it
 * was chosen rather than being guessed from an ambiguous prefix (ADR-0066).
 */
export interface OrganizationCompanyDetails {
  companyName: string;
  address: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  /** ISO 3166-1 alpha-2, matching `constants/countries.ts`. */
  telephoneCountry: string;
  telephone: string;
  email: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
}

export function fetchOrganizationCompany(
  signal?: AbortSignal,
): Promise<OrganizationCompanyDetails> {
  return apiGet<OrganizationCompanyDetails>(
    "/settings/organization/company-details",
    undefined,
    signal,
  );
}

export function saveOrganizationCompany(
  input: OrganizationCompanyDetails,
): Promise<OrganizationCompanyDetails> {
  return apiPut<OrganizationCompanyDetails>(
    "/settings/organization/company-details",
    input,
  );
}

/**
 * Settings → Organization Setup → Host Mapping.
 *
 * A third row in `app_settings`, holding the whole domain list rather than one record
 * (ADR-0067). Every mutation returns the list it produced, so the screen redraws from the
 * response instead of refetching.
 */
export interface HostDomain {
  id: string;
  domainName: string;
  fromEmailAddress: string;
  fromEmailName: string;
  /** ISO-8601 — what the list's "Date and Time" column prints. */
  createdAt: string;
}

export interface OrganizationHostMapping {
  domains: HostDomain[];
}

/** The Add Domain form's payload: the three fields the reference draws. */
export interface CreateHostDomainInput {
  domainName: string;
  fromEmailAddress: string;
  fromEmailName: string;
}

export function fetchOrganizationHostMapping(
  signal?: AbortSignal,
): Promise<OrganizationHostMapping> {
  return apiGet<OrganizationHostMapping>(
    "/settings/organization/host-mapping",
    undefined,
    signal,
  );
}

export function addHostDomain(
  input: CreateHostDomainInput,
): Promise<OrganizationHostMapping> {
  return apiPost<OrganizationHostMapping>(
    "/settings/organization/host-mapping/domains",
    input,
  );
}

export function deleteHostDomain(
  id: string,
): Promise<OrganizationHostMapping> {
  return apiDelete<OrganizationHostMapping>(
    `/settings/organization/host-mapping/domains/${id}`,
  );
}

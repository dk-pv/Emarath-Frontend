"use client";

import { useEffect, useMemo, useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DatePicker } from "@/components/ui/DatePicker";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api-client";
import { COUNTRIES, STATES_BY_COUNTRY } from "@/constants/countries";
import { useAuth } from "@/components/auth/auth-context";
import { useLookup } from "@/hooks/use-lookup";
import {
  createLead,
  updateLead,
  type LeadEditData,
  type LeadListItem,
} from "@/services/leads-service";
import type {
  LeadCustomField,
  LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { SelectOption } from "@/types";

type LeadFormDrawerProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Present → Edit mode: the form is the same one New Lead uses, but it prefills
   * from this record and PUTs an update on submit instead of creating. Absent →
   * Create mode, unchanged.
   */
  lead?: LeadEditData;
  /** The active custom-column definitions (LEAD-05.1) to render as extra inputs. */
  customFields?: LeadCustomField[];
  /**
   * Create mode only: seed Lead Status and its pipeline. The Kanban stage-header "+"
   * (KAN-03.1) opens this pre-set to the stage it was clicked on, so the new lead lands
   * in that exact stage; the field stays editable. Ignored in Edit mode.
   */
  defaultStatus?: string;
  defaultPipeline?: string;
  /** Called with the created or updated row so the list can adopt it. */
  onSaved: (lead: LeadListItem) => void;
};

type FormState = {
  name: string;
  primaryPhone: string;
  firstName: string;
  secondaryPhone: string;
  email: string;
  assignedAgentIds: string[];
  status: string | null;
  tagIds: string[];
  complaintReason: string | null;
  product: string | null;
  productQty: string;
  product2: string | null;
  product2Qty: string;
  language: string | null;
  source: string | null;
  callStatus: string | null;
  callAttempts: string | null;
  msgAttempts: string | null;
  country: string | null;
  state: string | null;
  street: string;
  city: string;
  nationalCode: string;
  bookingDate: Date | null;
  pipeline: string | null;
  category: string | null;
  actualAmount: string;
  forecastedAmount: string;
  paymentMethod: string | null;
};

function initialForm(): FormState {
  return {
    name: "",
    primaryPhone: "",
    firstName: "",
    secondaryPhone: "",
    email: "",
    assignedAgentIds: [],
    status: "New",
    tagIds: [],
    complaintReason: null,
    product: null,
    productQty: "",
    product2: null,
    product2Qty: "",
    language: null,
    source: null,
    callStatus: null,
    callAttempts: null,
    msgAttempts: null,
    country: null,
    state: null,
    street: "",
    city: "",
    nationalCode: "",
    bookingDate: null,
    pipeline: "Lead Pipeline",
    category: null,
    actualAmount: "",
    forecastedAmount: "",
    paymentMethod: null,
  };
}

const isNumeric = (value: string) =>
  value.trim() !== "" && !Number.isNaN(Number(value));

/**
 * The booking date as a local calendar date (YYYY-MM-DD). `toISOString()` would
 * convert local midnight to UTC and shift the date a day west for the client's
 * UTC+4 users — the column is date-only, so only the calendar day should travel.
 */
const toDateOnly = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * The inverse of `toDateOnly` for edit prefill: parse "YYYY-MM-DD" into a *local*
 * calendar date. `new Date("2026-08-20")` would parse as UTC midnight and can shift
 * the day for the client's timezone, so the parts are fed to the local constructor
 * — the exact round-trip `toDateOnly` produces.
 */
const fromDateOnly = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
}));
const ISO2_BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c.iso2]));

/**
 * Builds the form state from an existing lead for Edit mode. Amounts/quantities are
 * already strings; a numeric attempt count of 0 maps to an empty select (the "not
 * set" the create form also shows), so it round-trips back to 0 on submit.
 */
function formFromEdit(lead: LeadEditData): FormState {
  return {
    name: lead.name,
    primaryPhone: lead.primaryPhone,
    firstName: lead.firstName ?? "",
    secondaryPhone: lead.secondaryPhone ?? "",
    email: lead.email ?? "",
    assignedAgentIds: lead.assignedAgents.map((a) => a.id),
    status: lead.status,
    tagIds: lead.tagIds,
    complaintReason: lead.complaintReason,
    product: lead.product,
    productQty: lead.productQty ?? "",
    product2: lead.product2,
    product2Qty: lead.product2Qty ?? "",
    language: lead.language,
    source: lead.source,
    callStatus: lead.callStatus,
    callAttempts: lead.callAttempts ? String(lead.callAttempts) : null,
    msgAttempts: lead.msgAttempts ? String(lead.msgAttempts) : null,
    country: lead.country,
    state: lead.state,
    street: lead.street ?? "",
    city: lead.city ?? "",
    nationalCode: lead.nationalCode ?? "",
    bookingDate: lead.bookingDate ? fromDateOnly(lead.bookingDate) : null,
    pipeline: lead.pipeline,
    category: lead.category,
    actualAmount: lead.actualAmount ?? "",
    forecastedAmount: lead.forecastedAmount ?? "",
    paymentMethod: lead.paymentMethod,
  };
}

/** Custom-field type → native input type. NUMBER also gets inputMode="decimal"; DATE
 * and DATETIME use the browser's native pickers (no captured Workpex control). */
const CUSTOM_INPUT_TYPE: Record<LeadCustomFieldType, string | undefined> = {
  TEXT: undefined,
  TEXTBOX: undefined,
  NUMBER: undefined,
  DATE: "date",
  DATETIME: "datetime-local",
};

/**
 * The Add New Lead drawer (LEAD-06.2), built from the Workpex `add-lead.mp4`: the
 * same field order and sections, required markers, searchable dropdowns and
 * calendar. Options come from the lookup providers; the phone and country/state
 * fields use the static country dataset. Required fields are validated before the
 * request, and the API's own validation surfaces as a banner.
 */
export function LeadFormDrawer({
  open,
  onClose,
  lead,
  customFields = [],
  defaultStatus,
  defaultPipeline,
  onSaved,
}: LeadFormDrawerProps) {
  const editing = lead !== undefined;
  // Assigned defaults to the current user on create (verified Workpex behaviour); on edit it
  // starts from the lead's existing assignees. The id comes from the server session (useAuth),
  // never a client-typed value, and the backend re-resolves the caller for scope/authorization.
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => {
    if (lead) return formFromEdit(lead);
    const base = { ...initialForm(), assignedAgentIds: user ? [user.id] : [] };
    // Stage-scoped create (Kanban "+"): land the lead in the clicked stage/pipeline.
    if (defaultStatus) base.status = defaultStatus;
    if (defaultPipeline) base.pipeline = defaultPipeline;
    return base;
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Seed the picker so every pre-selected assignee shows a name before (or without) the agent
  // list loading — the current user (create) or the lead's assignees (edit) may not be in the
  // assignable-agents list at all (e.g. an admin).
  const [agents, setAgents] = useState<SelectOption[]>(() =>
    lead
      ? lead.assignedAgents.map((a) => ({ value: a.id, label: a.name }))
      : user
        ? [{ value: user.id, label: user.name }]
        : [],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // Custom-column values (LEAD-05.1): a parallel bag keyed by the field's "cf_<slug>"
  // key, since the fixed FormState above can't hold dynamic ids. Prefilled from the
  // lead on edit; a blank field is simply absent.
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => (lead ? { ...lead.customFields } : {}),
  );
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const setCustom = (key: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
    setCustomErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  // The parent mounts this component fresh on each open (keyed render), so the
  // state above starts clean every time — no reset effect is needed.

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then((list) => {
        const options = list.map((agent) => ({
          value: agent.id,
          label: agent.name,
        }));
        // Keep every pre-selected assignee resolvable even when they aren't an
        // assignable agent (an admin, or a lead's existing assignees on edit), so a
        // chip never renders as a bare id.
        const seeds = lead
          ? lead.assignedAgents.map((a) => ({ value: a.id, label: a.name }))
          : user
            ? [{ value: user.id, label: user.name }]
            : [];
        for (const seed of seeds) {
          if (!options.some((option) => option.value === seed.value)) {
            options.unshift(seed);
          }
        }
        setAgents(options);
      })
      .catch(() => {
        /* the seed above keeps the pre-selected chips labelled on failure */
      });
    return () => controller.abort();
  }, [user, lead]);

  const leadStatus = useLookup("leadStatus");
  const pipelines = useLookup("pipelines");
  const languages = useLookup("languages");
  const sources = useLookup("sources");
  const callStatuses = useLookup("callStatus");
  const attempts = useLookup("attemptCounts");
  const categories = useLookup("categories");
  const paymentMethods = useLookup("paymentMethods");
  const complaintReasons = useLookup("complaintReasons");
  const products = useLookup("products");
  const tags = useLookup("tags");

  const stateOptions = useMemo<SelectOption[]>(() => {
    const iso2 = form.country ? ISO2_BY_NAME.get(form.country) : undefined;
    const states = iso2 ? (STATES_BY_COUNTRY[iso2] ?? []) : [];
    return states.map((name) => ({ value: name, label: name }));
  }, [form.country]);

  // Verified Workpex: only Lead Name, Primary Phone, Lead Pipeline and Lead Status are required
  // (the last two default to "Lead Pipeline"/"New"). Every other field is optional, but a value
  // typed into a numeric field must still parse — a blank one is simply "not set".
  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Customer Name is required";
    if (!form.primaryPhone.trim())
      next.primaryPhone = "Primary Phone is required";
    if (!form.pipeline) next.pipeline = "Lead Pipeline is required";
    if (!form.status) next.status = "Lead Status is required";
    if (form.actualAmount.trim() && !isNumeric(form.actualAmount))
      next.actualAmount = "Actual Amount must be a number";
    if (form.forecastedAmount.trim() && !isNumeric(form.forecastedAmount))
      next.forecastedAmount = "Forecasted Amount must be a number";
    if (form.productQty.trim() && !isNumeric(form.productQty))
      next.productQty = "QTY must be a number";
    if (form.product2Qty.trim() && !isNumeric(form.product2Qty))
      next.product2Qty = "QTY must be a number";
    setErrors(next);

    // Custom NUMBER fields must parse if filled (DATE/DATETIME are constrained by
    // their native inputs; the backend re-validates every custom value by type).
    const nextCustom: Record<string, string> = {};
    for (const field of customFields) {
      const value = (customValues[field.key] ?? "").trim();
      if (field.type === "NUMBER" && value && !isNumeric(value)) {
        nextCustom[field.key] = `${field.name} must be a number`;
      }
    }
    setCustomErrors(nextCustom);

    return (
      Object.keys(next).length === 0 && Object.keys(nextCustom).length === 0
    );
  }

  async function submit() {
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Same payload for create and update — the Edit form is the create form, so
      // it always submits the full record (a PUT replace on the backend).
      const payload = {
        name: form.name.trim(),
        primaryPhone: form.primaryPhone,
        firstName: form.firstName.trim() || undefined,
        secondaryPhone: form.secondaryPhone || undefined,
        email: form.email.trim() || undefined,
        assignedAgentIds: form.assignedAgentIds.length
          ? form.assignedAgentIds
          : undefined,
        status: form.status ?? undefined,
        pipeline: form.pipeline ?? undefined,
        tagIds: form.tagIds.length ? form.tagIds : undefined,
        complaintReason: form.complaintReason ?? undefined,
        product: form.product ?? undefined,
        productQty: form.productQty.trim() || undefined,
        product2: form.product2 ?? undefined,
        product2Qty: form.product2Qty.trim() || undefined,
        language: form.language ?? undefined,
        source: form.source ?? undefined,
        callStatus: form.callStatus ?? undefined,
        callAttempts: form.callAttempts ? Number(form.callAttempts) : undefined,
        msgAttempts: form.msgAttempts ? Number(form.msgAttempts) : undefined,
        country: form.country ?? undefined,
        state: form.state ?? undefined,
        street: form.street.trim() || undefined,
        city: form.city.trim() || undefined,
        nationalCode: form.nationalCode.trim() || undefined,
        bookingDate: form.bookingDate
          ? toDateOnly(form.bookingDate)
          : undefined,
        category: form.category ?? undefined,
        actualAmount: form.actualAmount.trim() || undefined,
        forecastedAmount: form.forecastedAmount.trim() || undefined,
        paymentMethod: form.paymentMethod ?? undefined,
        // Only non-blank values are sent; on update the backend full-replaces, so a
        // field the user cleared is dropped (LEAD-05.1).
        customFields: customFields
          .map((field) => ({
            fieldId: field.id,
            value: (customValues[field.key] ?? "").trim(),
          }))
          .filter((entry) => entry.value !== ""),
      };
      const saved = lead
        ? await updateLead(lead.id, payload)
        : await createLead(payload);
      onSaved(saved);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Something went wrong while saving the lead. Please try again.";
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? "Edit Lead" : "Add New Lead"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {editing
              ? submitting
                ? "Updating…"
                : "Update Lead"
              : submitting
                ? "Saving…"
                : "Submit"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {apiError && <FormError>{apiError}</FormError>}

        <FormField label="Customer Name" required error={errors.name}>
          {(control) => (
            <Input
              {...control}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Customer Name"
            />
          )}
        </FormField>

        <FormField label="Primary Phone" required error={errors.primaryPhone}>
          <PhoneInput
            value={form.primaryPhone}
            onChange={(v) => set("primaryPhone", v)}
            placeholder="Primary Phone"
            invalid={Boolean(errors.primaryPhone)}
          />
        </FormField>

        <FormField label="First Name">
          {(control) => (
            <Input
              {...control}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="First Name"
            />
          )}
        </FormField>

        <FormField label="Secondary Phone">
          <PhoneInput
            value={form.secondaryPhone}
            onChange={(v) => set("secondaryPhone", v)}
            placeholder="Secondary Phone"
          />
        </FormField>

        {/* Email (ADR-0032): backs the row Email composer's To prefill. Optional and
            validated server-side (@IsEmail); an invalid value surfaces in the banner. */}
        <FormField label="Email">
          {(control) => (
            <Input
              {...control}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="Email"
            />
          )}
        </FormField>

        <FormField label="Assigned">
          <MultiSelect
            searchable
            options={agents}
            value={form.assignedAgentIds}
            onChange={(v) => set("assignedAgentIds", v)}
            placeholder="Assigned"
          />
        </FormField>

        <FormField label="Lead Status" required error={errors.status}>
          <SearchableSelect
            searchable={false}
            clearable
            options={leadStatus.options}
            value={form.status}
            onChange={(v) => set("status", v)}
            loading={leadStatus.isLoading}
            invalid={Boolean(errors.status)}
            placeholder="Lead Status"
          />
        </FormField>

        <FormField label="Tags">
          <MultiSelect
            searchable
            options={tags.options}
            value={form.tagIds}
            onChange={(v) => set("tagIds", v)}
            placeholder="Tags"
          />
        </FormField>

        <FormField label="COMPLAINTS">
          <SearchableSelect
            searchable={false}
            clearable
            options={complaintReasons.options}
            value={form.complaintReason}
            onChange={(v) => set("complaintReason", v)}
            loading={complaintReasons.isLoading}
            placeholder="COMPLAINTS"
          />
        </FormField>

        <FormField label="Product" error={errors.product}>
          <SearchableSelect
            options={products.options}
            value={form.product}
            onChange={(v) => set("product", v)}
            loading={products.isLoading}
            invalid={Boolean(errors.product)}
            placeholder="Select Product"
          />
        </FormField>

        <FormField label="Language" error={errors.language}>
          <SearchableSelect
            searchable={false}
            options={languages.options}
            value={form.language}
            onChange={(v) => set("language", v)}
            loading={languages.isLoading}
            invalid={Boolean(errors.language)}
            placeholder="Select Language"
          />
        </FormField>

        <FormField label="Source">
          <SearchableSelect
            searchable={false}
            options={sources.options}
            value={form.source}
            onChange={(v) => set("source", v)}
            loading={sources.isLoading}
            placeholder="Source"
          />
        </FormField>

        <FormField label="QTY" error={errors.productQty}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={form.productQty}
              onChange={(e) => set("productQty", e.target.value)}
              placeholder="QTY"
            />
          )}
        </FormField>

        {/* Product 2 shares the SAME product dataset as Product (one list, no duplication). */}
        <FormField label="Product 2">
          <SearchableSelect
            options={products.options}
            value={form.product2}
            onChange={(v) => set("product2", v)}
            loading={products.isLoading}
            placeholder="Select Product 2"
          />
        </FormField>

        <FormField label="QTY OF PRODUCT 2" error={errors.product2Qty}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              value={form.product2Qty}
              onChange={(e) => set("product2Qty", e.target.value)}
              placeholder="QTY OF PRODUCT 2"
            />
          )}
        </FormField>

        <FormField label="Call Status" error={errors.callStatus}>
          <SearchableSelect
            searchable={false}
            options={callStatuses.options}
            value={form.callStatus}
            onChange={(v) => set("callStatus", v)}
            loading={callStatuses.isLoading}
            invalid={Boolean(errors.callStatus)}
            placeholder="Select Call Status"
          />
        </FormField>

        <FormField label="NO.OF CALL ATTEMTS" error={errors.callAttempts}>
          <SearchableSelect
            searchable={false}
            options={attempts.options}
            value={form.callAttempts}
            onChange={(v) => set("callAttempts", v)}
            loading={attempts.isLoading}
            invalid={Boolean(errors.callAttempts)}
            placeholder="Select NO.OF CALL ATTEMTS"
          />
        </FormField>

        <FormField label="NO.OF MSG ATTEMPTS">
          <SearchableSelect
            searchable={false}
            options={attempts.options}
            value={form.msgAttempts}
            onChange={(v) => set("msgAttempts", v)}
            loading={attempts.isLoading}
            placeholder="NO.OF MSG ATTEMPTS"
          />
        </FormField>

        <CollapsibleSection title="Address">
          <FormField label="Country" error={errors.country}>
            <SearchableSelect
              options={COUNTRY_OPTIONS}
              value={form.country}
              onChange={(v) => {
                set("country", v);
                set("state", null);
              }}
              invalid={Boolean(errors.country)}
              placeholder="Country"
            />
          </FormField>

          <FormField label="State">
            <SearchableSelect
              options={stateOptions}
              value={form.state}
              onChange={(v) => set("state", v)}
              placeholder="State"
            />
          </FormField>

          <FormField label="Street">
            {(control) => (
              <Input
                {...control}
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
                placeholder="Street"
              />
            )}
          </FormField>

          <FormField label="CITY">
            {(control) => (
              <Input
                {...control}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="CITY"
              />
            )}
          </FormField>

          <FormField label="National Code">
            {(control) => (
              <Textarea
                {...control}
                value={form.nationalCode}
                onChange={(e) => set("nationalCode", e.target.value)}
                placeholder="National Code"
              />
            )}
          </FormField>
        </CollapsibleSection>

        <FormField label="BOOKING DATE">
          <DatePicker
            numeric
            value={form.bookingDate}
            onChange={(d) => set("bookingDate", d)}
            placeholder="DD/MM/YYYY"
          />
        </FormField>

        <CollapsibleSection title="Notes">
          <FormField label="Lead Pipeline" required error={errors.pipeline}>
            <SearchableSelect
              searchable={false}
              clearable
              options={pipelines.options}
              value={form.pipeline}
              onChange={(v) => set("pipeline", v)}
              loading={pipelines.isLoading}
              invalid={Boolean(errors.pipeline)}
              placeholder="Lead Pipeline"
            />
          </FormField>

          <FormField label="Category">
            <SearchableSelect
              options={categories.options}
              value={form.category}
              onChange={(v) => set("category", v)}
              loading={categories.isLoading}
              placeholder="Select Category"
            />
          </FormField>

          <FormField label="Actual Amount" error={errors.actualAmount}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.actualAmount}
                onChange={(e) => set("actualAmount", e.target.value)}
                placeholder="Actual Amount"
              />
            )}
          </FormField>

          <FormField label="Forecasted Amount" error={errors.forecastedAmount}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                value={form.forecastedAmount}
                onChange={(e) => set("forecastedAmount", e.target.value)}
                placeholder="Forecasted Amount"
              />
            )}
          </FormField>

          <FormField label="Payment Method" error={errors.paymentMethod}>
            <SearchableSelect
              searchable={false}
              options={paymentMethods.options}
              value={form.paymentMethod}
              onChange={(v) => set("paymentMethod", v)}
              loading={paymentMethods.isLoading}
              invalid={Boolean(errors.paymentMethod)}
              placeholder="Select Payment Method"
            />
          </FormField>
        </CollapsibleSection>

        {/* Custom columns (LEAD-05.1): rendered by type, collected into the payload's
            `customFields`. Values prefill on edit and persist through the same
            create/update call as the standard fields. */}
        {customFields.length > 0 && (
          <CollapsibleSection title="Custom Fields">
            {customFields.map((field) => (
              <FormField
                key={field.key}
                label={field.name}
                error={customErrors[field.key]}
              >
                {(control) =>
                  field.type === "TEXTBOX" ? (
                    <Textarea
                      {...control}
                      value={customValues[field.key] ?? ""}
                      onChange={(e) => setCustom(field.key, e.target.value)}
                      placeholder={field.name}
                    />
                  ) : (
                    <Input
                      {...control}
                      type={CUSTOM_INPUT_TYPE[field.type]}
                      inputMode={
                        field.type === "NUMBER" ? "decimal" : undefined
                      }
                      value={customValues[field.key] ?? ""}
                      onChange={(e) => setCustom(field.key, e.target.value)}
                      placeholder={field.name}
                    />
                  )
                }
              </FormField>
            ))}
          </CollapsibleSection>
        )}
      </form>
    </Drawer>
  );
}

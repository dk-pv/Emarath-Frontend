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
import { customFieldsPayload } from "@/lib/lead-custom-values";
import { orderLockReason } from "@/lib/logistics-orders";
import { CONVERTED_STATUS } from "@/components/leads/lead-row-actions";
import { MOVE_PIPELINE_HINT } from "@/lib/pipeline-access";
import { COUNTRIES, STATES_BY_COUNTRY } from "@/constants/countries";
import { useAuth } from "@/components/auth/auth-context";
import { can } from "@/constants/permissions";
import { useLookup } from "@/hooks/use-lookup";
import { useTagAccess } from "@/hooks/use-tag-access";
import { useDuplicateCheck } from "@/hooks/use-duplicate-check";
import { LeadDuplicateWarning } from "@/components/leads/lead-duplicate-warning";
import { createTag } from "@/services/tags-service";
import {
  createLead,
  updateLead,
  type LeadEditData,
  type LeadListItem,
} from "@/services/leads-service";
import React from "react";
import {
  useLeadFormLayout,
  type LeadFormLayout,
} from "@/hooks/use-lead-form-layout";
import type {
  LeadCustomField,
  LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";
import { fetchAssignableAgents } from "@/services/lookups-service";
import { fetchStages } from "@/services/stages-service";
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
  /**
   * The active custom-column definitions (LEAD-05.1) to render as extra inputs.
   * Absent → no custom inputs, and an edit leaves the lead's custom values as they are.
   */
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
  /** The requested delivery day, asked for only when this save converts the lead to WON. */
  deliveryDate: Date | null;
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
    deliveryDate: null,
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
    deliveryDate: null,
    pipeline: lead.pipeline,
    category: lead.category,
    actualAmount: lead.actualAmount ?? "",
    forecastedAmount: lead.forecastedAmount ?? "",
    paymentMethod: lead.paymentMethod,
  };
}

/** Custom-field type → native input type. NUMBER also gets inputMode="decimal"; DATE
 * and DATETIME use the browser's native pickers (no captured Workpex control).
 * DROP_DOWN is listed but unused: it renders a select over the field's own configured
 * options rather than a typed input (ADR-0072). */
const CUSTOM_INPUT_TYPE: Record<LeadCustomFieldType, string | undefined> = {
  TEXT: undefined,
  TEXTBOX: undefined,
  NUMBER: undefined,
  DATE: "date",
  DATETIME: "datetime-local",
  DROP_DOWN: undefined,
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
  customFields,
  defaultStatus,
  defaultPipeline,
  onSaved,
}: LeadFormDrawerProps) {
  const editing = lead !== undefined;
  /*
    Settings > Data & Schema Management > Form Customization decides which fields this
    drawer shows (ADR-0072). Until it answers — and if it cannot be read at all — every
    field renders, so a settings failure never leaves the form blank. The four fields the
    create API refuses a lead without are not guarded: a form cannot hide them.
  */
  const layout = useLeadFormLayout();
  /*
    The custom fields the form still shows. Their *placement* is the layout's job — the
    renderer below orders and groups every field, system and custom alike, from the one
    configuration — so this only drops what the form hides.
  */
  const orderedCustomFields = useMemo(
    () => (customFields ?? []).filter((field) => layout.shows(field.key)),
    [customFields, layout],
  );
  // Assigned defaults to the current user on create (verified Workpex behaviour) when they can
  // be assigned leads at all — an administrator or a marketing analyst cannot, so theirs starts
  // empty; on edit it starts from the lead's existing assignees. The id comes from the server
  // session (useAuth), never a client-typed value, and the backend re-resolves the caller for
  // scope/authorization. Only a manager or an administrator may change it (`reassignLeads`, the
  // Reassign actions' rule); the server refuses anyone else, so for them the field is locked.
  const { user } = useAuth();
  const canAssign = can(user?.role, "reassignLeads");
  const [form, setForm] = useState<FormState>(() => {
    if (lead) return formFromEdit(lead);
    const base = {
      ...initialForm(),
      assignedAgentIds:
        user && can(user.role, "beAssignedLeads") ? [user.id] : [],
    };
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
  // list loading — on edit the lead's assignees, who may no longer be assignable (an admin, a
  // deactivated user) and are kept as they are; on create the current user, only when they are
  // pre-selected, so an administrator is never offered themselves (the server refuses it).
  const [agents, setAgents] = useState<SelectOption[]>(() =>
    lead
      ? lead.assignedAgents.map((a) => ({ value: a.id, label: a.name }))
      : user && can(user.role, "beAssignedLeads")
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
        // Keep every pre-selected assignee resolvable even when the list no longer offers
        // them (a lead's existing assignees on edit), so a chip never renders as a bare id.
        const seeds = lead
          ? lead.assignedAgents.map((a) => ({ value: a.id, label: a.name }))
          : user && can(user.role, "beAssignedLeads")
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

  const pipelines = useLookup("pipelines");

  // Lead Status offers the stages of the pipeline the form is on — a board's own
  // pipeline included — so a lead can't be saved with a status its board has no column
  // for (KAN-07.1 AC3). Each result is tagged with its pipeline, so a switch never shows
  // the previous pipeline's stages.
  const [stageOptions, setStageOptions] = useState<{
    pipeline: string;
    options: SelectOption[];
  } | null>(null);
  useEffect(() => {
    const pipeline = form.pipeline;
    if (!pipeline) return;
    const controller = new AbortController();
    fetchStages(pipeline, controller.signal)
      .then((stages) =>
        setStageOptions({
          pipeline,
          options: stages.map((s) => ({ value: s.name, label: s.name })),
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setStageOptions({ pipeline, options: [] });
      });
    return () => controller.abort();
  }, [form.pipeline]);
  const statusOptions =
    stageOptions?.pipeline === form.pipeline ? stageOptions.options : [];
  const statusLoading =
    form.pipeline !== null && stageOptions?.pipeline !== form.pipeline;
  const languages = useLookup("languages");
  const sources = useLookup("sources");
  const callStatuses = useLookup("callStatus");
  const attempts = useLookup("attemptCounts");
  const categories = useLookup("categories");
  const paymentMethods = useLookup("paymentMethods");
  const complaintReasons = useLookup("complaintReasons");
  const products = useLookup("products");
  // Every active tag, for the labels of tags already on the lead; which of them this user
  // may *select* is the Admin's call (Tag Permissions, ADR-0091) and comes from useTagAccess.
  const tags = useLookup("tags");
  const tagAccess = useTagAccess();

  /*
    The Tags picker offers only what the user may select. A tag already on the lead that they
    may not select stays visible as a locked chip — its checkbox and its × are disabled — and
    stays in the form's value, so saving the edit neither hides it nor silently drops it.
  */
  const tagOptions = useMemo<SelectOption[]>(() => {
    if (tagAccess.isLoading || tagAccess.isError) return [];
    const permitted = new Set(tagAccess.tags.map((tag) => tag.value));
    const locked = tags.options
      .filter(
        (option) =>
          form.tagIds.includes(option.value) && !permitted.has(option.value),
      )
      .map((option) => ({ ...option, disabled: true }));
    return [...tagAccess.tags, ...locked];
  }, [tagAccess, tags.options, form.tagIds]);
  const lockedTagCount = tagOptions.filter((option) => option.disabled).length;
  // Edit mode: a Logistics order owns the lead's status and pipeline (the server refuses a
  // change, 409), so both fields are shown but locked; every other field stays editable.
  const orderLock = orderLockReason(lead?.logisticsOrder);
  // Saving as WON converts a lead that is not converted yet, and the order that creates must
  // have the requested delivery date (client, 2026-10-17) — never the Booking Date. A lead that
  // is already WON, or already has its order, does not convert again and is asked nothing.
  const alreadyConverted =
    lead !== undefined &&
    (lead.status === CONVERTED_STATUS || Boolean(lead.logisticsOrder));
  const convertsToWon = form.status === CONVERTED_STATUS && !alreadyConverted;
  // Edit mode: only a manager or an administrator moves a lead to another pipeline (ADR-0093
  // B5), so for anyone else Pipeline is shown but locked. Its current value stays listed even
  // when the lookup does not offer it — a pipeline closed to this user, on a lead they see
  // because it is assigned to them.
  const pipelineLock =
    orderLock ??
    (editing && !can(user?.role, "moveLeadPipelines")
      ? MOVE_PIPELINE_HINT
      : null);
  const pipelineOptions = useMemo(
    () =>
      editing &&
      form.pipeline &&
      !pipelines.options.some((option) => option.value === form.pipeline)
        ? [...pipelines.options, { value: form.pipeline, label: form.pipeline }]
        : pipelines.options,
    [editing, form.pipeline, pipelines.options],
  );

  // Create mode only: an edit's own record would always match itself.
  const duplicates = useDuplicateCheck({
    enabled: !editing,
    primaryPhone: form.primaryPhone,
    secondaryPhone: form.secondaryPhone,
    email: form.email,
  });

  /** Creates a tag from the picker (when Tag Permissions allow it) and selects it. */
  async function createAndSelectTag(name: string) {
    try {
      const tag = await createTag({ name });
      setForm((prev) => ({ ...prev, tagIds: [...prev.tagIds, tag.id] }));
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Could not create the tag. Please try again.",
      );
    }
  }

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
    if (convertsToWon && !form.deliveryDate)
      next.deliveryDate =
        "Delivery Date is required to convert the lead to WON";
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
    for (const field of customFields ?? []) {
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
        deliveryDate:
          convertsToWon && form.deliveryDate
            ? toDateOnly(form.deliveryDate)
            : undefined,
        category: form.category ?? undefined,
        actualAmount: form.actualAmount.trim() || undefined,
        forecastedAmount: form.forecastedAmount.trim() || undefined,
        paymentMethod: form.paymentMethod ?? undefined,
        // Without definitions the key is omitted, which the backend reads as "leave the
        // custom values alone" — never `[]`, which clears them (lead-custom-values.ts).
        customFields: customFieldsPayload(customFields, customValues),
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

  /**
   * Every system field's control, keyed by the same stable key a configured form stores.
   * Built here rather than inline so the form's *layout* is a list to render, not a shape
   * baked into the JSX.
   */
  /** One custom field's control, bound to this form's value and error. */
  const renderCustom = (field: LeadCustomField) =>
    renderCustomField(
      field,
      customValues[field.key] ?? "",
      customErrors[field.key],
      (value) => setCustom(field.key, value),
    );

  const systemNodes: Record<string, React.ReactNode> = {
    name: (
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
    ),
    primaryPhone: (
      <FormField label="Primary Phone" required error={errors.primaryPhone}>
        <PhoneInput
          value={form.primaryPhone}
          onChange={(v) => set("primaryPhone", v)}
          placeholder="Primary Phone"
          invalid={Boolean(errors.primaryPhone)}
        />
      </FormField>
    ),
    firstName: (
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
    ),
    secondaryPhone: (
      <FormField label="Secondary Phone">
        <PhoneInput
          value={form.secondaryPhone}
          onChange={(v) => set("secondaryPhone", v)}
          placeholder="Secondary Phone"
        />
      </FormField>
    ),
    email: (
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
    ),
    assignedAgentIds: (
      <FormField
        label="Assigned"
        hint={
          canAssign
            ? undefined
            : "Only a manager or an administrator can change who a lead is assigned to."
        }
      >
        <MultiSelect
          searchable
          disabled={!canAssign}
          options={agents}
          value={form.assignedAgentIds}
          onChange={(v) => set("assignedAgentIds", v)}
          placeholder="Assigned"
        />
      </FormField>
    ),
    status: (
      <>
        <FormField
          label="Lead Status"
          required
          error={errors.status}
          hint={orderLock ?? undefined}
        >
          <SearchableSelect
            searchable={false}
            clearable
            disabled={orderLock !== null}
            options={statusOptions}
            value={form.status}
            onChange={(v) => set("status", v)}
            loading={statusLoading}
            invalid={Boolean(errors.status)}
            placeholder="Lead Status"
          />
        </FormField>
        {convertsToWon && (
          <FormField
            label="Delivery Date"
            required
            error={errors.deliveryDate}
            hint="The day the customer asked for: today or a later day. Converting the lead to WON creates its Logistics order, which needs it."
          >
            <DatePicker
              numeric
              value={form.deliveryDate}
              onChange={(d) => set("deliveryDate", d)}
              placeholder="DD/MM/YYYY"
              aria-label="Delivery Date"
            />
          </FormField>
        )}
      </>
    ),
    tagIds: (
      <FormField
        label="Tags"
        hint={
          lockedTagCount > 0
            ? "Locked tags are outside your permissions and can’t be changed."
            : undefined
        }
      >
        <MultiSelect
          searchable
          options={tagOptions}
          value={form.tagIds}
          onChange={(v) => set("tagIds", v)}
          placeholder="Tags"
          allowCreate={tagAccess.canCreate}
          onCreate={(name) => void createAndSelectTag(name)}
        />
      </FormField>
    ),
    complaintReason: (
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
    ),
    product: (
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
    ),
    language: (
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
    ),
    source: (
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
    ),
    productQty: (
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
    ),
    product2: (
      <FormField label="Product 2">
        <SearchableSelect
          options={products.options}
          value={form.product2}
          onChange={(v) => set("product2", v)}
          loading={products.isLoading}
          placeholder="Select Product 2"
        />
      </FormField>
    ),
    product2Qty: (
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
    ),
    callStatus: (
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
    ),
    callAttempts: (
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
    ),
    msgAttempts: (
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
    ),
    country: (
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
    ),
    state: (
      <FormField label="State">
        <SearchableSelect
          options={stateOptions}
          value={form.state}
          onChange={(v) => set("state", v)}
          placeholder="State"
        />
      </FormField>
    ),
    street: (
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
    ),
    city: (
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
    ),
    nationalCode: (
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
    ),
    bookingDate: (
      <FormField label="BOOKING DATE">
        <DatePicker
          numeric
          value={form.bookingDate}
          onChange={(d) => set("bookingDate", d)}
          placeholder="DD/MM/YYYY"
        />
      </FormField>
    ),
    pipeline: (
      <FormField
        label="Lead Pipeline"
        required
        error={errors.pipeline}
        hint={pipelineLock ?? undefined}
      >
        <SearchableSelect
          searchable={false}
          clearable
          disabled={pipelineLock !== null}
          options={pipelineOptions}
          value={form.pipeline}
          onChange={(v) => {
            // The status belongs to the pipeline; a new pipeline needs one of
            // its own stages, chosen from the list that now follows it.
            if (v !== form.pipeline) set("status", null);
            set("pipeline", v);
          }}
          loading={pipelines.isLoading}
          invalid={Boolean(errors.pipeline)}
          placeholder="Lead Pipeline"
        />
      </FormField>
    ),
    category: (
      <FormField label="Category">
        <SearchableSelect
          options={categories.options}
          value={form.category}
          onChange={(v) => set("category", v)}
          loading={categories.isLoading}
          placeholder="Select Category"
        />
      </FormField>
    ),
    actualAmount: (
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
    ),
    forecastedAmount: (
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
    ),
    paymentMethod: (
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
    ),
  };

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

        {/* Never blocks the Submit button: under Warn the lead is saved either way. */}
        <LeadDuplicateWarning result={duplicates} />

        {/*
          The Lead form's own layout comes from Settings > Data & Schema Management >
          Form Customization (ADR-0073): which fields the form shows, the order they sit
          in, and which section each belongs to. With no configuration — or if it cannot
          be read — `layout` reports every field visible and unplaced, and the form falls
          back to the order it shipped with.
        */}
        {renderConfigured({
          layout,
          nodes: systemNodes,
          customFields: orderedCustomFields,
          renderCustom,
        })}
      </form>
    </Drawer>
  );
}

/** One custom field's control, by its type. */
function renderCustomField(
  field: LeadCustomField,
  value: string,
  error: string | undefined,
  onChange: (value: string) => void,
): React.ReactNode {
  return (
    <FormField key={field.key} label={field.name} error={error}>
      {(control) =>
        field.type === "DROP_DOWN" ? (
          <SearchableSelect
            searchable={field.options.length > 8}
            options={field.options.map((option) => ({
              value: option.label,
              label: option.label,
            }))}
            value={value === "" ? null : value}
            onChange={(next) => onChange(next ?? "")}
            placeholder={field.name}
            invalid={Boolean(error)}
          />
        ) : field.type === "TEXTBOX" ? (
          <Textarea
            {...control}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.name}
          />
        ) : (
          <Input
            {...control}
            type={CUSTOM_INPUT_TYPE[field.type]}
            inputMode={field.type === "NUMBER" ? "decimal" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.name}
          />
        )
      }
    </FormField>
  );
}

/**
 * Renders the form in the order and grouping the configured default form stores.
 *
 * Ungrouped fields come first, in their configured order, then each section in its own
 * order — the same arrangement the builder's Preview draws, because both read the same
 * configuration. Without a configuration the shipped order is used and nothing is grouped.
 */
function renderConfigured({
  layout,
  nodes,
  customFields,
  renderCustom,
}: {
  layout: LeadFormLayout;
  nodes: Record<string, React.ReactNode>;
  customFields: LeadCustomField[];
  renderCustom: (field: LeadCustomField) => React.ReactNode;
}): React.ReactNode {
  const custom = new Map(customFields.map((field) => [field.key, field]));

  const node = (key: string): React.ReactNode => {
    const builtIn = nodes[key];
    if (builtIn) return builtIn;
    const field = custom.get(key);
    return field ? renderCustom(field) : null;
  };

  const ordered = layout.orderedKeys([
    ...Object.keys(nodes),
    ...customFields.map((field) => field.key),
  ]);

  const ungrouped = ordered.filter((key) => layout.sectionOf(key) === null);
  const grouped = layout.sections
    .map((section) => ({
      section,
      keys: ordered.filter((key) => layout.sectionOf(key) === section),
    }))
    .filter((group) => group.keys.length > 0);

  return (
    <>
      {ungrouped.map((key) => (
        <React.Fragment key={key}>{node(key)}</React.Fragment>
      ))}
      {grouped.map((group) => (
        <CollapsibleSection key={group.section} title={group.section}>
          {group.keys.map((key) => (
            <React.Fragment key={key}>{node(key)}</React.Fragment>
          ))}
        </CollapsibleSection>
      ))}
    </>
  );
}

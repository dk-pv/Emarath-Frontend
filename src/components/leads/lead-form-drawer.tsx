"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useLookup } from "@/hooks/use-lookup";
import { createLead, type LeadListItem } from "@/services/leads-service";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { SelectOption } from "@/types";

type LeadFormDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: LeadListItem) => void;
};

type FormState = {
  name: string;
  primaryPhone: string;
  firstName: string;
  secondaryPhone: string;
  assignedAgentIds: string[];
  status: string | null;
  tagIds: string[];
  complaintReason: string | null;
  product: string | null;
  productQty: string;
  product2: string;
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
    assignedAgentIds: [],
    status: "New",
    tagIds: [],
    complaintReason: null,
    product: null,
    productQty: "",
    product2: "",
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
const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
}));
const ISO2_BY_NAME = new Map(COUNTRIES.map((c) => [c.name, c.iso2]));

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
  onCreated,
}: LeadFormDrawerProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<SelectOption[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // The parent mounts this component fresh on each open (keyed render), so the
  // state above starts clean every time — no reset effect is needed.

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then((list) =>
        setAgents(
          list.map((agent) => ({ value: agent.id, label: agent.name })),
        ),
      )
      .catch(() => {
        /* leaving Assigned empty must not break the form */
      });
    return () => controller.abort();
  }, []);

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

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Customer Name is required";
    if (!form.primaryPhone.trim())
      next.primaryPhone = "Primary Phone is required";
    if (!form.status) next.status = "Lead Status is required";
    if (!form.product) next.product = "Product is required";
    if (!form.language) next.language = "Language is required";
    if (!form.callStatus) next.callStatus = "Call Status is required";
    if (!form.callAttempts)
      next.callAttempts = "Number of call attempts is required";
    if (!form.country) next.country = "Country is required";
    if (!form.pipeline) next.pipeline = "Lead Pipeline is required";
    if (!form.actualAmount.trim())
      next.actualAmount = "Actual Amount is required";
    else if (!isNumeric(form.actualAmount))
      next.actualAmount = "Actual Amount must be a number";
    if (!form.paymentMethod) next.paymentMethod = "Payment Method is required";
    if (form.forecastedAmount.trim() && !isNumeric(form.forecastedAmount))
      next.forecastedAmount = "Forecasted Amount must be a number";
    if (form.productQty.trim() && !isNumeric(form.productQty))
      next.productQty = "QTY must be a number";
    if (form.product2Qty.trim() && !isNumeric(form.product2Qty))
      next.product2Qty = "QTY must be a number";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const lead = await createLead({
        name: form.name.trim(),
        primaryPhone: form.primaryPhone,
        firstName: form.firstName.trim() || undefined,
        secondaryPhone: form.secondaryPhone || undefined,
        assignedAgentIds: form.assignedAgentIds.length
          ? form.assignedAgentIds
          : undefined,
        status: form.status ?? undefined,
        pipeline: form.pipeline ?? undefined,
        tagIds: form.tagIds.length ? form.tagIds : undefined,
        complaintReason: form.complaintReason ?? undefined,
        product: form.product ?? "",
        productQty: form.productQty.trim() || undefined,
        product2: form.product2.trim() || undefined,
        product2Qty: form.product2Qty.trim() || undefined,
        language: form.language ?? "",
        source: form.source ?? undefined,
        callStatus: form.callStatus ?? "",
        callAttempts: Number(form.callAttempts),
        msgAttempts: form.msgAttempts ? Number(form.msgAttempts) : undefined,
        country: form.country ?? "",
        state: form.state ?? undefined,
        street: form.street.trim() || undefined,
        city: form.city.trim() || undefined,
        nationalCode: form.nationalCode.trim() || undefined,
        bookingDate: form.bookingDate
          ? toDateOnly(form.bookingDate)
          : undefined,
        category: form.category ?? undefined,
        actualAmount: form.actualAmount.trim(),
        forecastedAmount: form.forecastedAmount.trim() || undefined,
        paymentMethod: form.paymentMethod ?? "",
      });
      onCreated(lead);
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
      title="Add New Lead"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Saving…" : "Submit"}
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
        {apiError && (
          <p
            role="alert"
            className="rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {apiError}
          </p>
        )}

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

        <FormField label="Product" required error={errors.product}>
          <SearchableSelect
            options={products.options}
            value={form.product}
            onChange={(v) => set("product", v)}
            loading={products.isLoading}
            invalid={Boolean(errors.product)}
            placeholder="Select Product"
          />
        </FormField>

        <FormField label="Language" required error={errors.language}>
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

        <FormField label="Product 2">
          {(control) => (
            <Input
              {...control}
              value={form.product2}
              onChange={(e) => set("product2", e.target.value)}
              placeholder="Product 2"
            />
          )}
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

        <FormField label="Call Status" required error={errors.callStatus}>
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

        <FormField
          label="NO.OF CALL ATTEMTS"
          required
          error={errors.callAttempts}
        >
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
          <FormField label="Country" required error={errors.country}>
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

          <FormField label="Actual Amount" required error={errors.actualAmount}>
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

          <FormField
            label="Payment Method"
            required
            error={errors.paymentMethod}
          >
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
      </form>
    </Drawer>
  );
}

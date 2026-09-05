"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  fetchOrganizationCompany,
  saveOrganizationCompany,
  type OrganizationCompanyDetails,
} from "@/services/organization-settings-service";

/**
 * The form's own shape. Latitude and longitude are held as text while being typed — "-",
 * "11." and "" are all legal keystrokes and none of them is a number — and become
 * `number | null` only on the way to the API.
 */
type Draft = Omit<OrganizationCompanyDetails, "latitude" | "longitude"> & {
  latitude: string;
  longitude: string;
};

type FieldKey = keyof Draft;

const LATITUDE_RANGE = [-90, 90] as const;
const LONGITUDE_RANGE = [-180, 180] as const;

/** Deliberately permissive — the API is the authority; this is only immediate feedback. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i;

const toDraft = (settings: OrganizationCompanyDetails): Draft => ({
  ...settings,
  latitude: settings.latitude === null ? "" : String(settings.latitude),
  longitude: settings.longitude === null ? "" : String(settings.longitude),
});

const toSettings = (draft: Draft): OrganizationCompanyDetails => ({
  ...draft,
  latitude: draft.latitude.trim() === "" ? null : Number(draft.latitude),
  longitude: draft.longitude.trim() === "" ? null : Number(draft.longitude),
});

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/** A blank coordinate is allowed; anything present must be a real one. */
function coordinateError(
  raw: string,
  [min, max]: readonly [number, number],
  name: string,
): string | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return `${name} must be a number.`;
  return value < min || value > max
    ? `${name} must be between ${min} and ${max}.`
    : undefined;
}

function validate(draft: Draft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};

  if (draft.companyName.trim() === "") {
    errors.companyName = "Company Name is required.";
  }
  if (draft.email.trim() !== "" && !EMAIL_PATTERN.test(draft.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (
    draft.website.trim() !== "" &&
    !WEBSITE_PATTERN.test(draft.website.trim())
  ) {
    errors.website = "Enter a valid website address.";
  }

  const latitude = coordinateError(draft.latitude, LATITUDE_RANGE, "Latitude");
  if (latitude) errors.latitude = latitude;
  const longitude = coordinateError(
    draft.longitude,
    LONGITUDE_RANGE,
    "Longitude",
  );
  if (longitude) errors.longitude = longitude;

  return errors;
}

/** Field key → the label the API prints in a default class-validator message. */
const FIELD_LABELS: Record<FieldKey, string> = {
  companyName: "Company Name",
  address: "Address",
  street: "Street",
  city: "City",
  state: "State",
  country: "Country",
  zipCode: "Zip Code",
  telephoneCountry: "Telephone",
  telephone: "Telephone",
  email: "Email",
  website: "Website",
  latitude: "Latitude",
  longitude: "Longitude",
};

/**
 * Attaches each API validation message to the field it names, so a rejected save marks
 * the box rather than only printing a banner. Anything unattributable stays in the banner.
 */
function mapApiErrors(messages: string[]): {
  fields: Partial<Record<FieldKey, string>>;
  rest: string[];
} {
  const fields: Partial<Record<FieldKey, string>> = {};
  const rest: string[] = [];

  for (const message of messages) {
    const lower = message.toLowerCase();
    const key = (Object.keys(FIELD_LABELS) as FieldKey[]).find(
      (candidate) =>
        lower.includes(candidate.toLowerCase()) ||
        lower.includes(FIELD_LABELS[candidate].toLowerCase()),
    );
    if (key && !fields[key]) fields[key] = message;
    else if (!key) rest.push(message);
  }

  return { fields, rest };
}

/**
 * Settings → Organization Setup → Company Details.
 *
 * The same shape as the General Settings screen beside it: the saved payload is the
 * baseline, the form edits a copy, Save replaces it wholesale and Cancel returns to the
 * baseline — so Cancel never touches the API and one Save is one PUT.
 *
 * Field errors appear as soon as a field has been edited, and a rejected save reveals the
 * rest; the API validates everything again and its messages are mapped back onto the boxes.
 */
export function OrganizationCompanyView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<Draft | null>(null);
  const [value, setValue] = useState<Draft | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [apiErrors, setApiErrors] = useState<Partial<Record<FieldKey, string>>>(
    {},
  );
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchOrganizationCompany(controller.signal)
      .then((result) => {
        if (!active) return;
        const draft = toDraft(result);
        setSaved(draft);
        setValue(draft);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed(
          error instanceof ApiError && error.status === 403
            ? "forbidden"
            : "error",
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const set = <K extends FieldKey>(key: K, next: Draft[K]) => {
    setValue((current) => (current ? { ...current, [key]: next } : current));
    setTouched((current) => ({ ...current, [key]: true }));
    // A field the user has just corrected must not keep the API's stale complaint.
    setApiErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const errors = value ? validate(value) : {};
  const dirty = Boolean(value && saved && !same(value, saved));
  const errorFor = (key: FieldKey) =>
    apiErrors[key] ?? (touched[key] ? errors[key] : undefined);

  const restore = () => {
    setSaveError(null);
    setApiErrors({});
    setTouched({});
    if (saved) setValue(saved);
  };

  const submit = async () => {
    if (!value || busy) return;

    if (Object.keys(validate(value)).length > 0) {
      // Reveal every complaint, including on fields the user never opened.
      setTouched(
        Object.fromEntries(
          (Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => [key, true]),
        ),
      );
      setSaveError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setSaveError(null);
    setApiErrors({});
    try {
      const stored = toDraft(await saveOrganizationCompany(toSettings(value)));
      setSaved(stored);
      setValue(stored);
      setTouched({});
      toast({ title: "Company Details saved", tone: "success" });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const { fields, rest } = mapApiErrors(error.messages);
        setApiErrors(fields);
        setSaveError(
          rest[0] ??
            (Object.keys(fields).length > 0
              ? "Fix the highlighted fields and try again."
              : error.message),
        );
      } else {
        setSaveError("Could not save these details.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to these settings"
              : "Couldn't load Company Details"
          }
          description={
            failed === "forbidden"
              ? "Organization settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The details could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setFailed(false);
            reload();
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="shrink-0 border-b border-hairline p-5">
        <h2 className="text-xl font-semibold text-ink">Company Details</h2>
        {/* Reference wording, kept verbatim including its capital "And" (CLAUDE.md §1). */}
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s basic settings And regional preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
        {value === null ? (
          <div
            className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2"
            aria-hidden="true"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            {saveError && (
              <div className="px-5 pt-5">
                <FormError>{saveError}</FormError>
              </div>
            )}

            {/*
              Column order comes straight from the reference: Company Name / Address,
              Street / City, State / Country, Zip Code / Telephone, Email / Website,
              Latitude / Longitude. Source order is that reading order, so the single
              column at narrow widths keeps it.
            */}
            <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              <TextField
                id="company-name"
                label="Company Name"
                required
                value={value.companyName}
                error={errorFor("companyName")}
                onChange={(next) => set("companyName", next)}
              />
              <TextField
                id="company-address"
                label="Address"
                value={value.address}
                error={errorFor("address")}
                onChange={(next) => set("address", next)}
              />
              <TextField
                id="company-street"
                label="Street"
                value={value.street}
                error={errorFor("street")}
                onChange={(next) => set("street", next)}
              />
              <TextField
                id="company-city"
                label="City"
                value={value.city}
                error={errorFor("city")}
                onChange={(next) => set("city", next)}
              />
              <TextField
                id="company-state"
                label="State"
                value={value.state}
                error={errorFor("state")}
                onChange={(next) => set("state", next)}
              />
              <TextField
                id="company-country"
                label="Country"
                value={value.country}
                error={errorFor("country")}
                onChange={(next) => set("country", next)}
              />
              <TextField
                id="company-zip"
                label="Zip Code"
                value={value.zipCode}
                error={errorFor("zipCode")}
                onChange={(next) => set("zipCode", next)}
              />

              <Field
                id="company-telephone"
                label="Telephone"
                error={errorFor("telephone")}
              >
                <PhoneInput
                  size="lg"
                  id="company-telephone"
                  value={value.telephone}
                  country={value.telephoneCountry}
                  onChange={(next) => set("telephone", next)}
                  onCountryChange={(iso2) => set("telephoneCountry", iso2)}
                  invalid={Boolean(errorFor("telephone"))}
                />
              </Field>

              <TextField
                id="company-email"
                label="Email"
                type="email"
                inputMode="email"
                value={value.email}
                error={errorFor("email")}
                onChange={(next) => set("email", next)}
              />
              <TextField
                id="company-website"
                label="Website"
                type="url"
                inputMode="url"
                placeholder="Add Website"
                value={value.website}
                error={errorFor("website")}
                onChange={(next) => set("website", next)}
              />
              <TextField
                id="company-latitude"
                label="Latitude"
                inputMode="decimal"
                value={value.latitude}
                error={errorFor("latitude")}
                onChange={(next) => set("latitude", next)}
              />
              <TextField
                id="company-longitude"
                label="Longitude"
                inputMode="decimal"
                value={value.longitude}
                error={errorFor("longitude")}
                onChange={(next) => set("longitude", next)}
              />
            </div>
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
        <Button
          variant="ghost"
          aria-label="Cancel"
          disabled={busy || !dirty}
          onClick={restore}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save Company Details"
          onClick={() => void submit()}
          isLoading={busy}
          disabled={value === null || !dirty}
        >
          Save
        </Button>
      </footer>
    </Card>
  );
}

/**
 * One labelled control with its error line.
 *
 * The reference's Company Details labels carry no ⓘ — unlike the General Settings screen
 * beside it — so none is drawn here (CLAUDE.md §16.1); the typography is the same.
 */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/*
        No required marker: the reference draws none, not even on Company Name, so none is
        invented (CLAUDE.md §16.1). The requirement is still carried to assistive tech by
        the control's own `required`, and to everyone by the error line below it.
      */}
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({
  id,
  label,
  required,
  error,
  value,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
} & Pick<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "placeholder" | "autoComplete"
>) {
  return (
    <Field id={id} label={label} error={error}>
      <Input
        {...input}
        size="lg"
        id={id}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import { formatDate, formatTime } from "@/lib/format";
import {
  addHostDomain,
  deleteHostDomain,
  fetchOrganizationHostMapping,
  type CreateHostDomainInput,
  type HostDomain,
} from "@/services/organization-settings-service";
import type { TableColumn } from "@/types";

type FieldKey = keyof CreateHostDomainInput;

const EMPTY_FORM: CreateHostDomainInput = {
  domainName: "",
  fromEmailAddress: "",
  fromEmailName: "",
};

/** Deliberately permissive — the API is the authority; this is only immediate feedback. */
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(form: CreateHostDomainInput): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};

  const domain = form.domainName.trim();
  if (domain === "") {
    errors.domainName = "Domain Name is required.";
  } else if (!DOMAIN_PATTERN.test(domain)) {
    errors.domainName = "Enter a valid domain name, for example emarathglobal.com.";
  }

  const email = form.fromEmailAddress.trim();
  if (email !== "" && !EMAIL_PATTERN.test(email)) {
    errors.fromEmailAddress = "Enter a valid email address.";
  }

  return errors;
}

/** Field key → the label the API prints in a default class-validator message. */
const FIELD_LABELS: Record<FieldKey, string> = {
  domainName: "Domain Name",
  fromEmailAddress: "From Email Address",
  fromEmailName: "From Email Name",
};

/**
 * Attaches each API validation message to the field it names, as Company Details does, so
 * a rejected save marks the box rather than only printing a banner.
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
 * Settings → Organization Setup → Host Mapping.
 *
 * One card in two states, exactly as the reference shows them: the domain list with its
 * "+ Add Domain" action, and — with that button gone — the Domain Information form over a
 * Cancel/Save footer. Not a drawer: the reference replaces the card body in place and
 * keeps the same title and subtitle above it.
 *
 * Save/Cancel follow the Company Details rules — one Save is one request, Cancel makes
 * none and discards the draft.
 */
export function OrganizationHostMappingView() {
  const { toast } = useToast();

  const [domains, setDomains] = useState<HostDomain[] | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState<CreateHostDomainInput | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [apiErrors, setApiErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<HostDomain | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchOrganizationHostMapping(controller.signal)
      .then((result) => {
        if (!active) return;
        setDomains(result.domains);
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

  const set = (key: FieldKey, next: string) => {
    setForm((current) => (current ? { ...current, [key]: next } : current));
    setTouched((current) => ({ ...current, [key]: true }));
    setApiErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const closeForm = () => {
    setForm(null);
    setTouched({});
    setApiErrors({});
    setSaveError(null);
  };

  const errors = form ? validate(form) : {};
  // Nothing typed yet is not an error to shout about — it is simply nothing to save.
  const dirty = Boolean(
    form && (form.domainName || form.fromEmailAddress || form.fromEmailName),
  );
  const errorFor = (key: FieldKey) =>
    apiErrors[key] ?? (touched[key] ? errors[key] : undefined);

  const submit = async () => {
    if (!form || busy) return;

    if (Object.keys(validate(form)).length > 0) {
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
      const stored = await addHostDomain(form);
      setDomains(stored.domains);
      closeForm();
      toast({ title: "Domain added", tone: "success" });
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
        setSaveError("Could not add this domain.");
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      const stored = await deleteHostDomain(deleting.id);
      setDomains(stored.domains);
      toast({ title: `${deleting.domainName} removed`, tone: "success" });
      setDeleting(null);
    } catch (error: unknown) {
      toast({
        title:
          error instanceof ApiError
            ? (error.messages[0] ?? error.message)
            : "Could not remove this domain.",
        tone: "danger",
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<HostDomain>[] = [
    {
      key: "domainName",
      header: "Domain Name",
      render: (row) => <span className="truncate text-ink">{row.domainName}</span>,
    },
    {
      key: "status",
      header: "Status",
      // No capture shows a populated row, and the product has no DNS verification to
      // report on, so no status vocabulary is invented (CLAUDE.md §16.1/§16.4). The
      // column the reference draws is kept, holding the project's own empty-cell dash
      // until a screenshot defines what belongs here.
      render: () => <span className="text-ink-muted">—</span>,
    },
    {
      key: "createdAt",
      header: "Date and Time",
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-ink">{formatDate(row.createdAt)}</span>
          <span className="text-ink-muted">{formatTime(row.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-24",
      render: (row) => (
        <Tooltip content="Delete">
          <button
            type="button"
            aria-label={`Delete Domain ${row.domainName}`}
            onClick={() => setDeleting(row)}
            className="focus-ring flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
          >
            <IconTrash size={16} stroke={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      ),
    },
  ];

  if (failed) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to these settings"
              : "Couldn't load Host Mapping"
          }
          description={
            failed === "forbidden"
              ? "Organization settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The mapped domains could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setDomains(null);
            setFailed(false);
            reload();
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">Host Mapping</h2>
          {/* Reference wording, kept verbatim (CLAUDE.md §16). */}
          <p className="mt-0.5 text-sm text-ink-muted">
            Manage your domain&apos;s DNS configuration securely
          </p>
        </div>
        {/* The reference's form state has no Add Domain button, so it goes with the list. */}
        {form === null && (
          <Button
            aria-label="Add Domain"
            disabled={domains === null}
            onClick={() => setForm(EMPTY_FORM)}
          >
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add Domain
          </Button>
        )}
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {form === null ? (
          /*
            The reference draws the table inside its own bordered, rounded panel, and shows
            nothing at all beneath the header row — no empty-state copy, no illustration.
            `emptyState` is therefore left off: the shared Table renders an empty body,
            which is exactly what the capture shows.
          */
          <div className="overflow-hidden rounded-control border border-hairline">
            {/*
              The cells never wrap, so below roughly 560px the four columns are wider than
              the card. The shared container scrolls them instead of clipping — the same
              treatment the Calls, GPS and Dashboard tables use.
            */}
            <ResponsiveTableContainer label="Mapped domains">
              <Table
                columns={columns}
                rows={domains ?? []}
                getRowId={(row) => row.id}
                isLoading={domains === null}
              />
            </ResponsiveTableContainer>
          </div>
        ) : (
          <>
            {saveError && (
              <div className="pb-5">
                <FormError>{saveError}</FormError>
              </div>
            )}

            <h3 className="text-base font-semibold text-ink">
              Domain Information
            </h3>

            {/*
              Two columns, filling left-to-right: Domain Name / From Email Address, then
              From Email Name against an empty right-hand cell — the reference's shape,
              which a single column at narrow widths keeps in the same reading order.
            */}
            <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field
                id="host-domain-name"
                label="Domain Name"
                placeholder="Domain Name"
                value={form.domainName}
                error={errorFor("domainName")}
                onChange={(next) => set("domainName", next)}
              />
              <Field
                id="host-from-email-address"
                label="From Email Address"
                placeholder="From Email Address"
                type="email"
                inputMode="email"
                value={form.fromEmailAddress}
                error={errorFor("fromEmailAddress")}
                onChange={(next) => set("fromEmailAddress", next)}
              />
              <Field
                id="host-from-email-name"
                label="From Email Name"
                placeholder="From Email Name"
                value={form.fromEmailName}
                error={errorFor("fromEmailName")}
                onChange={(next) => set("fromEmailName", next)}
              />
            </div>
          </>
        )}
      </div>

      {/* The footer belongs to the form state; the reference's list has none. */}
      {form !== null && (
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
          <Button
            variant="ghost"
            aria-label="Cancel"
            disabled={busy}
            onClick={closeForm}
          >
            Cancel
          </Button>
          <Button
            aria-label="Save Domain"
            onClick={() => void submit()}
            isLoading={busy}
            disabled={!dirty}
          >
            Save
          </Button>
        </footer>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this domain?"
        description={
          deleting
            ? `${deleting.domainName} will no longer be mapped. This cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}

/**
 * One labelled control with its error line.
 *
 * The reference draws an ⓘ beside each of the three labels but never an open tooltip, so
 * the glyph stays presentational — `SettingLabel` without a `hint`, the convention the
 * Sales & CRM settings screens already use for uncaptured tooltip copy (CLAUDE.md §16.4).
 */
function Field({
  id,
  label,
  error,
  value,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
} & Pick<React.ComponentProps<"input">, "type" | "inputMode" | "placeholder">) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SettingLabel htmlFor={id}>{label}</SettingLabel>
      <Input
        {...input}
        size="lg"
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

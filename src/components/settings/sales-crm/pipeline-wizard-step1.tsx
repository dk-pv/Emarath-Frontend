"use client";

import { useEffect, useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { isAbortError } from "@/lib/api-client";
import {
  PERMISSION_TYPES,
  PIPELINE_ACCESS_MODES,
  PIPELINE_TEMPLATES,
  type PipelinePermissionInput,
} from "@/services/pipelines-service";
import { fetchNamedRoles, fetchTeamMembers } from "@/services/users-service";
import type { SelectOption } from "@/types";

/** One editable permission row; `key` keeps React stable while rows are added/removed. */
export interface PermissionRow extends PipelinePermissionInput {
  key: string;
}

export interface Step1Value {
  name: string;
  shortCode: string;
  accessMode: "ALL_USERS" | "SPECIFIC";
  permissions: PermissionRow[];
  cloneEnabled: boolean;
  templateKey: string | null;
}

export interface Step1Errors {
  name?: string;
  shortCode?: string;
  template?: string;
  permissions?: string;
}

/** The reference validates these on Next, so the wizard can gate the step on the same rules. */
export function validateStep1(value: Step1Value): Step1Errors {
  const errors: Step1Errors = {};
  if (value.name.trim() === "") errors.name = "Pipeline name is required.";
  const code = value.shortCode.trim().toUpperCase();
  if (code === "") errors.shortCode = "Short code is required.";
  else if (!/^[A-Z0-9_-]+$/.test(code)) {
    errors.shortCode = "Use letters, numbers, dash and underscore only.";
  }
  if (value.cloneEnabled && !value.templateKey) {
    errors.template = "Pick a template to copy.";
  }
  if (
    value.accessMode === "SPECIFIC" &&
    value.permissions.some(
      (row) =>
        (row.permissionType === "ROLE" && !row.roleId) ||
        (row.permissionType === "USER" && !row.userId),
    )
  ) {
    errors.permissions = "Choose a target for every permission row.";
  }
  return errors;
}

/** The users API caps a page at 100; the roster is well inside that. */
const ROSTER_PAGE_SIZE = 100;

const SECTION = "border-b border-hairline p-5";

/**
 * Step 1 of the Sales Pipeline wizard — Pipeline Info, Pipeline Permissions and
 * Clone from a template, exactly the three sections the reference shows.
 *
 * The role and user options come from the existing `/api/users/roles` and `/api/users`
 * endpoints, so a permission row can only ever name a real grantee (ADR-0060).
 */
export function PipelineWizardStep1({
  value,
  errors,
  onChange,
}: {
  value: Step1Value;
  errors: Step1Errors;
  onChange: (next: Step1Value) => void;
}) {
  const [roleOptions, setRoleOptions] = useState<SelectOption[]>([]);
  const [userOptions, setUserOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Fetched independently: one list failing must not blank the other, and the roster
    // is capped at the API's maximum page size rather than a larger number it rejects.
    const ignore = (error: unknown) => {
      if (!isAbortError(error)) return;
    };

    fetchNamedRoles(controller.signal)
      .then((roles) => {
        if (active) {
          setRoleOptions(roles.map((r) => ({ value: r.id, label: r.name })));
        }
      })
      .catch(ignore);

    fetchTeamMembers({ page: 1, size: ROSTER_PAGE_SIZE }, undefined, controller.signal)
      .then((users) => {
        if (active) {
          setUserOptions(
            users.rows.map((m) => ({ value: m.id, label: m.name })),
          );
        }
      })
      .catch(ignore);

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const set = <K extends keyof Step1Value>(key: K, next: Step1Value[K]) =>
    onChange({ ...value, [key]: next });

  const setRow = (key: string, patch: Partial<PermissionRow>) =>
    onChange({
      ...value,
      permissions: value.permissions.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    });

  return (
    <>
      <section className={SECTION}>
        <h3 className="text-base font-semibold text-ink">Pipeline Info</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Define the basic details used to identify and manage this pipeline.
        </p>

        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <FormField
            label="Pipeline Name"
            htmlFor="pipeline-name"
            required
            error={errors.name}
          >
            <Input
              id="pipeline-name"
              size="lg"
              className="text-sm"
              autoComplete="off"
              placeholder="Enter pipeline name"
              value={value.name}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => set("name", event.target.value)}
            />
          </FormField>

          <FormField
            label="Short Code"
            htmlFor="pipeline-short-code"
            required
            error={errors.shortCode}
          >
            <Input
              id="pipeline-short-code"
              size="lg"
              className="text-sm uppercase"
              autoComplete="off"
              maxLength={16}
              placeholder="e.g. SALES or SL"
              value={value.shortCode}
              aria-invalid={errors.shortCode ? true : undefined}
              onChange={(event) => set("shortCode", event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className={SECTION}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">
              Pipeline Permissions
            </h3>
            {/* Reference wording, kept verbatim including its "or or" (CLAUDE.md §1). */}
            <p className="mt-0.5 text-sm text-ink-muted">
              Specify the roles or or users allowed to access or manage this
              pipeline
            </p>
          </div>
          {/*
            The reference draws this button in a pale green in every capture, so it is
            styled that way rather than as the solid brand button. It adds a row only once
            access is restricted — with All Users there is nothing for a row to grant.
          */}
          <Button
            className="shrink-0 bg-brand/40 text-white hover:bg-brand/60"
            disabled={value.accessMode !== "SPECIFIC"}
            onClick={() =>
              onChange({
                ...value,
                permissions: [
                  ...value.permissions,
                  { key: crypto.randomUUID(), permissionType: "ROLE" },
                ],
              })
            }
          >
            <IconPlus size={16} stroke={2} aria-hidden="true" />
            Add Permission
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink">
            Choose who can access the pipeline
          </span>
          <div className="w-40">
            <SearchableSelect
              id="pipeline-access-mode"
              searchable={false}
              options={PIPELINE_ACCESS_MODES.map((mode) => ({ ...mode }))}
              value={value.accessMode}
              onChange={(next) =>
                onChange({
                  ...value,
                  accessMode: (next ?? "ALL_USERS") as Step1Value["accessMode"],
                  // Switching back to All Users drops the rows: they would grant nothing.
                  permissions:
                    next === "SPECIFIC"
                      ? value.permissions.length > 0
                        ? value.permissions
                        : [{ key: crypto.randomUUID(), permissionType: "ROLE" }]
                      : [],
                })
              }
            />
          </div>
        </div>

        {value.accessMode === "SPECIFIC" && (
          <div className="mt-4 flex flex-col gap-4">
            {errors.permissions && (
              <p role="alert" className="text-sm text-danger">
                {errors.permissions}
              </p>
            )}
            {value.permissions.map((row) => (
              <div key={row.key} className="flex flex-wrap items-end gap-3">
                <FormField
                  label="Permission Type"
                  htmlFor={`permission-type-${row.key}`}
                  required
                  className="w-full max-w-sm"
                >
                  <SearchableSelect
                    id={`permission-type-${row.key}`}
                    size="lg"
                    searchable={false}
                    placeholder="Select permission type"
                    options={PERMISSION_TYPES.map((type) => ({ ...type }))}
                    value={row.permissionType}
                    onChange={(next) =>
                      setRow(row.key, {
                        permissionType: (next ??
                          "ROLE") as PermissionRow["permissionType"],
                        roleId: undefined,
                        userId: undefined,
                      })
                    }
                  />
                </FormField>

                <FormField
                  label={row.permissionType === "ROLE" ? "Role" : "User"}
                  htmlFor={`permission-target-${row.key}`}
                  required
                  className="w-full max-w-sm"
                >
                  <SearchableSelect
                    id={`permission-target-${row.key}`}
                    size="lg"
                    placeholder={
                      row.permissionType === "ROLE" ? "Select role" : "Select user"
                    }
                    options={
                      row.permissionType === "ROLE" ? roleOptions : userOptions
                    }
                    value={
                      (row.permissionType === "ROLE" ? row.roleId : row.userId) ??
                      null
                    }
                    onChange={(next) =>
                      setRow(
                        row.key,
                        row.permissionType === "ROLE"
                          ? { roleId: next ?? undefined }
                          : { userId: next ?? undefined },
                      )
                    }
                  />
                </FormField>

                <button
                  type="button"
                  aria-label="Remove this permission"
                  onClick={() =>
                    onChange({
                      ...value,
                      permissions: value.permissions.filter(
                        (each) => each.key !== row.key,
                      ),
                    })
                  }
                  className="focus-ring mb-0.5 flex size-control-lg shrink-0 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:border-danger hover:text-danger"
                >
                  <IconTrash size={18} stroke={1.75} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-5">
        <h3 className="text-base font-semibold text-ink">Clone from a template</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Create this pipeline by copying stages and settings from an existing
          template.
        </p>

        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
            <label
              htmlFor="pipeline-clone"
              className="cursor-pointer text-sm text-ink-muted"
            >
              Clone from existing template
            </label>
            <Switch
              id="pipeline-clone"
              checked={value.cloneEnabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  cloneEnabled: event.target.checked,
                  templateKey: event.target.checked ? value.templateKey : null,
                })
              }
            />
          </div>

          {/* The picker exists only while the toggle is on, as the reference shows. */}
          {value.cloneEnabled && (
            <FormField
              label="Pick a Template"
              htmlFor="pipeline-template"
              required
              error={errors.template}
            >
              <SearchableSelect
                id="pipeline-template"
                size="lg"
                searchable={false}
                placeholder="Choose a template to copy"
                options={PIPELINE_TEMPLATES.map((name) => ({
                  value: name,
                  label: name,
                }))}
                value={value.templateKey}
                onChange={(next) => set("templateKey", next)}
              />
            </FormField>
          )}
        </div>
      </section>
    </>
  );
}

/** The stepper's three circles and their connecting rules, as the reference draws them. */
export function WizardStepper({
  step,
  labels,
}: {
  step: number;
  labels: readonly string[];
}) {
  return (
    <ol className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-hairline p-5">
      {labels.map((label, index) => {
        const number = index + 1;
        const active = number === step;
        const done = number < step;
        return (
          <li key={label} className="flex min-w-0 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                active
                  ? "border-info bg-info text-white"
                  : done
                    ? "border-brand bg-brand text-white"
                    : "border-hairline bg-surface text-ink-muted",
              )}
            >
              {number}
            </span>
            <span
              className={cn(
                "truncate text-sm",
                active
                  ? "font-medium text-info"
                  : done
                    ? "text-brand-strong"
                    : "text-ink-muted",
              )}
            >
              {label}
            </span>
            {number < labels.length && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 hidden h-px w-12 sm:block lg:w-24",
                  done ? "bg-brand" : "bg-hairline",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

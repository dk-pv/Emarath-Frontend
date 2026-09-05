"use client";

import { IconInfoCircle } from "@tabler/icons-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { cn } from "@/lib/cn";
import {
  EXPIRY_SCOPES,
  MIN_EXPIRY_DAYS,
  type ExpiryScope,
  type PipelineSettings,
  type PipelineSettingsInput,
} from "@/services/pipelines-service";
import type { Stage } from "@/services/stages-service";
import type { TeamMember } from "@/services/users-service";
import { SettingLabel, ToggleField } from "./setting-controls";
import { UserTreeSelect } from "./user-tree-select";

/**
 * Step 3's editable state.
 *
 * `expiryDays` is held as the string the field contains rather than a number, so a
 * half-typed value is not silently coerced while the user is still typing; it becomes a
 * number once, on submit.
 */
export interface SettingsForm {
  defaultStageId: string | null;
  mandatoryValueStageId: string | null;
  qualifiedStageId: string | null;
  autoConvertAtWon: boolean;
  expiryEnabled: boolean;
  expiryScope: ExpiryScope | null;
  expiryDays: string;
  expiredStageId: string | null;
  reassignedStageId: string | null;
  reassignExpiredToId: string | null;
}

export type SettingsErrors = Partial<Record<keyof SettingsForm, string>>;

export function toSettingsForm(settings: PipelineSettings): SettingsForm {
  return {
    defaultStageId: settings.defaultStageId,
    mandatoryValueStageId: settings.mandatoryValueStageId,
    qualifiedStageId: settings.qualifiedStageId,
    autoConvertAtWon: settings.autoConvertAtWon,
    expiryEnabled: settings.expiryEnabled,
    expiryScope: settings.expiryScope,
    expiryDays: settings.expiryDays === null ? "" : String(settings.expiryDays),
    expiredStageId: settings.expiredStageId,
    reassignedStageId: settings.reassignedStageId,
    reassignExpiredToId: settings.reassignExpiredToId,
  };
}

/**
 * What Save submits.
 *
 * The dependent expiry values go up even while expiry is off: the backend keeps them, so
 * switching the toggle back on later — in this session or a later edit — restores the
 * configuration instead of an empty form.
 */
export function toSettingsInput(form: SettingsForm): PipelineSettingsInput {
  const days = Number(form.expiryDays);
  return {
    defaultStageId: form.defaultStageId ?? "",
    mandatoryValueStageId: form.mandatoryValueStageId,
    qualifiedStageId: form.qualifiedStageId,
    autoConvertAtWon: form.autoConvertAtWon,
    expiryEnabled: form.expiryEnabled,
    expiryScope: form.expiryScope,
    expiryDays: form.expiryDays.trim() === "" ? null : days,
    expiredStageId: form.expiredStageId,
    reassignedStageId: form.reassignedStageId,
    reassignExpiredToId: form.reassignExpiredToId,
  };
}

/**
 * Step 3's rules, conditional on the expiry toggle exactly as the reference's asterisks
 * are: Default Stage is always required, the four expiry fields only once expiry is on,
 * and "Reassign Expired Leads To" never — the reference marks it without an asterisk.
 */
export function validateSettings(form: SettingsForm): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!form.defaultStageId) errors.defaultStageId = "Default Stage is required.";
  if (!form.expiryEnabled) return errors;

  if (!form.expiryScope) errors.expiryScope = "Choose what expiry applies to.";
  if (!form.expiredStageId) {
    errors.expiredStageId = "Choose the stage an expired lead moves to.";
  }
  if (!form.reassignedStageId) {
    errors.reassignedStageId = "Choose the stage a reassigned lead takes.";
  }

  const raw = form.expiryDays.trim();
  const days = Number(raw);
  if (raw === "") {
    errors.expiryDays = "Expire After (Days) is required.";
  } else if (!/^\d+$/.test(raw) || !Number.isSafeInteger(days)) {
    // Rejects text, decimals, signs and exponent forms in one rule — anything the
    // number field will still hand over as a string.
    errors.expiryDays = "Enter a whole number of days.";
  } else if (days < MIN_EXPIRY_DAYS) {
    errors.expiryDays = `Enter at least ${MIN_EXPIRY_DAYS} day.`;
  }
  return errors;
}

const SECTION_TITLE = "text-base font-semibold text-ink";
const SECTION_SUBTITLE = "mt-0.5 text-sm text-ink-muted";
/** The reference's two-column grid; one column once there is no room for two. */
const GRID = "mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2";

export interface PipelineWizardSettingsProps {
  value: SettingsForm;
  errors: SettingsErrors;
  /** The pipeline's own stages — every stage select offers these and nothing else. */
  stages: Stage[];
  /** The roster the user tree is built from. */
  members: readonly TeamMember[];
  membersLoading: boolean;
  onChange: (next: SettingsForm) => void;
}

/**
 * Step 3 of the Sales Pipeline wizard — Pipeline Settings and Lead Expiry Settings.
 *
 * Every stage option is a real stage of the pipeline being edited, referenced by id, so a
 * setting can never name a stage from another board; the API re-checks that on save. The
 * expiry block appears only while its toggle is on, as the reference shows, but the values
 * behind it are kept so turning it off and on again does not empty the form.
 */
export function PipelineWizardSettings({
  value,
  errors,
  stages,
  members,
  membersLoading,
  onChange,
}: PipelineWizardSettingsProps) {
  const set = <K extends keyof SettingsForm>(key: K, next: SettingsForm[K]) =>
    onChange({ ...value, [key]: next });

  const stageOptions = stages.map((stage) => ({
    value: stage.id,
    label: stage.name,
  }));
  // The stage new leads land in has to be one a lead can sit in and work through, so the
  // closed stages are not offered here.
  const openStageOptions = stages
    .filter((stage) => !stage.isClosed)
    .map((stage) => ({ value: stage.id, label: stage.name }));

  return (
    <div className="flex flex-col gap-5 p-5">
      <Alert
        tone="warning"
        icon={IconInfoCircle}
        title="Pipeline Settings Overview"
        className="[&_p]:text-warning [&_div>div]:text-warning"
      >
        Configure how leads move through this pipeline by setting the default
        stage for new leads, defining the stage where lead value becomes
        mandatory, selecting which stages count as qualified leads, and enabling
        expiry rules to manage inactive leads.
      </Alert>

      <section>
        <h3 className={SECTION_TITLE}>Pipeline Settings</h3>
        <p className={SECTION_SUBTITLE}>
          Configure default behavior and rules for managing leads across this
          pipeline.
        </p>

        <div className={GRID}>
          <Field
            id="pipeline-default-stage"
            label="Default Stage"
            required
            error={errors.defaultStageId}
          >
            <SearchableSelect
              portal
              size="lg"
              id="pipeline-default-stage"
              aria-label="Default Stage"
              searchable={false}
              clearable
              placeholder="Select Stage"
              options={openStageOptions}
              value={value.defaultStageId}
              invalid={Boolean(errors.defaultStageId)}
              onChange={(next) => set("defaultStageId", next)}
            />
          </Field>

          <Field
            id="pipeline-mandatory-value-stage"
            label="Lead Stage Requiring Mandatory Value"
          >
            <SearchableSelect
              portal
              size="lg"
              id="pipeline-mandatory-value-stage"
              aria-label="Lead Stage Requiring Mandatory Value"
              searchable={false}
              clearable
              placeholder="Select Stage"
              options={stageOptions}
              value={value.mandatoryValueStageId}
              onChange={(next) => set("mandatoryValueStageId", next)}
            />
          </Field>

          <Field id="pipeline-qualified-stage" label="Stages Marked as Qualified">
            <SearchableSelect
              portal
              size="lg"
              id="pipeline-qualified-stage"
              aria-label="Stages Marked as Qualified"
              searchable={false}
              clearable
              placeholder="Select Stage"
              options={stageOptions}
              value={value.qualifiedStageId}
              onChange={(next) => set("qualifiedStageId", next)}
            />
          </Field>

          {/* Bottom-aligned so the row sits level with the select beside it. */}
          <div className="self-end">
            <ToggleField
              id="pipeline-auto-convert"
              label="Automatically mark leads as Converted at Won stage"
              hint="Marks a lead as converted once it reaches the Won stage."
              checked={value.autoConvertAtWon}
              onChange={(next) => set("autoConvertAtWon", next)}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className={SECTION_TITLE}>Lead Expiry Settings</h3>
        <p className={SECTION_SUBTITLE}>
          Configure expiry duration, expired status, and reassignment behavior
          for this pipeline.
        </p>

        <div className={GRID}>
          <div className={cn(value.expiryEnabled && "self-end")}>
            <ToggleField
              id="pipeline-expiry-enabled"
              label="Set an Expiry Date for Leads?"
              showInfo={false}
              checked={value.expiryEnabled}
              onChange={(next) => set("expiryEnabled", next)}
            />
          </div>

          {/*
            Off, the dependent fields are not rendered at all — the reference collapses
            the section to the toggle alone rather than leaving an empty column. Their
            values stay in the form state, so switching back on restores them.
          */}
          {value.expiryEnabled && (
            <>
              <Field
                id="pipeline-expiry-scope"
                label="Set Expiry For"
                hint="Whether expiry applies to all leads or to individual leads."
                error={errors.expiryScope}
              >
                <SearchableSelect
                  portal
                  size="lg"
                  id="pipeline-expiry-scope"
                  aria-label="Set Expiry For"
                  searchable={false}
                  placeholder="Select"
                  options={EXPIRY_SCOPES.map((scope) => ({ ...scope }))}
                  value={value.expiryScope}
                  invalid={Boolean(errors.expiryScope)}
                  onChange={(next) =>
                    set("expiryScope", (next as ExpiryScope | null) ?? null)
                  }
                />
              </Field>

              <Field
                id="pipeline-expiry-days"
                label="Expire After (Days)"
                required
                error={errors.expiryDays}
              >
                <Input
                  id="pipeline-expiry-days"
                  aria-label="Expire After (Days)"
                  size="lg"
                  className="text-sm"
                  type="number"
                  inputMode="numeric"
                  min={MIN_EXPIRY_DAYS}
                  step={1}
                  autoComplete="off"
                  placeholder="Expire After (Days)"
                  value={value.expiryDays}
                  aria-invalid={errors.expiryDays ? true : undefined}
                  onChange={(event) => set("expiryDays", event.target.value)}
                />
              </Field>

              <Field
                id="pipeline-expired-stage"
                label="Status When Leads Expired"
                required
                hint="The stage a lead moves to when it expires."
                error={errors.expiredStageId}
              >
                <SearchableSelect
                  portal
                  size="lg"
                  id="pipeline-expired-stage"
                  aria-label="Status When Leads Expired"
                  searchable={false}
                  placeholder="Select Stage"
                  options={stageOptions}
                  value={value.expiredStageId}
                  invalid={Boolean(errors.expiredStageId)}
                  onChange={(next) => set("expiredStageId", next)}
                />
              </Field>

              <Field
                id="pipeline-reassigned-stage"
                label="Status When Reassigned to user"
                required
                hint="The stage an expired lead takes when it is reassigned."
                error={errors.reassignedStageId}
              >
                <SearchableSelect
                  portal
                  size="lg"
                  id="pipeline-reassigned-stage"
                  aria-label="Status When Reassigned to user"
                  searchable={false}
                  placeholder="Select Stage"
                  options={stageOptions}
                  value={value.reassignedStageId}
                  invalid={Boolean(errors.reassignedStageId)}
                  onChange={(next) => set("reassignedStageId", next)}
                />
              </Field>

              <Field
                id="pipeline-reassign-user"
                label="Reassign Expired Leads To"
                hint="The team member expired leads are reassigned to."
              >
                <UserTreeSelect
                  id="pipeline-reassign-user"
                  aria-label="Reassign Expired Leads To"
                  members={members}
                  loading={membersLoading}
                  value={value.reassignExpiredToId}
                  onChange={(next) => set("reassignExpiredToId", next)}
                />
              </Field>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * One labelled control: the reference's muted label, its red asterisk where it marks one,
 * its ⓘ where it shows one, and the error beneath.
 *
 * The icon is not decoration applied to every field — the reference carries it on the four
 * expiry fields and the conversion toggle and nowhere else, so it appears only where this
 * component is given the copy for it.
 */
function Field({
  id,
  label,
  hint,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    // Full height with a growing label block, so the controls in a row sit on one line
    // even when a long label wraps and its neighbour does not — which is what happens to
    // "Lead Stage Requiring Mandatory Value" once the sidebar squeezes the columns.
    <div className="flex h-full min-w-0 flex-col gap-1.5">
      <div className="flex-1">
        {hint ? (
          <SettingLabel htmlFor={id} hint={hint}>
            {label}
            {required && <Required />}
          </SettingLabel>
        ) : (
          <label htmlFor={id} className="text-sm text-ink-muted">
            {label}
            {required && <Required />}
          </label>
        )}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Required() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger">
      *
    </span>
  );
}

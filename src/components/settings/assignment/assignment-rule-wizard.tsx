"use client";

import { useState } from "react";
import {
  IconGripVertical,
  IconMinus,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { ApiError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import {
  APPLY_TO_OPTIONS,
  ASSIGNMENT_ALGORITHMS,
  TARGET_OPTIONS,
  createAssignmentRule,
  updateAssignmentRule,
  type AssignmentApplyTo,
  type AssignmentRule,
  type AssignmentRuleInput,
  type AssignmentTarget,
} from "@/services/assignment-rules-service";

export interface RuleWizardState {
  mode: "create" | "edit";
  rule: AssignmentRule | null;
}

const STEPS = [
  { label: "Rule Info" },
  { label: "Configuration" },
  { label: "Review" },
] as const;

/** A group as the wizard holds it — `key` is local, so a new group has no id yet. */
type DraftGroup = {
  key: string;
  name: string;
  applyTo: AssignmentApplyTo;
  target: AssignmentTarget;
  /** Collapsed cards show their header only, matching the reference's minus control. */
  collapsed: boolean;
  /** The reference names a group in its header; ✎ is what turns that into a field. */
  editing: boolean;
};

const labelOf = (
  options: readonly { value: string; label: string }[],
  value: string,
) => options.find((option) => option.value === value)?.label ?? value;

let groupSeq = 0;
const newGroup = (): DraftGroup => ({
  key: `group-${(groupSeq += 1)}`,
  name: "New Rule",
  applyTo: "ALL_RECORDS",
  target: "ALL_USERS",
  collapsed: false,
  editing: false,
});

/**
 * Add / Edit Assignment Rule — the Workpex three-step wizard.
 *
 * One modal for both modes, on the shared `Modal` and the shared `Stepper`: editing PATCHes
 * the same record so a rename never leaves a second copy behind. The whole rule is written
 * once, at the end of step 3 — a rule half-saved between steps is a rule the assignment
 * engine could pick up before it was finished.
 *
 * Group order is the array's order, all the way to the API, so what the drag handle shows
 * is what gets stored.
 */
export function AssignmentRuleWizard({
  state,
  onClose,
  onSaved,
}: {
  state: RuleWizardState | null;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}) {
  if (!state) return null;
  return (
    <RuleWizard
      key={state.rule?.id ?? "new"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function RuleWizard({
  state,
  onClose,
  onSaved,
}: {
  state: RuleWizardState;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}) {
  const existing = state.rule;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.status !== "INACTIVE");
  const [groups, setGroups] = useState<DraftGroup[]>(() =>
    (existing?.groups ?? []).map((group) => ({
      key: group.id,
      name: group.name,
      applyTo: group.applyTo,
      target: group.target,
      collapsed: false,
      editing: false,
    })),
  );

  const [nameTouched, setNameTouched] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<DraftGroup | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const nameError =
    name.trim() === "" ? "Rule Name is required." : undefined;

  const next = () => {
    if (step === 0) {
      // The reference marks only Rule Name with an asterisk, so only it blocks the step.
      if (nameError) {
        setNameTouched(true);
        setStepError(nameError);
        return;
      }
    }
    if (step === 1 && groups.length === 0) {
      setStepError("Add at least one configuration group before continuing.");
      return;
    }
    setStepError(null);
    setStep(step + 1);
  };

  const back = () => {
    setStepError(null);
    // Step 1's Back closes the wizard; there is nowhere earlier to go.
    if (step === 0) onClose();
    else setStep(step - 1);
  };

  const patchGroup = (key: string, patch: Partial<DraftGroup>) =>
    setGroups((current) =>
      current.map((group) =>
        group.key === key ? { ...group, ...patch } : group,
      ),
    );

  /** Moves the dragged group in front of the one it is hovering, keeping the rest. */
  const reorder = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setGroups((current) => {
      const from = current.findIndex((group) => group.key === fromKey);
      const to = current.findIndex((group) => group.key === toKey);
      if (from === -1 || to === -1) return current;
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };

  const submit = async () => {
    if (busy) return;
    if (nameError || groups.length === 0) {
      setFormError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const input: AssignmentRuleInput = {
        name: name.trim(),
        description: description.trim(),
        algorithm: "ROUND_ROBIN",
        status: isActive ? "ACTIVE" : "INACTIVE",
        groups: groups.map((group) => ({
          name: group.name.trim(),
          applyTo: group.applyTo,
          target: group.target,
        })),
      };

      const saved = existing
        ? await updateAssignmentRule(existing.id, input)
        : await createAssignmentRule(input);

      onSaved(saved.name, state.mode);
    } catch (error: unknown) {
      // The wizard stays open: a refused save must not look like a success.
      setFormError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save this rule.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="lg"
      title={state.mode === "edit" ? "Edit Assignment Rule" : "Add Assignment Rule"}
      footer={
        <>
          <Button
            variant="ghost"
            aria-label="Back"
            disabled={busy}
            onClick={back}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button aria-label="Next" onClick={next}>
              Next
            </Button>
          ) : (
            <Button
              aria-label="Save Assignment Rule"
              onClick={() => void submit()}
              isLoading={busy}
            >
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="-mt-1 text-sm text-ink-muted">
          Manage How Records Are Automatically Assigned To Users
        </p>

        {/*
          The three labels do not fit a phone-width panel. The stepper scrolls inside its
          own strip rather than letting the whole modal body drift sideways with it.
        */}
        <div className="scrollbar-slim overflow-x-auto border-y border-hairline py-4">
          <div className="min-w-[22rem]">
            <Stepper steps={STEPS} current={step} />
          </div>
        </div>

        {formError && <FormError>{formError}</FormError>}
        {stepError && <FormError>{stepError}</FormError>}

        {step === 0 && (
          <div className="flex flex-col gap-5">
            <Alert tone="warning" title="Rule Info">
              Enter the basic details of the lead assignment rule, including the
              rule name, assignment algorithm, and status.
            </Alert>

            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rule-name" className="text-sm text-ink-muted">
                  Rule Name
                  <span aria-hidden="true" className="ml-0.5 text-danger">
                    *
                  </span>
                </label>
                <Input
                  size="lg"
                  id="rule-name"
                  placeholder="Enter Rule Name"
                  value={name}
                  aria-invalid={nameTouched && nameError ? true : undefined}
                  aria-describedby={
                    nameTouched && nameError ? "rule-name-error" : undefined
                  }
                  onChange={(event) => {
                    setNameTouched(true);
                    setName(event.target.value);
                  }}
                />
                {nameTouched && nameError && (
                  <p
                    id="rule-name-error"
                    role="alert"
                    className="text-sm text-danger"
                  >
                    {nameError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rule-description"
                  className="text-sm text-ink-muted"
                >
                  Description
                </label>
                <Textarea
                  id="rule-description"
                  rows={2}
                  placeholder="Enter Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              {/*
                The reference draws the algorithm as one selected option, not a dropdown —
                Round Robin is the only one it offers, so it is shown selected rather than
                as a choice that does not exist (CLAUDE.md §16.1).
              */}
              <div className="flex min-h-control-lg items-center gap-2 rounded-control border border-brand bg-brand-subtle px-4 py-2">
                <span
                  aria-hidden="true"
                  className="flex size-4 shrink-0 items-center justify-center rounded-full border-[5px] border-brand bg-surface"
                />
                <span className="text-sm text-ink">
                  Assignment Algorithm |{" "}
                  <span className="font-semibold">
                    {labelOf(ASSIGNMENT_ALGORITHMS, "ROUND_ROBIN")}
                  </span>
                </span>
              </div>

              <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control bg-canvas px-4 py-2">
                <label htmlFor="rule-status" className="text-sm text-ink-muted">
                  {isActive ? "Active" : "Inactive"}
                </label>
                <Switch
                  id="rule-status"
                  aria-label="Rule status"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-control border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink">
                  {groups.length} Active Rules
                </p>
                <p className="text-sm text-ink-muted">
                  Configure assignment logic for your teams
                </p>
              </div>
              <Button
                aria-label="Add New Group"
                onClick={() => {
                  setStepError(null);
                  setGroups((current) => [...current, newGroup()]);
                }}
              >
                <IconPlus size={16} stroke={2} aria-hidden="true" />
                Add New
              </Button>
            </div>

            {groups.map((group, index) => (
              <div
                key={group.key}
                draggable
                onDragStart={() => setDragKey(group.key)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragKey) reorder(dragKey, group.key);
                }}
                onDragEnd={() => setDragKey(null)}
                className={cn(
                  "rounded-control border border-hairline p-4",
                  dragKey === group.key && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="shrink-0 cursor-grab text-ink-subtle"
                  >
                    <IconGripVertical size={18} stroke={1.75} />
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">
                    {index + 1}
                  </span>

                  {group.editing ? (
                    <Input
                      autoFocus
                      id={`${group.key}-name`}
                      aria-label={`Group ${index + 1} name`}
                      className="min-w-0 flex-1"
                      value={group.name}
                      onChange={(event) =>
                        patchGroup(group.key, { name: event.target.value })
                      }
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {group.name}
                    </span>
                  )}

                  <Button
                    size="sm"
                    aria-label={`Save Group ${index + 1}`}
                    onClick={() =>
                      patchGroup(group.key, { collapsed: true, editing: false })
                    }
                  >
                    Save
                  </Button>
                  <IconAction
                    label={`Collapse Group ${index + 1}`}
                    icon={IconMinus}
                    onClick={() =>
                      patchGroup(group.key, { collapsed: !group.collapsed })
                    }
                  />
                  <IconAction
                    label={`Edit Group ${index + 1}`}
                    icon={IconPencil}
                    onClick={() =>
                      patchGroup(group.key, { collapsed: false, editing: true })
                    }
                  />
                  <IconAction
                    label={`Delete Group ${index + 1}`}
                    icon={IconTrash}
                    danger
                    onClick={() => setDeleting(group)}
                  />
                </div>

                {!group.collapsed && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label
                        htmlFor={`${group.key}-apply`}
                        className="text-sm whitespace-nowrap text-ink"
                      >
                        Apply this rule to
                      </label>
                      <div className="sm:w-52">
                        <SearchableSelect
                          portal
                          id={`${group.key}-apply`}
                          aria-label={`Apply Group ${index + 1} to`}
                          searchable={false}
                          options={[...APPLY_TO_OPTIONS]}
                          value={group.applyTo}
                          onChange={(value) =>
                            value &&
                            patchGroup(group.key, {
                              applyTo: value as AssignmentApplyTo,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label
                        htmlFor={`${group.key}-target`}
                        className="text-sm whitespace-nowrap text-ink"
                      >
                        Assign Leads Based on The Rules to
                      </label>
                      <div className="sm:w-52">
                        <SearchableSelect
                          portal
                          id={`${group.key}-target`}
                          aria-label={`Assign Group ${index + 1} to`}
                          searchable={false}
                          options={[...TARGET_OPTIONS]}
                          value={group.target}
                          onChange={(value) =>
                            value &&
                            patchGroup(group.key, {
                              target: value as AssignmentTarget,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <Alert tone="warning" title="Review">
              Please verify your rule information and configuration details
              before submission.
            </Alert>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                Rule Information
              </h3>
              <dl className="grid gap-px overflow-hidden rounded-control border border-hairline bg-hairline sm:grid-cols-4">
                <Summary label="Rule Name" value={name.trim()} />
                <Summary
                  label="Assignment Algorithm"
                  value={labelOf(ASSIGNMENT_ALGORITHMS, "ROUND_ROBIN")}
                />
                <Summary label="Status" value={isActive ? "Active" : "Inactive"} />
                <Summary
                  label="Created Date"
                  value={formatDate(existing?.createdAt ?? new Date().toISOString())}
                />
              </dl>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-ink">Description</h3>
              <p className="text-sm text-ink-muted">
                {description.trim() === "" ? "—" : description.trim()}
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                Configuration Groups
              </h3>
              {groups.map((group, index) => (
                <div
                  key={group.key}
                  className="rounded-control border border-hairline p-4"
                >
                  <p className="text-sm font-medium text-ink">
                    Group {index + 1} – {group.name}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {labelOf(APPLY_TO_OPTIONS, group.applyTo)} →{" "}
                    {labelOf(TARGET_OPTIONS, group.target)}
                  </p>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this configuration group?"
        description={
          deleting
            ? `${deleting.name} will be removed from this rule. The rule is saved at the end of the wizard.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          setGroups((current) =>
            current.filter((group) => group.key !== deleting?.key),
          );
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </Modal>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-surface p-4 text-center">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}

function IconAction({
  label,
  icon: Icon,
  danger,
  onClick,
}: {
  label: string;
  icon: typeof IconMinus;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "focus-ring flex size-8 shrink-0 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
        danger ? "hover:text-danger" : "hover:text-ink",
      )}
    >
      <Icon size={16} stroke={1.75} aria-hidden="true" />
    </button>
  );
}

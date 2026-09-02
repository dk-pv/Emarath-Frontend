"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { ApiError, isAbortError } from "@/lib/api-client";
import { fetchLookup } from "@/services/lookups-service";
import {
  createTeamMember,
  fetchLeadForms,
  fetchNamedRoles,
  fetchPermissionCatalog,
  fetchTeamMemberDetail,
  fetchTeamMembers,
  updateTeamMember,
  uploadTeamMemberAvatar,
  WHATSAPP_ACCESS_OPTIONS,
  type LeadFormOption,
  type NamedRole,
  type PermissionCatalogRow,
  type PermissionEntry,
  type TeamMember,
  type WhatsappAccessLevel,
} from "@/services/users-service";
import { PermissionMatrix, type MatrixState } from "./permission-matrix";
import {
  AvatarDropzone,
  ColorCodeField,
  InfoHint,
  PasswordInput,
  ToggleRow,
} from "./wizard-fields";

const STEPS = [
  { label: "Personal Info" },
  { label: "Role & Access" },
  { label: "Permission" },
] as const;

type WizardForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  avatarFile: File | null;
  colorCode: string | null;
  monthlyGoal: string;
  jobTitle: string;
  roleId: string | null;
  reportingToId: string | null;
  pipelines: string[];
  isActive: boolean;
  leadFormId: string | null;
  appAccess: boolean;
  trackCheckInOut: boolean;
  trackMeetingLocation: boolean;
  includeInReporting: boolean;
  autoFollowUpPrompt: boolean;
  whatsappInboxAccess: WhatsappAccessLevel | null;
  matrix: MatrixState;
};

const INITIAL_FORM: WizardForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  avatarFile: null,
  colorCode: null,
  monthlyGoal: "",
  jobTitle: "",
  roleId: null,
  reportingToId: null,
  pipelines: [],
  isActive: true,
  leadFormId: null,
  appAccess: false,
  trackCheckInOut: false,
  trackMeetingLocation: false,
  includeInReporting: false,
  autoFollowUpPrompt: false,
  whatsappInboxAccess: null,
  matrix: {},
};

type WizardOptions = {
  roles: NamedRole[];
  leadForms: LeadFormOption[];
  catalog: PermissionCatalogRow[];
  pipelines: { value: string; label: string }[];
  managers: { id: string; name: string }[];
};

/** Sends a rejected save back to the step that owns the offending field. */
function stepForError(message: string): number | null {
  if (/email|password|phone|name/i.test(message)) return 0;
  if (/role|pipeline|report/i.test(message)) return 1;
  if (/lead form|permission|module|whatsapp/i.test(message)) return 2;
  return null;
}

/** Reporting-to candidates: every live member except the one being edited. */
function withoutSelf(
  rows: readonly { id: string; name: string }[],
  selfId: string | undefined,
): { id: string; name: string }[] {
  return rows
    .filter((row) => row.id !== selfId)
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * The "Create A Team Member" wizard (Settings → Users & Access), the full three-step
 * reference: Personal Info → Role & Access → Permission. One drawer serves create and
 * edit; state is seeded at mount and the parent keys this component per target, so
 * switching rows remounts it rather than syncing effects.
 *
 * Every option list is real — named roles, lead forms, the permission catalogue and the
 * pipelines lookup come from the API, and Reporting To lists actual team members. On
 * submit the whole configuration persists in one request (the matrix transactionally
 * with the account); the profile picture uploads right after, once an id exists to
 * attach it to. Editing never touches the password — that stays the roster's separate
 * explicit action. A rejected save keeps the entered state and lands on the step that
 * owns the offending field.
 */
export function TeamMemberFormDrawer({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null creates; a member edits. */
  member: TeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = member !== null;
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(
    null,
  );
  const [options, setOptions] = useState<WizardOptions | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState<false | "error" | "forbidden">(
    false,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (changes: Partial<WizardForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      const [roles, leadForms, catalog, pipelines, managers] =
        await Promise.all([
          fetchNamedRoles(controller.signal),
          fetchLeadForms(controller.signal),
          fetchPermissionCatalog(controller.signal),
          fetchLookup("pipelines", controller.signal),
          fetchTeamMembers(
            { page: 1, size: 100 },
            undefined,
            controller.signal,
          ),
        ]);
      if (!active) return;
      setOptions({
        roles,
        leadForms,
        catalog,
        pipelines,
        managers: withoutSelf(managers.rows, member?.id),
      });

      if (member) {
        const detail = await fetchTeamMemberDetail(
          member.id,
          controller.signal,
        );
        if (!active) return;
        const matrix: MatrixState = {};
        for (const entry of detail.permissions) {
          matrix[entry.module] = {
            canView: entry.canView ?? false,
            canAdd: entry.canAdd ?? false,
            canEdit: entry.canEdit ?? false,
          };
        }
        setForm({
          ...INITIAL_FORM,
          firstName: detail.firstName ?? detail.name,
          lastName: detail.lastName ?? "",
          email: detail.email,
          phone: detail.phone ?? "",
          jobTitle: detail.jobTitle ?? "",
          colorCode: detail.colorCode,
          monthlyGoal: detail.monthlyGoalAmount ?? "",
          roleId: detail.roleId,
          reportingToId: detail.reportingToId,
          pipelines: detail.pipelines,
          isActive: detail.isActive,
          leadFormId: detail.leadFormId,
          appAccess: detail.appAccess,
          trackCheckInOut: detail.trackCheckInOut,
          trackMeetingLocation: detail.trackMeetingLocation,
          includeInReporting: detail.includeInReporting,
          autoFollowUpPrompt: detail.autoFollowUpPrompt,
          whatsappInboxAccess: detail.whatsappInboxAccess,
          matrix,
        });
        setExistingAvatarUrl(detail.avatarUrl);
        setDetailLoaded(true);
      }
    };

    load().catch((caught: unknown) => {
      if (active && !isAbortError(caught))
        setLoadFailed(
          caught instanceof ApiError && caught.status === 403
            ? "forbidden"
            : "error",
        );
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, member, reloadToken]);

  // ---------- validation ----------
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim());
  const phoneOk = /^\d{6,20}$/.test(form.phone);
  const passwordOk = isEdit || form.password.length >= 8;
  const confirmOk = isEdit || form.confirmPassword === form.password;
  const goalTrim = form.monthlyGoal.trim();
  const goalOk =
    goalTrim === "" ||
    (!Number.isNaN(Number(goalTrim)) && Number(goalTrim) >= 0);

  const stepValid = [
    form.firstName.trim() !== "" &&
      form.lastName.trim() !== "" &&
      emailOk &&
      phoneOk &&
      passwordOk &&
      confirmOk &&
      goalOk,
    form.roleId !== null && form.pipelines.length > 0,
    form.leadFormId !== null,
  ];

  // ---------- submit ----------
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const permissions: PermissionEntry[] = Object.entries(form.matrix)
        .filter(([, row]) => row.canView || row.canAdd || row.canEdit)
        .map(([module, row]) => ({ module, ...row }));

      const shared = {
        jobTitle: form.jobTitle.trim() || null,
        roleId: form.roleId ?? undefined,
        reportingToId: form.reportingToId,
        leadFormId: form.leadFormId,
        pipelines: form.pipelines,
        isActive: form.isActive,
        appAccess: form.appAccess,
        trackCheckInOut: form.trackCheckInOut,
        trackMeetingLocation: form.trackMeetingLocation,
        includeInReporting: form.includeInReporting,
        autoFollowUpPrompt: form.autoFollowUpPrompt,
        whatsappInboxAccess: form.whatsappInboxAccess,
        colorCode: form.colorCode,
        monthlyGoalAmount: goalTrim === "" ? null : Number(goalTrim),
        permissions,
      };
      const identity = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
      };

      const saved = isEdit
        ? await updateTeamMember(member.id, { ...identity, ...shared })
        : await createTeamMember({
            ...identity,
            ...shared,
            roleId: form.roleId as string,
            password: form.password,
          });

      if (form.avatarFile) {
        try {
          await uploadTeamMemberAvatar(saved.id, form.avatarFile);
        } catch {
          // The account exists; only the picture failed. Say exactly that.
          toast({
            title: "Profile picture could not be uploaded",
            description: "The team member was saved without it.",
            tone: "warning",
          });
        }
      }

      toast({
        title: isEdit
          ? `${saved.name} updated`
          : `${saved.name} added to the team`,
        tone: "success",
      });
      onSaved();
    } catch (caught: unknown) {
      const message =
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : "Could not save this team member.";
      setError(message);
      const target = stepForError(message);
      if (target !== null) setStep(target);
    } finally {
      setBusy(false);
    }
  };

  const loading = options === null || !detailLoaded;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={isEdit ? "Edit Team Member" : "Create A Team Member"}
      footer={
        <div className="flex items-center justify-end gap-3">
          {step === 0 ? (
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              disabled={busy}
            >
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={loading || loadFailed !== false || !stepValid[step]}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={() => void save()}
              disabled={loading || loadFailed !== false || !stepValid[2]}
              isLoading={busy}
            >
              {isEdit ? "Save Changes" : "Submit"}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Stepper steps={STEPS} current={step} />

        {error && <FormError>{error}</FormError>}

        {loadFailed ? (
          <ErrorState
            className="py-10"
            title={
              loadFailed === "forbidden"
                ? "You don't have access to team member management"
                : "Couldn't load the form options"
            }
            description={
              loadFailed === "forbidden"
                ? "Creating and editing team members is limited to administrator accounts. Sign in as an administrator and try again."
                : "Roles, pipelines and permissions could not be fetched. Check your connection and try again."
            }
            onRetry={() => {
              setLoadFailed(false);
              setOptions(null);
              setReloadToken((token) => token + 1);
            }}
          />
        ) : loading ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : step === 0 ? (
          <StepPersonalInfo
            form={form}
            patch={patch}
            isEdit={isEdit}
            existingAvatarUrl={existingAvatarUrl}
            emailOk={emailOk}
            phoneOk={phoneOk}
            confirmOk={confirmOk}
            goalOk={goalOk}
            onFileError={(message) => setError(message)}
          />
        ) : step === 1 ? (
          <StepRoleAccess form={form} patch={patch} options={options} />
        ) : (
          <StepPermission form={form} patch={patch} options={options} />
        )}
      </div>
    </Drawer>
  );
}

function StepPersonalInfo({
  form,
  patch,
  isEdit,
  existingAvatarUrl,
  emailOk,
  phoneOk,
  confirmOk,
  goalOk,
  onFileError,
}: {
  form: WizardForm;
  patch: (changes: Partial<WizardForm>) => void;
  isEdit: boolean;
  existingAvatarUrl: string | null;
  emailOk: boolean;
  phoneOk: boolean;
  confirmOk: boolean;
  goalOk: boolean;
  onFileError: (message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="First Name" required htmlFor="tm-first-name">
        <Input
          id="tm-first-name"
          value={form.firstName}
          placeholder="Add First Name"
          onChange={(event) => patch({ firstName: event.target.value })}
        />
      </FormField>

      <FormField label="Last Name" required htmlFor="tm-last-name">
        <Input
          id="tm-last-name"
          value={form.lastName}
          placeholder="Add Last Name"
          onChange={(event) => patch({ lastName: event.target.value })}
        />
      </FormField>

      <FormField
        label="Email Address"
        required
        htmlFor="tm-email"
        error={
          form.email && !emailOk ? "Enter a valid email address." : undefined
        }
      >
        <Input
          id="tm-email"
          type="email"
          value={form.email}
          placeholder="Add Email Address"
          onChange={(event) => patch({ email: event.target.value })}
        />
      </FormField>

      <FormField
        label="Phone"
        required
        htmlFor="tm-phone"
        error={
          form.phone && !phoneOk ? "Enter a valid phone number." : undefined
        }
      >
        <PhoneInput
          id="tm-phone"
          value={form.phone}
          placeholder="Add Phone"
          onChange={(phone) => patch({ phone })}
        />
      </FormField>

      {!isEdit && (
        <>
          <FormField
            label="Password"
            required
            htmlFor="tm-password"
            hint="At least 8 characters."
          >
            <PasswordInput
              id="tm-password"
              value={form.password}
              placeholder="Add Password"
              autoComplete="new-password"
              onChange={(event) => patch({ password: event.target.value })}
            />
          </FormField>

          <FormField
            label="Confirm Password"
            required
            htmlFor="tm-confirm-password"
            error={
              form.confirmPassword && !confirmOk
                ? "Passwords do not match."
                : undefined
            }
          >
            <PasswordInput
              id="tm-confirm-password"
              value={form.confirmPassword}
              placeholder="Confirm Password"
              autoComplete="new-password"
              onChange={(event) =>
                patch({ confirmPassword: event.target.value })
              }
            />
          </FormField>
        </>
      )}

      <FormField label="Profile Picture" htmlFor="tm-avatar">
        <AvatarDropzone
          file={form.avatarFile}
          existingUrl={existingAvatarUrl}
          onChange={(avatarFile) => patch({ avatarFile })}
          onError={onFileError}
        />
      </FormField>

      <FormField
        label="Color Code"
        htmlFor="tm-color"
        hint="Shown on this member's buttons and badges."
      >
        <ColorCodeField
          id="tm-color"
          value={form.colorCode}
          onChange={(colorCode) => patch({ colorCode })}
        />
      </FormField>

      <div className="mt-2 border-t border-hairline pt-4">
        <h3 className="text-base font-semibold text-ink">Target Settings</h3>
        <div className="mt-3">
          <FormField
            label="Monthly Goal Amount"
            htmlFor="tm-goal"
            error={!goalOk ? "Enter a valid amount." : undefined}
          >
            <Input
              id="tm-goal"
              inputMode="decimal"
              value={form.monthlyGoal}
              placeholder="Add Monthly Goal Amount"
              onChange={(event) => patch({ monthlyGoal: event.target.value })}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

function StepRoleAccess({
  form,
  patch,
  options,
}: {
  form: WizardForm;
  patch: (changes: Partial<WizardForm>) => void;
  options: WizardOptions;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormField
        label="Job Title"
        htmlFor="tm-job-title"
        hint="Shown in the roster; separate from the role that controls access."
      >
        <Input
          id="tm-job-title"
          value={form.jobTitle}
          placeholder="Add Job Title"
          onChange={(event) => patch({ jobTitle: event.target.value })}
        />
      </FormField>

      <FormField label="Role" required htmlFor="tm-role">
        <SearchableSelect
          id="tm-role"
          searchable
          options={options.roles.map((role) => ({
            value: role.id,
            label: role.name,
          }))}
          value={form.roleId}
          placeholder="Select"
          onChange={(roleId) => patch({ roleId })}
        />
      </FormField>

      <FormField
        label="Reporting To"
        htmlFor="tm-reporting-to"
        hint="Organisational reporting line; it does not change what this member can see."
      >
        <SearchableSelect
          id="tm-reporting-to"
          searchable
          clearable
          options={options.managers.map((manager) => ({
            value: manager.id,
            label: manager.name,
          }))}
          value={form.reportingToId}
          placeholder="Select"
          onChange={(reportingToId) => patch({ reportingToId })}
        />
      </FormField>

      <FormField label="Pipeline" required htmlFor="tm-pipelines">
        <MultiSelect
          searchable
          options={options.pipelines}
          value={form.pipelines}
          placeholder="Select"
          onChange={(pipelines) => patch({ pipelines })}
        />
      </FormField>

      <ToggleRow
        id="tm-status"
        label={`Status : ${form.isActive ? "Active" : "Inactive"}`}
        hint="An inactive member cannot sign in, and any live session ends."
        checked={form.isActive}
        onChange={(isActive) => patch({ isActive })}
      />
    </div>
  );
}

function StepPermission({
  form,
  patch,
  options,
}: {
  form: WizardForm;
  patch: (changes: Partial<WizardForm>) => void;
  options: WizardOptions;
}) {
  return (
    <div className="flex flex-col gap-5">
      <FormField label="Assign Lead Form" required htmlFor="tm-lead-form">
        <SearchableSelect
          id="tm-lead-form"
          searchable
          options={options.leadForms.map((leadForm) => ({
            value: leadForm.id,
            label: leadForm.name,
          }))}
          value={form.leadFormId}
          placeholder="Select Assign Lead"
          onChange={(leadFormId) => patch({ leadFormId })}
        />
      </FormField>

      <section>
        <h3 className="text-base font-semibold text-ink">
          Permissions &amp; Tracking
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          <ToggleRow
            id="tm-app-access"
            label="App Access"
            hint="Whether this member may use the field app."
            checked={form.appAccess}
            onChange={(appAccess) => patch({ appAccess })}
          />
          <ToggleRow
            id="tm-track-check"
            label="Track the check in and check out"
            hint="Record this member's check-ins and check-outs on the GPS map."
            checked={form.trackCheckInOut}
            onChange={(trackCheckInOut) => patch({ trackCheckInOut })}
          />
          <ToggleRow
            id="tm-track-meetings"
            label="Track the location of Meetings.."
            hint="Record where this member's meetings take place."
            checked={form.trackMeetingLocation}
            onChange={(trackMeetingLocation) => patch({ trackMeetingLocation })}
          />
          <ToggleRow
            id="tm-reporting"
            label="Include in Reporting and Analysis"
            hint="Count this member in reports and analytics."
            checked={form.includeInReporting}
            onChange={(includeInReporting) => patch({ includeInReporting })}
          />
          <ToggleRow
            id="tm-auto-follow-up"
            label="Automatic Prompt to Create fol.."
            hint="Prompt this member to create a follow-up after a call."
            checked={form.autoFollowUpPrompt}
            onChange={(autoFollowUpPrompt) => patch({ autoFollowUpPrompt })}
          />
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Whatsapp Settings</h3>
        <div className="mt-3">
          <FormField
            label="WhatsApp Inbox Access Level"
            htmlFor="tm-whatsapp"
            hint="How much of the shared WhatsApp inbox this member can read."
          >
            <SearchableSelect
              id="tm-whatsapp"
              clearable
              options={WHATSAPP_ACCESS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={form.whatsappInboxAccess}
              placeholder="Select"
              onChange={(value) =>
                patch({
                  whatsappInboxAccess: value as WhatsappAccessLevel | null,
                })
              }
            />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          User Permissions
          <InfoHint label="Stored per member and returned by the API; day-to-day access still follows the account's role." />
        </h3>
        <div className="mt-3 rounded-surface border border-hairline">
          <PermissionMatrix
            catalog={options.catalog}
            state={form.matrix}
            onChange={(matrix) => patch({ matrix })}
          />
        </div>
      </section>
    </div>
  );
}

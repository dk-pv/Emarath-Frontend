"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  createPipeline,
  updatePipeline,
  type PipelineNode,
} from "@/services/pipelines-service";
import { fetchStages, type Stage } from "@/services/stages-service";
import { fetchTeamMembers, type TeamMember } from "@/services/users-service";
import {
  PipelineWizardStep1,
  WizardStepper,
  validateStep1,
  type PermissionRow,
  type Step1Errors,
  type Step1Value,
} from "./pipeline-wizard-step1";
import { PipelineWizardStages } from "./pipeline-wizard-stages";
import {
  PipelineWizardSettings,
  toSettingsForm,
  toSettingsInput,
  validateSettings,
  type SettingsErrors,
  type SettingsForm,
} from "./pipeline-wizard-settings";

const STEPS = ["Create Pipeline", "Stages", "Settings"] as const;

/** The users API caps a page at 100; the roster is well inside that. */
const ROSTER_PAGE_SIZE = 100;

/** A pipeline with nothing configured yet — the state every new one starts in. */
const emptySettings = (): SettingsForm => ({
  defaultStageId: null,
  mandatoryValueStageId: null,
  qualifiedStageId: null,
  autoConvertAtWon: false,
  expiryEnabled: false,
  expiryScope: null,
  expiryDays: "",
  expiredStageId: null,
  reassignedStageId: null,
  reassignExpiredToId: null,
});

const emptyStep1 = (): Step1Value => ({
  name: "",
  shortCode: "",
  accessMode: "ALL_USERS",
  permissions: [],
  cloneEnabled: false,
  templateKey: null,
});

const fromPipeline = (pipeline: PipelineNode): Step1Value => ({
  name: pipeline.name,
  shortCode: pipeline.shortCode ?? "",
  accessMode: pipeline.accessMode,
  permissions: pipeline.permissions.map<PermissionRow>((grant) => ({
    key: grant.id,
    permissionType: grant.permissionType,
    roleId: grant.roleId ?? undefined,
    userId: grant.userId ?? undefined,
  })),
  cloneEnabled: false,
  templateKey: null,
});

export interface PipelineWizardProps {
  /** The pipeline being edited, or null to create one. */
  pipeline: PipelineNode | null;
  onClose: () => void;
  /** Called after any write, so the list behind the wizard stays current. */
  onSaved: () => void;
}

/**
 * The Sales Pipeline Add/Edit wizard — Create Pipeline → Stages → Settings.
 *
 * It replaces the list inside the same card, which is how the reference shows it: the
 * card header and its subtitle stay put and only the body changes, with no overlay.
 *
 * Step 1 persists on Next. That is deliberate rather than incidental: step 2 edits real
 * stage records through the existing stage API (KAN-05.1), and a stage cannot belong to a
 * pipeline that does not exist yet. The consequence — leaving after step 1 keeps the
 * pipeline — is recorded in ADR-0060.
 */
export function PipelineWizard({
  pipeline,
  onClose,
  onSaved,
}: PipelineWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [value, setValue] = useState<Step1Value>(
    pipeline ? fromPipeline(pipeline) : emptyStep1(),
  );
  const [errors, setErrors] = useState<Step1Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The pipeline the stage step writes to: the one being edited, or the one just made. */
  const [target, setTarget] = useState<PipelineNode | null>(pipeline);
  const [stages, setStages] = useState<Stage[] | null>(null);

  /**
   * Step 3 lives here rather than inside the step, so stepping back to 2 and forward
   * again keeps whatever the user had entered. Editing starts from what is stored.
   */
  const [settings, setSettings] = useState<SettingsForm>(
    pipeline ? toSettingsForm(pipeline.settings) : emptySettings(),
  );
  const [settingsErrors, setSettingsErrors] = useState<SettingsErrors>({});
  const [members, setMembers] = useState<readonly TeamMember[] | null>(null);

  useEffect(() => {
    // Step 3's stage selects read the same list step 2 edits.
    if ((step !== 2 && step !== 3) || !target) return;
    const controller = new AbortController();
    let active = true;

    fetchStages(target.name, controller.signal)
      .then((rows) => {
        if (active) setStages(rows);
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setStages([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [step, target]);

  // The roster behind step 3's "Reassign Expired Leads To" tree. Fetched once, when the
  // step that needs it is first opened.
  useEffect(() => {
    if (step !== 3 || members !== null) return;
    const controller = new AbortController();
    let active = true;

    fetchTeamMembers({ page: 1, size: ROSTER_PAGE_SIZE }, undefined, controller.signal)
      .then((page) => {
        if (active) setMembers(page.rows);
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setMembers([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [step, members]);

  /** Re-reads the stage list after a write in step 2. Never called from an effect. */
  const refreshStages = useCallback(async () => {
    if (!target) return;
    setStages(await fetchStages(target.name));
  }, [target]);

  const message = (error: unknown, fallback: string) =>
    error instanceof ApiError ? (error.messages[0] ?? error.message) : fallback;

  /** Persists step 1, then advances. Editing patches; creating inserts. */
  const commitStep1 = async () => {
    const found = validateStep1(value);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSaveError(null);
    try {
      const permissions =
        value.accessMode === "SPECIFIC"
          ? value.permissions.map((row) => ({
              permissionType: row.permissionType,
              roleId: row.roleId,
              userId: row.userId,
            }))
          : [];

      const saved = target
        ? await updatePipeline(target.id, {
            name: value.name.trim(),
            shortCode: value.shortCode.trim().toUpperCase(),
            accessMode: value.accessMode,
            permissions,
          })
        : await createPipeline({
            name: value.name.trim(),
            shortCode: value.shortCode.trim().toUpperCase(),
            accessMode: value.accessMode,
            permissions,
            ...(value.cloneEnabled && value.templateKey
              ? { templateKey: value.templateKey }
              : {}),
          });

      setTarget(saved);
      setValue(fromPipeline(saved));
      // A brand-new pipeline arrives with nothing configured; an edited one arrives with
      // whatever is stored. Either way step 3 starts from the server's own answer.
      if (!target) setSettings(toSettingsForm(saved.settings));
      onSaved();
      setStep(2);
    } catch (error: unknown) {
      setSaveError(message(error, "Could not save this pipeline."));
    } finally {
      setBusy(false);
    }
  };

  /** Step 3's Save — the wizard's last write, then back to the list. */
  const commitSettings = async () => {
    if (!target) return;
    const found = validateSettings(settings);
    setSettingsErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setSaveError(null);
    try {
      await updatePipeline(target.id, { settings: toSettingsInput(settings) });
      toast({
        title: "Successful",
        description: `${target.name} has been saved successfully.`,
        tone: "success",
      });
      onSaved();
      onClose();
    } catch (error: unknown) {
      setSaveError(message(error, "Could not save these settings."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <WizardStepper step={step} labels={STEPS} />

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
        {saveError && (
          <div className="px-5 pt-5">
            <FormError>{saveError}</FormError>
          </div>
        )}

        {step === 1 && (
          <PipelineWizardStep1
            value={value}
            errors={errors}
            onChange={(next) => {
              setValue(next);
              setErrors({});
            }}
          />
        )}

        {step === 2 &&
          (target === null ? null : stages === null ? (
            <div className="flex flex-col gap-3 p-5" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <PipelineWizardStages
              pipeline={target.name}
              stages={stages}
              onChanged={refreshStages}
            />
          ))}

        {step === 3 &&
          (target === null ? null : stages === null ? (
            <div className="flex flex-col gap-3 p-5" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <PipelineWizardSettings
              value={settings}
              errors={settingsErrors}
              stages={stages}
              members={members ?? []}
              membersLoading={members === null}
              onChange={(next) => {
                setSettings(next);
                setSettingsErrors({});
              }}
            />
          ))}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
        <Button
          variant="ghost"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
          disabled={busy}
        >
          Back
        </Button>
        {step === 1 && (
          <Button onClick={() => void commitStep1()} isLoading={busy}>
            Next
          </Button>
        )}
        {step === 2 && <Button onClick={() => setStep(3)}>Next</Button>}
        {step === 3 && (
          <Button onClick={() => void commitSettings()} isLoading={busy}>
            Save
          </Button>
        )}
      </footer>
    </>
  );
}

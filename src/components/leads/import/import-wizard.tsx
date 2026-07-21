"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { Stepper } from "@/components/ui/Stepper";
import {
  IMPORT_STEPS,
  autoMap,
  requiredFieldsMapped,
  type FieldMapping,
} from "@/components/leads/import/import-data";
import { StepImport } from "@/components/leads/import/step-import";
import { StepMapFields } from "@/components/leads/import/step-map-fields";
import {
  StepPreview,
  type ValidationState,
} from "@/components/leads/import/step-preview";
import { StepSettings } from "@/components/leads/import/step-settings";
import { StepUpload } from "@/components/leads/import/step-upload";
import {
  fetchImportFields,
  validateImport,
  type ImportFieldOption,
  type ParseResult,
} from "@/services/leads-import-service";

/** A stable key for a validation request, so a stored result maps to its inputs. */
function validationSignature(
  file: File,
  pipeline: string,
  mapping: FieldMapping,
): string {
  return `${file.name}|${pipeline}|${JSON.stringify(mapping)}`;
}

/**
 * The Leads bulk-import wizard (LEAD-07.2 UI wired to LEAD-07.1 backend).
 *
 * The visible flow — five steps, the stepper, the footers — is unchanged from the
 * Workpex walkthrough; every value is now real. Upload parses the file server-side
 * (Map Fields uses the detected columns), Preview validates against the backend
 * (real counts and per-row reasons), and Import starts an async job and polls it.
 * The target field catalog is fetched once up front, so the wizard renders only
 * after it is known — that is what lets the auto-mapping run against real fields.
 */
export function ImportWizard() {
  const router = useRouter();
  const [fields, setFields] = useState<ImportFieldOption[] | null>(null);
  const [fieldsError, setFieldsError] = useState(false);
  const [fieldsReload, setFieldsReload] = useState(0);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [pipeline, setPipeline] = useState("");
  const [savedMapping, setSavedMapping] = useState("");
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [validationResult, setValidationResult] = useState<{
    key: string;
    value: Exclude<ValidationState, { status: "loading" }>;
  } | null>(null);

  // Load the target field catalog. Retrying bumps `fieldsReload` to re-run the
  // effect; state is only set asynchronously (the useListData/useLookup pattern).
  useEffect(() => {
    const controller = new AbortController();
    fetchImportFields(controller.signal)
      .then((loaded) => {
        setFields(loaded);
        setFieldsError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFieldsError(true);
      });
    return () => controller.abort();
  }, [fieldsReload]);

  const retryFields = () => {
    setFields(null);
    setFieldsError(false);
    setFieldsReload((value) => value + 1);
  };

  // Validate against the backend when the Preview step is entered, keyed by its
  // inputs. "loading" is derived when no stored result matches the current key, so
  // nothing is set synchronously inside the effect body.
  const validationKey =
    step === 3 && file ? validationSignature(file, pipeline, mapping) : "";

  useEffect(() => {
    if (step !== 3 || !file) return;
    const key = validationSignature(file, pipeline, mapping);
    const controller = new AbortController();
    validateImport(file, mapping, pipeline, controller.signal)
      .then((result) =>
        setValidationResult({ key, value: { status: "done", result } }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setValidationResult({
          key,
          value: {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not validate the file.",
          },
        });
      });
    return () => controller.abort();
  }, [step, file, mapping, pipeline]);

  const validation: ValidationState | null =
    step !== 3
      ? null
      : validationResult && validationResult.key === validationKey
        ? validationResult.value
        : { status: "loading" };

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const unmappedCount = Object.keys(mapping).length - mappedCount;
  const validCount =
    validation?.status === "done" ? validation.result.valid : 0;

  const next = () =>
    setStep((value) => Math.min(value + 1, IMPORT_STEPS.length - 1));
  const back = () => setStep((value) => Math.max(value - 1, 0));

  const reset = () => {
    setFile(null);
    setParsed(null);
    setPipeline("");
    setSavedMapping("");
    setMapping({});
    setValidationResult(null);
    setStep(0);
  };

  if (fieldsError) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <ErrorState
          title="Couldn’t start the import"
          description="We couldn’t load the import fields. Check your connection and try again."
          onRetry={retryFields}
        />
      </div>
    );
  }

  if (!fields) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <Loading label="Preparing import" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-surface border border-hairline bg-surface shadow-sm">
        <div className="overflow-x-auto border-b border-hairline px-6 py-5 scrollbar-slim">
          <div className="min-w-[640px]">
            <Stepper steps={IMPORT_STEPS} current={step} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-slim">
          {step === 0 && (
            <StepUpload
              onParsed={(uploaded, result) => {
                setFile(uploaded);
                setParsed(result);
                setMapping(autoMap(result.columns, fields));
                next();
              }}
            />
          )}
          {step === 1 && (
            <StepSettings
              pipeline={pipeline}
              onPipelineChange={setPipeline}
              savedMapping={savedMapping}
              onSavedMappingChange={setSavedMapping}
            />
          )}
          {step === 2 && parsed && (
            <StepMapFields
              columns={parsed.columns}
              fields={fields}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          )}
          {step === 3 && (
            <StepPreview
              pipeline={pipeline}
              columns={parsed?.columns ?? []}
              validation={validation}
            />
          )}
          {step === 4 && file && (
            <StepImport
              file={file}
              mapping={mapping}
              pipeline={pipeline}
              onGoToLeads={() => router.push("/leads")}
              onImportAnother={reset}
            />
          )}
        </div>

        {step === 1 && (
          <WizardFooter
            onBack={back}
            primaryLabel="Proceed to Field Mapping"
            primaryDisabled={!pipeline}
            onPrimary={next}
          />
        )}

        {step === 2 && (
          <WizardFooter
            onBack={back}
            primaryLabel="Continue to Preview"
            primaryDisabled={!requiredFieldsMapped(mapping, fields)}
            onPrimary={next}
            left={
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Badge tone="success">{mappedCount}</Badge>
                  <span className="text-success">
                    {mappedCount} fields mapped
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Badge tone="danger">{unmappedCount}</Badge>
                  <span className="text-danger">
                    {unmappedCount} fields unmapped
                  </span>
                </span>
              </div>
            }
          />
        )}

        {step === 3 && (
          <WizardFooter
            onBack={back}
            primaryLabel="Start Import"
            primaryDisabled={validation?.status !== "done"}
            onPrimary={next}
            left={
              <p className="text-sm text-ink-muted">
                {validation?.status === "done" ? (
                  <>
                    <span className="font-medium text-ink">{validCount}</span>{" "}
                    valid record{validCount === 1 ? "" : "s"} ready to import
                    into{" "}
                    <span className="font-medium text-ink">
                      {pipeline || "Lead Pipeline"}
                    </span>
                  </>
                ) : (
                  "Validating records…"
                )}
              </p>
            }
          />
        )}
      </div>
    </div>
  );
}

function WizardFooter({
  onBack,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  left,
}: {
  onBack: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  left?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-hairline px-6 py-4">
      <div className="min-w-0">{left}</div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

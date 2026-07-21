import { cn } from "@/lib/cn";

export type Step = { label: string };

export type StepperProps = {
  steps: readonly Step[];
  /** Zero-based index of the active step; earlier steps render as completed. */
  current: number;
};

/**
 * A numbered horizontal stepper — the Workpex Import wizard header
 * (`leads-import-wizard-step1-upload-file.png`): a completed step is a green
 * circle with a green label, the active step is a blue circle with a blue label,
 * and upcoming steps are a hairline outline in muted ink. The connector between
 * two steps turns green once the left one is complete.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center">
      {steps.map((step, index) => {
        const isCompleted = index < current;
        const isActive = index === current;

        return (
          <li
            key={step.label}
            className={cn(
              "flex items-center",
              index < steps.length - 1 && "flex-1",
            )}
          >
            <div className="flex shrink-0 items-center gap-2">
              <span
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-medium",
                  isCompleted && "bg-brand text-white",
                  isActive && "bg-info text-white",
                  !isCompleted &&
                    !isActive &&
                    "border border-hairline bg-surface text-ink-subtle",
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  "text-base font-medium whitespace-nowrap",
                  isCompleted && "text-brand",
                  isActive && "text-info",
                  !isCompleted && !isActive && "text-ink-subtle",
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-3 h-px flex-1",
                  isCompleted ? "bg-brand" : "bg-hairline",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

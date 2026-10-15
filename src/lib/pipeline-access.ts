/**
 * What the lead controls say about pipeline rules (ADR-0093). The server enforces every one of
 * them; these keep a control from offering what it will refuse.
 *
 * Import-free, so its self-check (`pipeline-access.check.ts`) compiles with plain tsc.
 */

/** Why a pipeline control is off for a user who may not move leads (B5). */
export const MOVE_PIPELINE_HINT =
  "Only a manager or an administrator can move a lead to another pipeline.";

/**
 * Why Convert is off for a lead on `pipeline`, or null when it is not (B12). Convert sets the
 * lead's status to `convertedStatus`, and the server refuses that on a pipeline with no such
 * stage (400). `stages` is null while they load: Convert stays on, and the server decides.
 */
export function convertBlockReason(
  pipeline: string,
  stages: readonly { name: string }[] | null,
  convertedStatus: string,
): string | null {
  return stages && !stages.some((stage) => stage.name === convertedStatus)
    ? `The “${pipeline}” pipeline has no ${convertedStatus} stage, so its leads can’t be converted.`
    : null;
}

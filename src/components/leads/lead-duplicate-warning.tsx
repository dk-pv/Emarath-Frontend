"use client";

import { Alert } from "@/components/ui/Alert";
import type {
  DuplicateCheckMatch,
  DuplicateCheckResult,
} from "@/services/leads-service";

const MATCHED_ON: Record<DuplicateCheckMatch["matchedOn"], string> = {
  primaryPhone: "primary phone",
  secondaryPhone: "secondary phone",
  email: "email",
};

/**
 * The New Lead form's warning that the enquiry duplicates an existing lead (ADR-0092).
 *
 * It says so and nothing more: the lead can still be submitted and is created as its own
 * record, marked as a duplicate. There is no setting under which the save is refused (ADR-0092).
 *
 * A match the user cannot open is acknowledged without a name, id or status — the server
 * withholds them — so the warning can never be the way a restricted lead's details leak.
 * Opening a match goes to a new tab, so a half-filled form is never lost.
 */
export function LeadDuplicateWarning({
  result,
}: {
  result: DuplicateCheckResult | null;
}) {
  if (!result || result.matches.length === 0) return null;
  const visible = result.matches.filter((match) => match.id && match.name);
  // Matches the user cannot open are one line, however many there are: nothing distinguishes them.
  const hidden = result.matches.length - visible.length;

  return (
    <Alert tone="warning" title="Possible duplicate">
      <p>
        A lead with the same contact details already exists. You can still save
        — it will be created as a separate lead and marked as a duplicate.
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {visible.map((match) => (
          <li key={match.id}>
            <a
              href={`/leads/${match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-sm font-medium text-ink underline decoration-1 underline-offset-2 hover:text-brand-strong"
            >
              {match.name}
            </a>
            {match.status && <span> · {match.status}</span>}
            <span className="text-ink-subtle">
              {" "}
              · same {MATCHED_ON[match.matchedOn]}
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            {hidden === 1
              ? "A lead you don’t have access to"
              : `${hidden} leads you don’t have access to`}
          </li>
        )}
      </ul>
    </Alert>
  );
}

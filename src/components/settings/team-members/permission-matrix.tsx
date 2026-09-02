"use client";

import { IconBan } from "@tabler/icons-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import type { PermissionCatalogRow } from "@/services/users-service";
import { InfoHint } from "./wizard-fields";

export type MatrixState = Record<
  string,
  { canView: boolean; canAdd: boolean; canEdit: boolean }
>;

export const EMPTY_ROW = { canView: false, canAdd: false, canEdit: false };

type Capability = "canView" | "canAdd" | "canEdit";
const CAPABILITIES: { key: Capability; applicable: "view" | "add" | "edit" }[] =
  [
    { key: "canView", applicable: "view" },
    { key: "canAdd", applicable: "add" },
    { key: "canEdit", applicable: "edit" },
  ];

/** Every applicable flag on = the row's derived "All" state. */
function rowAll(row: PermissionCatalogRow, state: MatrixState): boolean {
  const current = state[row.module] ?? EMPTY_ROW;
  return CAPABILITIES.every((cap) => !row[cap.applicable] || current[cap.key]);
}

function rowAny(row: PermissionCatalogRow, state: MatrixState): boolean {
  const current = state[row.module] ?? EMPTY_ROW;
  return CAPABILITIES.some((cap) => row[cap.applicable] && current[cap.key]);
}

/**
 * The User Permissions matrix (wizard step 3), from the reference screenshots: module
 * rows against All / View / Add / Edit.
 *
 * "All" is derived, never stored: checked exactly when every applicable flag in the row
 * is on, indeterminate on a partial row; ticking it fills the row's applicable flags and
 * unticking clears them. A cell the catalogue marks inapplicable renders as the
 * reference's slashed grey square — disabled, unfocusable, and rejected server-side too,
 * so the greying is presentation over a real rule rather than the rule itself.
 */
export function PermissionMatrix({
  catalog,
  state,
  onChange,
}: {
  catalog: readonly PermissionCatalogRow[];
  state: MatrixState;
  onChange: (state: MatrixState) => void;
}) {
  const setRow = (
    module: string,
    next: { canView: boolean; canAdd: boolean; canEdit: boolean },
  ) => onChange({ ...state, [module]: next });

  return (
    <ResponsiveTableContainer label="User permissions">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline bg-canvas text-left">
            <th
              scope="col"
              className="px-4 py-3 text-[13px] font-medium whitespace-nowrap text-ink-muted"
            >
              User Permission
            </th>
            {["All", "View", "Add", "Edit"].map((head) => (
              <th
                key={head}
                scope="col"
                className="w-16 px-3 py-3 text-center text-[13px] font-medium text-ink-muted"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.map((row) => {
            const current = state[row.module] ?? EMPTY_ROW;
            const all = rowAll(row, state);
            const some = rowAny(row, state);

            return (
              <tr
                key={row.module}
                className="border-b border-hairline last:border-b-0"
              >
                <td className="px-4 py-3 whitespace-nowrap text-ink">
                  <span className="flex items-center gap-2">
                    {row.label}
                    {row.module === "SETTINGS" && (
                      <InfoHint label="Settings access is governed by the account's role today; this stored permission does not open Settings by itself." />
                    )}
                  </span>
                </td>

                <td className="px-3 py-3 text-center">
                  <Checkbox
                    aria-label={`All permissions for ${row.label}`}
                    checked={all}
                    indeterminate={!all && some}
                    onChange={() =>
                      setRow(row.module, {
                        canView: !all && row.view,
                        canAdd: !all && row.add,
                        canEdit: !all && row.edit,
                      })
                    }
                  />
                </td>

                {CAPABILITIES.map((cap) => {
                  const applicable = row[cap.applicable];
                  if (!applicable) {
                    return (
                      <td key={cap.key} className="px-3 py-3 text-center">
                        <span
                          aria-hidden="true"
                          className="inline-flex size-5 items-center justify-center rounded-check border border-hairline bg-canvas text-ink-subtle"
                        >
                          <IconBan size={13} stroke={1.75} />
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={cap.key} className="px-3 py-3 text-center">
                      <Checkbox
                        aria-label={`${cap.key.slice(3)} permission for ${row.label}`}
                        checked={current[cap.key]}
                        onChange={(event) =>
                          setRow(row.module, {
                            ...current,
                            [cap.key]: event.target.checked,
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ResponsiveTableContainer>
  );
}

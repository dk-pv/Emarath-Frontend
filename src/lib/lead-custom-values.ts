/**
 * The `customFields` a lead form submits (LEAD-05.1, ADR-0051).
 *
 * The API reads the key three ways: omitted leaves every stored value alone, a set
 * full-replaces the active fields' values, and `[]` clears them all. So a form that
 * never got its definitions — still loading, or the fetch failed — returns `undefined`
 * and the key is left out, never `[]`.
 *
 * Only the given (active) definitions are sent: a lead's value for an inactive field is
 * not one the API accepts, and the API keeps it. Blank values are dropped, which on an
 * edit clears that one field.
 */
export function customFieldsPayload(
  definitions: readonly { id: string; key: string }[] | undefined,
  values: Readonly<Record<string, string | undefined>>,
): { fieldId: string; value: string }[] | undefined {
  return definitions
    ?.map((field) => ({
      fieldId: field.id,
      value: (values[field.key] ?? "").trim(),
    }))
    .filter((entry) => entry.value !== "");
}

"use client";

import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

type Errors = { password?: string; confirm?: string };

/**
 * One password field with the visibility toggle, matching the login form's control
 * exactly — same Input, same eye/eye-off button, same hidden-by-default state — so
 * the two places a password is typed in this product look and behave alike.
 */
function PasswordField({
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField label={label} error={error} required>
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder={placeholder}
            className="pr-10"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={visible}
            className="focus-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-ink-subtle hover:text-ink"
          >
            {visible ? (
              <IconEyeOff className="size-5" aria-hidden="true" />
            ) : (
              <IconEye className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </FormField>
  );
}

/**
 * Update Password, from the avatar menu (`Update Password` in the supplied capture):
 * a right-side drawer with the two fields, a spacious body and a pinned
 * Cancel / Submit footer.
 *
 * **Submit is deliberately not wired, and does not pretend to be.** This product has
 * no self-service password endpoint: `PATCH /api/users/:id/password` is
 * `@Roles(SUPERADMIN)` on a controller documented as "permission grants can never be
 * self-service", and it revokes every session for the account — so an ordinary user
 * cannot call it and an admin who did would be signed out. The only other password
 * paths are the token-based forgot/reset flow (AUTH-03.1). Adding a "change my own
 * password" route is an authentication change with real security shape to decide
 * (does it re-verify the current password? does it keep the calling session alive?),
 * it is not in the approved backlog, and faking a success here would be worse than
 * an honest gap — so the drawer ships complete and the button stays disabled until
 * that endpoint is approved.
 */
export function UpdatePasswordDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const close = () => {
    setPassword("");
    setConfirm("");
    setErrors({});
    onClose();
  };

  /** The two rules the reference's required markers imply, and nothing invented beyond them. */
  const validate = (): boolean => {
    const next: Errors = {};
    if (!password) next.password = "Password is required.";
    if (!confirm) next.confirm = "Confirm Password is required.";
    else if (password && confirm !== password) {
      next.confirm = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Update Password"
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => validate()} disabled>
            Submit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <PasswordField
          label="Password"
          placeholder="Add Password"
          value={password}
          error={errors.password}
          onChange={(value) => {
            setPassword(value);
            if (errors.password) {
              setErrors((current) => ({ ...current, password: undefined }));
            }
          }}
        />

        <PasswordField
          label="Confirm Password"
          placeholder="Add Confirm Password"
          value={confirm}
          error={errors.confirm}
          onChange={(value) => {
            setConfirm(value);
            if (errors.confirm) {
              setErrors((current) => ({ ...current, confirm: undefined }));
            }
          }}
        />
      </div>
    </Drawer>
  );
}

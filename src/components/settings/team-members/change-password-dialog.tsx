"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import {
  setTeamMemberPassword,
  type TeamMember,
} from "@/services/users-service";

/**
 * The roster's Change Password action.
 *
 * The reference captures the lock icon in the Actions column but not the panel it opens, so
 * this is built from Emarath's own dialog rather than guessed at: a new password, a
 * confirmation, and a plain statement of the consequence.
 *
 * The current password is deliberately not asked for — an admin resetting someone else's
 * password does not know it. That is exactly why the server revokes every session of the
 * account afterwards, and why the action is SUPERADMIN-only.
 */
export function ChangePasswordDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  // Seeded at mount only; the parent keys this component per member, so opening it for a
  // different person remounts it empty rather than carrying a half-typed password over.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= 8 && confirm === password;

  const submit = async () => {
    if (!member || !valid) return;
    setBusy(true);
    setError(null);
    try {
      await setTeamMemberPassword(member.id, password);
      toast({ title: `Password changed for ${member.name}`, tone: "success" });
      setDone(true);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : "Could not change the password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title={done ? "Password changed" : "Change password"}
      footer={
        done ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={!valid}
              isLoading={busy}
            >
              Change password
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <p className="text-sm text-ink">
          {member?.name}&rsquo;s password has been changed. They have been
          signed out everywhere and must sign in again with the new password.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            Set a new password for{" "}
            <span className="font-medium text-ink">{member?.name}</span>. This
            signs them out of every device.
          </p>

          {error && <FormError>{error}</FormError>}

          <FormField
            label="New password"
            required
            htmlFor="cp-password"
            error={
              tooShort ? "Password must be at least 8 characters." : undefined
            }
          >
            <Input
              id="cp-password"
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder="Enter a new password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          <FormField
            label="Confirm password"
            required
            htmlFor="cp-confirm"
            error={mismatch ? "Passwords do not match." : undefined}
          >
            <Input
              id="cp-confirm"
              type="password"
              value={confirm}
              autoComplete="new-password"
              placeholder="Re-enter the new password"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </FormField>
        </div>
      )}
    </Modal>
  );
}

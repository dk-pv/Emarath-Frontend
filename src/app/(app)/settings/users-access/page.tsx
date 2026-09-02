import { redirect } from "next/navigation";

/** Users & Access has no landing screen of its own; it opens on its first item. */
export default function UsersAccessPage() {
  redirect("/settings/users-access/team-members");
}

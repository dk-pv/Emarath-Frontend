"use client";

import { useState } from "react";
import { IconCirclePlus } from "@tabler/icons-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadFollowUpFormDrawer } from "@/components/leads/lead-followup-form-drawer";

/**
 * The navbar's quick-add menu (`dashboard-quick-add-plus-menu-open.png`): a 169x86
 * panel under the + button offering New Lead and New Follow-up, and nothing else —
 * the capture lists exactly two rows, so exactly two are drawn (152x77 and 30px rows
 * at the product's density, ADR-0076).
 *
 * No pointer triangle: at the panel's centre column the capture runs from the green
 * button straight into the panel's top edge, with no notch above it. The menus in
 * this product's reference set are plain panels.
 *
 * **A launcher, no business logic.** Both rows open the form the product already
 * owns: `LeadFormDrawer` (the Leads list's own create drawer, so Form Customization,
 * validation, custom fields and the create API all come along) and
 * `LeadFollowUpFormDrawer`, whose `lead` prop is optional precisely so it can be
 * opened without one and search for the lead itself. Nothing about either form is
 * reimplemented here.
 */
export function QuickAddMenu({
  triggerClassName,
}: {
  triggerClassName: string;
}) {
  const { toast } = useToast();
  const [drawer, setDrawer] = useState<"lead" | "follow-up" | null>(null);

  return (
    <>
      <Dropdown
        // Centred on the + button, not edge-aligned: measured, the reference's panel
        // spans 1622..1791 and the button 1686..1727 — both centred on 1706.5.
        // `panelClassName` is applied last, so `left-1/2` displaces the default
        // `left-0` through tailwind-merge.
        align="start"
        // 169 x 86 at 1:1 → 152 wide with 30px rows here. The shared menu's default
        // is a 224px box with 41px rows, which this reference is visibly tighter than.
        panelClassName="left-1/2 min-w-[152px] -translate-x-1/2"
        itemClassName="px-4 py-[7px] text-sm"
        trigger={
          <span aria-label="Quick add" className={triggerClassName}>
            <IconCirclePlus size={21} stroke={1.75} />
          </span>
        }
        items={[
          {
            type: "item",
            id: "new-lead",
            label: "New Lead",
            onSelect: () => setDrawer("lead"),
          },
          {
            type: "item",
            id: "new-follow-up",
            label: "New Follow-up",
            onSelect: () => setDrawer("follow-up"),
          },
        ]}
      />

      {/* Mounted outside the menu so the panel closing does not unmount the drawer. */}
      {drawer === "lead" && (
        <LeadFormDrawer
          open
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            toast({ title: "Lead created", tone: "success" });
          }}
        />
      )}

      {drawer === "follow-up" && (
        <LeadFollowUpFormDrawer
          onClose={() => setDrawer(null)}
          onCreated={() => {
            setDrawer(null);
            toast({ title: "Follow-up created", tone: "success" });
          }}
        />
      )}
    </>
  );
}

import {
  DemoMetrics,
  DemoTableView,
} from "@/components/dashboard/demo-table-view";

export const metadata = { title: "Layout demo - Emarath" };

/**
 * Verifies the shared layout system end to end by composing it exactly as a real list
 * module would. Not linked from the navigation and not a backlog feature.
 */
export default function LayoutDemoPage() {
  return (
    <>
      <div className="px-4 pt-4 lg:px-6 lg:pt-6">
        <DemoMetrics />
      </div>
      <DemoTableView />
    </>
  );
}

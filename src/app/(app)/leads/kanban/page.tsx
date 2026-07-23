import { routeMetadata } from "@/lib/route-metadata";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export const metadata = routeMetadata("/leads/kanban");

/** The Kanban board (KAN-02.2): one colour-coded column per pipeline stage. */
export default function KanbanBoardPage() {
  return <KanbanBoard />;
}

import { DocumentsView } from "@/components/documents/documents-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/documents");

export default function DocumentsPage() {
  return <DocumentsView />;
}

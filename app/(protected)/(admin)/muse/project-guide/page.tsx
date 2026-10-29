import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { MuseProjectGuidePreview } from "@/components/muse/MuseProjectGuidePreview";
import "@/app/muse-project-guide.css";

export const dynamic = "force-dynamic";

export default async function MuseProjectGuidePage() {
  // Admin access is enforced at both this page and its parent admin layout.
  await requireAdmin();
  return (
    <main className="content-wrap studio-page">
      <div style={{ marginBottom: 10 }}>
        <Link href="/muse" className="management-text-link">← Back to Muse</Link>
      </div>
      <MuseProjectGuidePreview />
    </main>
  );
}

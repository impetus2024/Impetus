import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { coachBatchFilter } from "@/lib/coach/batch-access";
import { ListFilter } from "@/components/list-filter";
import { CoachAttendanceCalendar } from "@/components/coach-attendance/coach-attendance-calendar";

export default async function CoachAttendanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ coachId: string }>;
  searchParams: Promise<{ batchId?: string; month?: string; date?: string }>;
}) {
  const { coachId } = await params;
  const { batchId: batchIdParam, month, date } = await searchParams;
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const supabase = await createClient();

  const [{ data: coach }, { data: batches }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", coachId)
      .eq("centre_id", centreAdmin.centre_id!)
      .eq("role", "coach")
      .maybeSingle(),
    supabase
      .from("batches")
      .select("id, name")
      .eq("centre_id", centreAdmin.centre_id!)
      .or(coachBatchFilter(coachId))
      .eq("is_active", true)
      .order("name"),
  ]);

  if (!coach) notFound();

  const coachBatches = batches ?? [];
  const batchId = coachBatches.some((b) => b.id === batchIdParam) ? batchIdParam! : "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{coach.full_name}</h1>
        <p className="text-sm text-muted-foreground">Coach Attendance</p>
      </div>

      <ListFilter
        paramKey="batchId"
        label="All Batches"
        options={coachBatches.map((b) => ({ id: b.id, name: b.name }))}
      />

      <CoachAttendanceCalendar
        batches={coachBatches}
        batchId={batchId}
        month={month}
        selectedDate={date}
        basePath={`/centre-admin/coach-attendance/${coachId}?batchId=${batchId}`}
      />
    </div>
  );
}

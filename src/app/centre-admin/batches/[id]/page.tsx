import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/dal";
import { calculateAge } from "@/lib/age";
import { resolveDocumentLink } from "@/lib/storage/resolve-document-links";
import { documentUrl } from "@/lib/storage/document-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function PersonAvatar({ name, url }: { name: string; url?: string }) {
  return (
    <Avatar>
      <AvatarImage src={url} />
      <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export default async function CentreAdminBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const centreAdmin = await requireRole("centre_admin", "staff", "finance");
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select(
      "id, name, head_coach_id, assistant_coach_id, start_time, end_time, profiles!batches_head_coach_id_fkey(full_name), assistant_coach:profiles!batches_assistant_coach_id_fkey(full_name), player_types(name), age_categories(name)"
    )
    .eq("id", id)
    .eq("centre_id", centreAdmin.centre_id!)
    .maybeSingle();

  if (!batch) notFound();

  const coachIds = [batch.head_coach_id, batch.assistant_coach_id].filter((c): c is string => !!c);

  const [{ data: players }, { data: coachStaff }] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, date_of_birth, gender, parent_contact_number, profile_picture_path, player_batches!inner(batch_id)")
      .eq("player_batches.batch_id", id)
      .eq("is_active", true)
      .order("name"),
    coachIds.length
      ? supabase.from("staff_profiles").select("profile_id, profile_picture_path").in("profile_id", coachIds)
      : Promise.resolve({ data: [] }),
  ]);

  const coachPhotoKey = new Map((coachStaff ?? []).map((s) => [s.profile_id, s.profile_picture_path]));
  const resolveCoachPhoto = async (coachId: string | null) =>
    coachId ? documentUrl(await resolveDocumentLink("profilePicture", coachPhotoKey.get(coachId))) : undefined;

  const [headPhoto, assistantPhoto] = await Promise.all([
    resolveCoachPhoto(batch.head_coach_id),
    resolveCoachPhoto(batch.assistant_coach_id),
  ]);
  const playerPhotos = await Promise.all(
    (players ?? []).map(async (p) => documentUrl(await resolveDocumentLink("profilePicture", p.profile_picture_path)))
  );

  const coaches = [
    { label: "Head Coach", id: batch.head_coach_id, name: batch.profiles?.full_name, photo: headPhoto },
    { label: "Assistant Coach", id: batch.assistant_coach_id, name: batch.assistant_coach?.full_name, photo: assistantPhoto },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{batch.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[batch.player_types?.name, batch.age_categories?.name, `${batch.start_time} – ${batch.end_time}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {coaches.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-lg border p-4">
            <PersonAvatar name={c.name ?? "—"} url={c.photo} />
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              {c.id && c.name ? (
                <Link href={`/centre-admin/administrators/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
              ) : (
                <p className="font-medium">—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold">Students ({players?.length ?? 0})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Parent Contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players?.map((p, i) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/centre-admin/players/${p.id}`} className="flex items-center gap-3 hover:underline">
                  <PersonAvatar name={p.name} url={playerPhotos[i]} />
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>{calculateAge(p.date_of_birth)}</TableCell>
              <TableCell>{p.gender ?? "—"}</TableCell>
              <TableCell>{p.parent_contact_number ?? "—"}</TableCell>
            </TableRow>
          ))}
          {players?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState icon={Users} title="No players in this batch yet" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

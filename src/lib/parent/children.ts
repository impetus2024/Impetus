import { createClient } from "@/lib/supabase/server";

export async function getParentChildren(parentId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("parent_player_links")
    .select("players(id, name)")
    .eq("parent_id", parentId);

  return (data ?? [])
    .map((row) => row.players)
    .filter((p): p is { id: string; name: string } => p !== null);
}

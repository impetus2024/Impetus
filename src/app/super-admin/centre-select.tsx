"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabel } from "@/lib/utils";

// Navigates within whatever super-admin page it's rendered on (not hardcoded
// to /super-admin) and preserves every other URL param already set — same
// convention as ListSearch/ListFilter/ListPagination — so switching centres
// on, e.g., the email analytics page doesn't reset its date range or search.
export function CentreSelect({
  centres,
  selectedId,
}: {
  centres: { id: string; name: string }[];
  selectedId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={selectedId}
      onValueChange={(id) => {
        if (!id) return;
        const params = new URLSearchParams(searchParams);
        params.set("centreId", id);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select centre">
          {selectLabel(centres, "Select centre")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {centres.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabel } from "@/lib/utils";

export function CentreSelect({
  centres,
  selectedId,
}: {
  centres: { id: string; name: string }[];
  selectedId?: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedId}
      onValueChange={(id) => {
        if (id) router.push(`/super-admin?centreId=${id}`);
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

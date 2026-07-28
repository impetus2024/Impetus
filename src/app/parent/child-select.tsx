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

export function ChildSelect({
  options,
  selectedId,
  basePath,
}: {
  options: { id: string; name: string }[];
  selectedId?: string;
  basePath: string;
}) {
  const router = useRouter();

  if (options.length <= 1) return null;

  return (
    <Select
      value={selectedId}
      onValueChange={(id) => {
        if (id) router.push(`${basePath}?playerId=${id}`);
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select child">
          {selectLabel(options, "Select child")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

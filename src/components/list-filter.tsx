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

const ALL = "__all__";

// Dropdown filter synced to a URL param, preserving every other param
// already on the URL (search text, other filters).
export function ListFilter({
  paramKey,
  label,
  options,
}: {
  paramKey: string;
  label: string;
  options: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? ALL;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const allOption = { id: ALL, name: label };

  return (
    <Select value={current} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger className="h-9 w-full rounded-full sm:w-44">
        <SelectValue placeholder={label}>
          {selectLabel([allOption, ...options], label)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

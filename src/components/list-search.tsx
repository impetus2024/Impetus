"use client";

import { Search } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

// Debounced search box that syncs to the `q` URL param, preserving every
// other param (filters, pagination) already on the URL. Server components
// read searchParams.q directly — no client-side list state to keep in sync.
export function ListSearch({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlValue);
  // Adjust local state during render (not an effect) when the URL changes
  // out from under us — browser back/forward, or another control clearing
  // the query string. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [trackedUrlValue, setTrackedUrlValue] = useState(urlValue);
  if (urlValue !== trackedUrlValue) {
    setTrackedUrlValue(urlValue);
    setValue(urlValue);
  }

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
  }

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-full bg-muted/60 pl-9"
      />
    </div>
  );
}

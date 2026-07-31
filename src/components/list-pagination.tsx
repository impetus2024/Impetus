"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// Same URL-param-preserving convention as ListSearch/ListFilter — writes
// `page`, keeps every other param (search text, filters) already on the
// URL. Server components read searchParams.page directly, same as they
// already do for q/status/etc.
export function ListPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams);
    if (target <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(target));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

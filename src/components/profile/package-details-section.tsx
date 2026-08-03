import { Package2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ViewField } from "@/components/view-field";

// There's no dedicated "package assigned" timestamp in the schema — the
// player's own created_at is used as the package date, since that's when
// the assignment was made (see players/[id]/page.tsx, the only caller).
export function PackageDetailsSection({
  packageName,
  price,
  isCustom,
  customAmount,
  discount,
  assignedAt,
}: {
  packageName: string | null;
  price: number | null;
  isCustom: boolean;
  customAmount: number | null;
  discount: number | null;
  assignedAt: string;
}) {
  if (!packageName) {
    return <EmptyState icon={Package2} title="No package assigned" />;
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <ViewField label="Package Date" value={new Date(assignedAt).toLocaleDateString()} />
      <ViewField label={isCustom ? "Custom Package Name" : "Package Name"} value={packageName} />
      {isCustom ? (
        <>
          <ViewField label="Amount" value={customAmount} />
          <ViewField label="Discount" value={discount ?? 0} />
          <ViewField label="Total Amount" value={price} />
        </>
      ) : (
        <ViewField label="Package Cost" value={price} />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FILLED_INPUT } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type PackageOption = { id: string; name: string; price: number; playerTypeId: string | null };

export const CUSTOM_PACKAGE_VALUE = "custom";

// Package select shared by the Add Player and Edit Player forms. "Custom"
// always sits first (with a divider before the real packages) so it reads
// as a distinct choice, not just another package. Real packages are scoped
// to the selected Program Type -- a package with no player_type_id is
// treated as generic and shown regardless -- and show their price inline
// so the price is visible while choosing, not just after. Picking "Custom"
// reveals a small inline form (name/amount/discount) instead; the server
// turns that into a real (but hidden-from-pickers) packages row, so
// everything downstream that reads players.package_id keeps working
// unchanged. Total Price here is just a live preview -- the server always
// recomputes amount - discount itself rather than trusting a client total.
export function PackageField({
  packages,
  selectedPlayerTypeId,
  defaultPackageId,
  defaultCustomName,
  defaultCustomAmount,
  defaultCustomDiscount,
}: {
  packages: PackageOption[];
  selectedPlayerTypeId: string | null;
  defaultPackageId?: string | null;
  defaultCustomName?: string | null;
  defaultCustomAmount?: number | null;
  defaultCustomDiscount?: number | null;
}) {
  const [packageId, setPackageId] = useState(defaultPackageId ?? "");
  const [amount, setAmount] = useState(
    defaultCustomAmount != null ? String(defaultCustomAmount) : ""
  );
  const [discount, setDiscount] = useState(
    defaultCustomDiscount != null ? String(defaultCustomDiscount) : ""
  );
  const isCustom = packageId === CUSTOM_PACKAGE_VALUE;

  const filteredPackages = packages.filter(
    (p) => p.playerTypeId === null || p.playerTypeId === selectedPlayerTypeId
  );

  // If the Program Type changes and the currently selected real package no
  // longer applies to it, clear the selection rather than silently keep an
  // invalid combination selected under the hood. Adjusted during render
  // (not an effect) per https://react.dev/learn/you-might-not-need-an-effect
  // — same pattern already used in player-profile-form.tsx.
  const [prevPlayerTypeId, setPrevPlayerTypeId] = useState(selectedPlayerTypeId);
  if (selectedPlayerTypeId !== prevPlayerTypeId) {
    setPrevPlayerTypeId(selectedPlayerTypeId);
    if (packageId && packageId !== CUSTOM_PACKAGE_VALUE && !filteredPackages.some((p) => p.id === packageId)) {
      setPackageId("");
    }
  }

  const packageLabel = (value: string) => {
    if (value === CUSTOM_PACKAGE_VALUE) return "Custom";
    const p = packages.find((o) => o.id === value);
    return p ? `${p.name} — ${p.price}` : "Select package";
  };

  const total = amount !== "" ? Math.max(0, (Number(amount) || 0) - (Number(discount) || 0)) : null;

  return (
    <>
      <Field>
        <FieldLabel htmlFor="packageId">
          Package <span className="text-destructive">*</span>
        </FieldLabel>
        <Select
          name="packageId"
          value={packageId}
          onValueChange={(v) => setPackageId(v as string)}
          required
        >
          <SelectTrigger id="packageId" className={cn("w-full", FILLED_INPUT)}>
            <SelectValue placeholder="Select package">{packageLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM_PACKAGE_VALUE}>Custom</SelectItem>
            <SelectSeparator />
            {filteredPackages.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name} — {o.price}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isCustom && (
        <>
          <Field>
            <FieldLabel htmlFor="customPackageName">
              Custom Package Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="customPackageName"
              name="customPackageName"
              defaultValue={defaultCustomName ?? ""}
              className={FILLED_INPUT}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="customAmount">
              Amount <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="customAmount"
              name="customAmount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={FILLED_INPUT}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="customDiscount">Discount</FieldLabel>
            <Input
              id="customDiscount"
              name="customDiscount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className={FILLED_INPUT}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="totalPrice">Total Price</FieldLabel>
            <Input
              id="totalPrice"
              readOnly
              disabled
              value={total === null ? "" : total.toFixed(2)}
              className={FILLED_INPUT}
            />
          </Field>
        </>
      )}
    </>
  );
}

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "@/components/ui/field";

// Shared Super-Admin-only "Target Centres" picker for the Monthly
// Highlights and News & Events create dialogs — a Centre Admin never
// renders this (the caller only mounts it when it has a `centres` list to
// show); createMonthlyHighlight/createNewsEvent resolve a Centre Admin's
// own centre_id from the session instead (see
// src/lib/publishable-content/centres.ts).
export function CentreCheckboxesFieldset({
  centres,
}: {
  centres: { id: string; name: string }[];
}) {
  return (
    <>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend variant="label">Target Centres</FieldLegend>
        <FieldGroup>
          {centres.map((centre) => (
            <Field key={centre.id} orientation="horizontal">
              <Checkbox id={`centre-${centre.id}`} name="centreIds" value={centre.id} />
              <FieldLabel htmlFor={`centre-${centre.id}`} className="font-normal">
                {centre.name}
              </FieldLabel>
            </Field>
          ))}
        </FieldGroup>
        {centres.length === 0 && (
          <FieldDescription>No centres yet — create one first.</FieldDescription>
        )}
      </FieldSet>
    </>
  );
}

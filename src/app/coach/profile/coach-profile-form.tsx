"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Field, FieldLabel, FieldGroup, FieldDescription, FILLED_INPUT } from "@/components/ui/field";
import { AdministratorProfileView } from "@/components/profile/administrator-profile-view";
import { updateOwnCoachProfile, type CoachProfileState } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];

type AddressColumn = "address_line1" | "address_line2" | "country" | "state" | "city" | "pincode";

const TEXT_FIELDS: { name: string; label: string; column: AddressColumn }[] = [
  { name: "addressLine1", label: "Address Line 1", column: "address_line1" },
  { name: "addressLine2", label: "Address Line 2", column: "address_line2" },
  { name: "country", label: "Country", column: "country" },
  { name: "state", label: "State", column: "state" },
  { name: "city", label: "City", column: "city" },
  { name: "pincode", label: "Pincode", column: "pincode" },
];

// Same view/edit toggle as the Centre Admin's AdministratorDetailForm, limited
// to the details a coach may change about themselves.
export function CoachProfileForm({
  fullName,
  staffProfile,
  documentUrls,
}: {
  fullName: string;
  staffProfile: StaffProfile | null;
  documentUrls: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<CoachProfileState, FormData>(
    updateOwnCoachProfile,
    undefined
  );
  const [isEditing, setIsEditing] = useState(false);

  // Return to view mode once a save completes successfully (adjusted during
  // render, same pattern as AdministratorDetailForm).
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (prevPending && !pending && !state?.error) {
      setIsEditing(false);
    }
  }

  if (!isEditing) {
    return (
      <Card className="w-full">
        <CardContent className="space-y-8">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
          <AdministratorProfileView
            values={{
              name: fullName,
              dateOfBirth: staffProfile?.date_of_birth ?? null,
              contactNumber: staffProfile?.contact_number ?? null,
              dateOfJoining: staffProfile?.date_of_joining ?? null,
              addressLine1: staffProfile?.address_line1 ?? null,
              addressLine2: staffProfile?.address_line2 ?? null,
              country: staffProfile?.country ?? null,
              state: staffProfile?.state ?? null,
              city: staffProfile?.city ?? null,
              pincode: staffProfile?.pincode ?? null,
            }}
            documentLinks={documentUrls}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-8">
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>

        <form action={action} className="space-y-8">
          <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={fullName} className={FILLED_INPUT} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="contactNumber">Contact Number</FieldLabel>
              <Input
                id="contactNumber"
                name="contactNumber"
                type="tel"
                defaultValue={staffProfile?.contact_number ?? ""}
                className={FILLED_INPUT}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={staffProfile?.date_of_birth ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            {TEXT_FIELDS.map((f) => (
              <Field key={f.name}>
                <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
                <Input
                  id={f.name}
                  name={f.name}
                  defaultValue={staffProfile?.[f.column] ?? ""}
                  className={FILLED_INPUT}
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="profilePicture">Profile Picture</FieldLabel>
              <FileInput id="profilePicture" name="profilePicture" accept="image/*" />
              {documentUrls.profilePicture && (
                <FieldDescription>
                  <a href={documentUrls.profilePicture} target="_blank" rel="noreferrer" className="underline">
                    View current file
                  </a>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>

          {state?.error && (
            <FieldDescription className="text-destructive">{state.error}</FieldDescription>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

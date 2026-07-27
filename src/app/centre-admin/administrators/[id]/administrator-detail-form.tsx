"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { updateAdministrator, setAdministratorActive } from "../actions";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];

export function AdministratorDetailForm({
  profileId,
  fullName,
  isActive,
  staffProfile,
  documentUrls,
}: {
  profileId: string;
  fullName: string;
  isActive: boolean;
  staffProfile: StaffProfile | null;
  documentUrls: Record<string, string>;
}) {
  const updateWithId = updateAdministrator.bind(null, profileId);
  const [state, action, pending] = useActionState(updateWithId, undefined);
  const [togglePending, startToggle] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Enabled" : "Disabled"}
        </Badge>
        <Button
          variant={isActive ? "destructive" : "default"}
          size="sm"
          disabled={togglePending}
          onClick={() =>
            startToggle(() => setAdministratorActive(profileId, !isActive))
          }
        >
          {isActive ? "Disable" : "Enable"}
        </Button>
      </div>

      <form action={action}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" defaultValue={fullName} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={staffProfile?.date_of_birth ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactNumber">Contact Number</FieldLabel>
            <Input
              id="contactNumber"
              name="contactNumber"
              defaultValue={staffProfile?.contact_number ?? ""}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel>
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={staffProfile?.address_line1 ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={staffProfile?.address_line2 ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <Input
              id="country"
              name="country"
              defaultValue={staffProfile?.country ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="state">State</FieldLabel>
            <Input
              id="state"
              name="state"
              defaultValue={staffProfile?.state ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <Input
              id="city"
              name="city"
              defaultValue={staffProfile?.city ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
            <Input
              id="pincode"
              name="pincode"
              defaultValue={staffProfile?.pincode ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dateOfJoining">Date of Joining</FieldLabel>
            <Input
              id="dateOfJoining"
              name="dateOfJoining"
              type="date"
              defaultValue={staffProfile?.date_of_joining ?? ""}
            />
          </Field>

          {Object.keys(documentUrls).length > 0 && (
            <Field>
              <FieldLabel>Documents</FieldLabel>
              <div className="flex flex-col gap-1">
                {Object.entries(documentUrls).map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </Field>
          )}

          {state?.error && (
            <FieldDescription className="text-destructive">
              {state.error}
            </FieldDescription>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

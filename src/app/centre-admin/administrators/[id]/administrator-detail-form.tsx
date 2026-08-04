"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { Field, FieldLabel, FieldGroup, FieldDescription, FILLED_INPUT } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdministratorProfileView } from "@/components/profile/administrator-profile-view";
import { updateAdministrator, setAdministratorActive } from "../actions";
import type { Database } from "@/lib/supabase/database.types";

type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];

const ROLE_LABEL: Record<string, string> = {
  centre_admin: "Centre Admin",
  coach: "Coach",
  medical: "Medical",
  staff: "Staff",
  finance: "Finance",
};

export function AdministratorDetailForm({
  profileId,
  fullName,
  role,
  isActive,
  isSelf,
  canEdit,
  staffProfile,
  documentUrls,
}: {
  profileId: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isSelf: boolean;
  canEdit: boolean;
  staffProfile: StaffProfile | null;
  documentUrls: Record<string, string>;
}) {
  const updateWithId = updateAdministrator.bind(null, profileId);
  const [state, action, pending] = useActionState(updateWithId, undefined);
  const [togglePending, startToggle] = useTransition();
  const [isEditing, setIsEditing] = useState(false);

  // Return to view mode once a save completes successfully. Adjusted during
  // render (not an effect) — same pattern as PlayerProfileForm, see its
  // comment for why (https://react.dev/learn/you-might-not-need-an-effect).
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (prevPending && !pending && !state?.error) {
      setIsEditing(false);
    }
  }

  const enableToggle = !isSelf && canEdit && (
    <Button
      variant={isActive ? "destructive" : "default"}
      size="sm"
      disabled={togglePending}
      onClick={() => startToggle(() => setAdministratorActive(profileId, !isActive))}
    >
      {isActive ? "Disable" : "Enable"}
    </Button>
  );

  if (!isEditing) {
    return (
      <Card className="w-full">
        <CardContent className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Enabled" : "Disabled"}
              </Badge>
              {enableToggle}
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Enabled" : "Disabled"}
            </Badge>
            {enableToggle}
          </div>
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
              <FieldLabel htmlFor="role">Role</FieldLabel>
              {isSelf ? (
                <>
                  <Input value={ROLE_LABEL[role] ?? role} className={FILLED_INPUT} disabled />
                  <input type="hidden" name="role" value={role} />
                  <FieldDescription>You can&apos;t change your own role.</FieldDescription>
                </>
              ) : (
                <Select name="role" defaultValue={role} required>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="Select role">
                      {(value: string) => ROLE_LABEL[value] ?? value}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centre_admin">Centre Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
            <Field>
              <FieldLabel htmlFor="contactNumber">Contact Number</FieldLabel>
              <Input
                id="contactNumber"
                name="contactNumber"
                defaultValue={staffProfile?.contact_number ?? ""}
                className={FILLED_INPUT}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dateOfJoining">Date of Joining</FieldLabel>
              <Input
                id="dateOfJoining"
                name="dateOfJoining"
                type="date"
                defaultValue={staffProfile?.date_of_joining ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel>
              <Input
                id="addressLine1"
                name="addressLine1"
                defaultValue={staffProfile?.address_line1 ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
              <Input
                id="addressLine2"
                name="addressLine2"
                defaultValue={staffProfile?.address_line2 ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="country">Country</FieldLabel>
              <Input
                id="country"
                name="country"
                defaultValue={staffProfile?.country ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="state">State</FieldLabel>
              <Input
                id="state"
                name="state"
                defaultValue={staffProfile?.state ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="city">City</FieldLabel>
              <Input
                id="city"
                name="city"
                defaultValue={staffProfile?.city ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
              <Input
                id="pincode"
                name="pincode"
                defaultValue={staffProfile?.pincode ?? ""}
                className={FILLED_INPUT}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="aadhaarCard">Aadhaar Card</FieldLabel>
              <FileInput id="aadhaarCard" name="aadhaarCard" />
              {documentUrls.aadhaar && (
                <FieldDescription>
                  <a href={documentUrls.aadhaar} target="_blank" rel="noreferrer" className="underline">
                    View current file
                  </a>
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="birthCertificate">Birth Certificate</FieldLabel>
              <FileInput id="birthCertificate" name="birthCertificate" />
              {documentUrls.birthCertificate && (
                <FieldDescription>
                  <a href={documentUrls.birthCertificate} target="_blank" rel="noreferrer" className="underline">
                    View current file
                  </a>
                </FieldDescription>
              )}
            </Field>
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
            <Field>
              <FieldLabel htmlFor="otherDocuments">Other Documents</FieldLabel>
              <FileInput id="otherDocuments" name="otherDocuments" />
              {documentUrls.otherDocuments && (
                <FieldDescription>
                  <a href={documentUrls.otherDocuments} target="_blank" rel="noreferrer" className="underline">
                    View current file
                  </a>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>

          {state?.error && (
            <FieldDescription className="text-destructive">
              {state.error}
            </FieldDescription>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

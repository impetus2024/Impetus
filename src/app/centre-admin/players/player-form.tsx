"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "@/components/ui/field";
import { selectLabel } from "@/lib/utils";
import type { PlayerFormState } from "./actions";

type Option = { id: string; name: string };

export type PlayerDefaultValues = {
  name: string;
  dateOfBirth: string;
  ageCategoryId: string | null;
  email: string | null;
  contactNumber: string | null;
  playerTypeId: string | null;
  packageId: string | null;
  batchId: string | null;
  gender: string | null;
  bloodGroup: string | null;
  heightCm: number | null;
  weightKg: number | null;
  birthMark: string | null;
  medicalCondition: string | null;
  foodAllergy: string | null;
  aiffNumber: string | null;
  fatherName: string | null;
  motherName: string | null;
  parentEmail: string;
  parentContactNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
};

export function PlayerForm({
  action,
  ageCategories,
  playerTypes,
  packages,
  batches,
  defaultValues,
  parentEmailEditable = true,
  documentLinks,
  submitLabel = "Submit",
}: {
  action: (prev: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  ageCategories: Option[];
  playerTypes: Option[];
  packages: Option[];
  batches: Option[];
  defaultValues?: PlayerDefaultValues;
  parentEmailEditable?: boolean;
  documentLinks?: Record<string, string>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <FieldSet>
        <FieldLegend>Player Information</FieldLegend>
        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={defaultValues?.dateOfBirth}
              required
            />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="ageCategoryId">Age Category</FieldLabel>
            <Select name="ageCategoryId" defaultValue={defaultValues?.ageCategoryId ?? undefined}>
              <SelectTrigger id="ageCategoryId" className="w-full">
                <SelectValue placeholder="Select age category">
                  {selectLabel(ageCategories, "Select age category")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ageCategories.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="email">Player Email ID</FieldLabel>
            <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="contactNumber">Player Contact Number</FieldLabel>
            <Input id="contactNumber" name="contactNumber" defaultValue={defaultValues?.contactNumber ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="playerTypeId">Program Type</FieldLabel>
            <Select name="playerTypeId" defaultValue={defaultValues?.playerTypeId ?? undefined}>
              <SelectTrigger id="playerTypeId" className="w-full">
                <SelectValue placeholder="Select program type">
                  {selectLabel(playerTypes, "Select program type")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {playerTypes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="packageId">Package</FieldLabel>
            <Select name="packageId" defaultValue={defaultValues?.packageId ?? undefined}>
              <SelectTrigger id="packageId" className="w-full">
                <SelectValue placeholder="Select package">
                  {selectLabel(packages, "Select package")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {packages.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="batchId">Batch Allotment</FieldLabel>
            <Select name="batchId" defaultValue={defaultValues?.batchId ?? undefined}>
              <SelectTrigger id="batchId" className="w-full">
                <SelectValue placeholder="Select batch">
                  {selectLabel(batches, "Select batch")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {batches.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="gender">Gender</FieldLabel>
            <Input id="gender" name="gender" defaultValue={defaultValues?.gender ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="bloodGroup">Blood Group</FieldLabel>
            <Input id="bloodGroup" name="bloodGroup" defaultValue={defaultValues?.bloodGroup ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="heightCm">Height (cm)</FieldLabel>
            <Input id="heightCm" name="heightCm" type="number" step="0.1" defaultValue={defaultValues?.heightCm ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
            <Input id="weightKg" name="weightKg" type="number" step="0.1" defaultValue={defaultValues?.weightKg ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="birthMark">Birth Mark</FieldLabel>
            <Input id="birthMark" name="birthMark" defaultValue={defaultValues?.birthMark ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="medicalCondition">Medical Condition</FieldLabel>
            <Textarea id="medicalCondition" name="medicalCondition" defaultValue={defaultValues?.medicalCondition ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="foodAllergy">Food Allergy</FieldLabel>
            <Textarea id="foodAllergy" name="foodAllergy" defaultValue={defaultValues?.foodAllergy ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="aiffNumber">AIFF Number</FieldLabel>
            <Input id="aiffNumber" name="aiffNumber" defaultValue={defaultValues?.aiffNumber ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
            <Input id="passportNumber" name="passportNumber" placeholder={documentLinks ? "Leave blank to keep existing" : undefined} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="aadhaarNumber">Aadhaar Number</FieldLabel>
            <Input id="aadhaarNumber" name="aadhaarNumber" placeholder={documentLinks ? "Leave blank to keep existing" : undefined} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="aadhaarDoc">Upload Aadhaar</FieldLabel>
            <Input id="aadhaarDoc" name="aadhaarDoc" type="file" />
            {documentLinks?.aadhaar && (
              <FieldDescription>
                <a href={documentLinks.aadhaar} target="_blank" rel="noreferrer" className="underline">
                  View current file
                </a>
              </FieldDescription>
            )}
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="medicalRecords">Upload Medical Records</FieldLabel>
            <Input id="medicalRecords" name="medicalRecords" type="file" />
            {documentLinks?.medicalRecords && (
              <FieldDescription>
                <a href={documentLinks.medicalRecords} target="_blank" rel="noreferrer" className="underline">
                  View current file
                </a>
              </FieldDescription>
            )}
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="profilePicture">Upload Profile Picture</FieldLabel>
            <Input id="profilePicture" name="profilePicture" type="file" accept="image/*" />
            {documentLinks?.profilePicture && (
              <FieldDescription>
                <a href={documentLinks.profilePicture} target="_blank" rel="noreferrer" className="underline">
                  View current file
                </a>
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Parent / Guardian Information</FieldLegend>
        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel htmlFor="fatherName">Father Name / Guardian Name</FieldLabel>
            <Input id="fatherName" name="fatherName" defaultValue={defaultValues?.fatherName ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="motherName">Mother Name</FieldLabel>
            <Input id="motherName" name="motherName" defaultValue={defaultValues?.motherName ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="parentEmail">Parent / Guardian Email ID</FieldLabel>
            <Input
              id="parentEmail"
              name="parentEmail"
              type="email"
              defaultValue={defaultValues?.parentEmail}
              readOnly={!parentEmailEditable}
              required
            />
            {!parentEmailEditable && (
              <FieldDescription>
                This is the parent&apos;s login — create a new player record to change it.
              </FieldDescription>
            )}
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="parentContactNumber">Parent / Guardian Contact Number</FieldLabel>
            <Input id="parentContactNumber" name="parentContactNumber" defaultValue={defaultValues?.parentContactNumber ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel>
            <Input id="addressLine1" name="addressLine1" defaultValue={defaultValues?.addressLine1 ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
            <Input id="addressLine2" name="addressLine2" defaultValue={defaultValues?.addressLine2 ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <Input id="country" name="country" defaultValue={defaultValues?.country ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="state">State</FieldLabel>
            <Input id="state" name="state" defaultValue={defaultValues?.state ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="city">City</FieldLabel>
            <Input id="city" name="city" defaultValue={defaultValues?.city ?? ""} />
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
            <Input id="pincode" name="pincode" defaultValue={defaultValues?.pincode ?? ""} />
          </Field>
        </FieldGroup>
      </FieldSet>

      {state?.error && (
        <FieldDescription className="text-destructive">{state.error}</FieldDescription>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

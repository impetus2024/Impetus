"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup, FieldDescription, FILLED_INPUT } from "@/components/ui/field";
import { PlayerProfileView, type PlayerProfileViewValues } from "@/components/profile/player-profile-view";
import { selectLabel, cn } from "@/lib/utils";
import { PackageField, CUSTOM_PACKAGE_VALUE, type PackageOption } from "../package-field";
import type { PlayerFormState } from "../actions";

type Option = { id: string; name: string };

export type PlayerProfileDefaultValues = PlayerProfileViewValues;

export function PlayerProfileForm({
  action,
  ageCategories,
  playerTypes,
  packages,
  batches,
  defaultValues,
  documentLinks,
  currentPackageIsCustom,
  customPackageName,
  customAmount,
  customDiscount,
  canEdit = true,
}: {
  action: (prev: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  ageCategories: Option[];
  playerTypes: Option[];
  packages: PackageOption[];
  batches: Option[];
  defaultValues: PlayerProfileDefaultValues;
  documentLinks?: Record<string, string>;
  currentPackageIsCustom?: boolean;
  customPackageName?: string | null;
  customAmount?: number | null;
  customDiscount?: number | null;
  canEdit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [playerTypeId, setPlayerTypeId] = useState(defaultValues.playerTypeId ?? "");

  // Return to view mode once a save completes successfully. Adjusted during
  // render (not an effect, and not a ref — both reading a ref during render
  // and calling setState in an effect are disallowed here) per
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (prevPending && !pending && !state?.error) {
      setIsEditing(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="space-y-6">
        {canEdit && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        )}
        <PlayerProfileView
          values={defaultValues}
          ageCategories={ageCategories}
          playerTypes={playerTypes}
          packages={packages}
          batches={batches}
          documentLinks={documentLinks}
        />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>

      <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" name="name" defaultValue={defaultValues.name} className={FILLED_INPUT} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={defaultValues.dateOfBirth}
            className={FILLED_INPUT}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ageCategoryId">Age Category</FieldLabel>
          <Select name="ageCategoryId" defaultValue={defaultValues.ageCategoryId ?? undefined}>
            <SelectTrigger id="ageCategoryId" className={cn("w-full", FILLED_INPUT)}>
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
        <Field>
          <FieldLabel htmlFor="email">Player Email ID</FieldLabel>
          <Input id="email" name="email" type="email" defaultValue={defaultValues.email ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="contactNumber">Player Contact Number</FieldLabel>
          <Input id="contactNumber" name="contactNumber" defaultValue={defaultValues.contactNumber ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="playerTypeId">Program Type</FieldLabel>
          <Select name="playerTypeId" value={playerTypeId} onValueChange={(v) => setPlayerTypeId(v as string)}>
            <SelectTrigger id="playerTypeId" className={cn("w-full", FILLED_INPUT)}>
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
        <PackageField
          packages={packages}
          selectedPlayerTypeId={playerTypeId || null}
          defaultPackageId={currentPackageIsCustom ? CUSTOM_PACKAGE_VALUE : defaultValues.packageId}
          defaultCustomName={customPackageName}
          defaultCustomAmount={customAmount}
          defaultCustomDiscount={customDiscount}
        />
        <Field>
          <FieldLabel htmlFor="batchId">Batch Allotment</FieldLabel>
          <Select name="batchId" defaultValue={defaultValues.batchId ?? undefined}>
            <SelectTrigger id="batchId" className={cn("w-full", FILLED_INPUT)}>
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
        <Field>
          <FieldLabel htmlFor="gender">Gender</FieldLabel>
          <Input id="gender" name="gender" defaultValue={defaultValues.gender ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="bloodGroup">Blood Group</FieldLabel>
          <Input id="bloodGroup" name="bloodGroup" defaultValue={defaultValues.bloodGroup ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="heightCm">Height (cm)</FieldLabel>
          <Input id="heightCm" name="heightCm" type="number" step="0.1" defaultValue={defaultValues.heightCm ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
          <Input id="weightKg" name="weightKg" type="number" step="0.1" defaultValue={defaultValues.weightKg ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="birthMark">Birth Mark</FieldLabel>
          <Input id="birthMark" name="birthMark" defaultValue={defaultValues.birthMark ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="aiffNumber">AIFF Number</FieldLabel>
          <Input id="aiffNumber" name="aiffNumber" defaultValue={defaultValues.aiffNumber ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="medicalCondition">Medical Condition</FieldLabel>
          <Textarea id="medicalCondition" name="medicalCondition" defaultValue={defaultValues.medicalCondition ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="foodAllergy">Food Allergy</FieldLabel>
          <Textarea id="foodAllergy" name="foodAllergy" defaultValue={defaultValues.foodAllergy ?? ""} className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
          <Input id="passportNumber" name="passportNumber" placeholder="Leave blank to keep existing" className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="aadhaarNumber">Aadhaar Number</FieldLabel>
          <Input id="aadhaarNumber" name="aadhaarNumber" placeholder="Leave blank to keep existing" className={FILLED_INPUT} />
        </Field>
        <Field>
          <FieldLabel htmlFor="aadhaarDoc">Upload Aadhaar</FieldLabel>
          <FileInput id="aadhaarDoc" name="aadhaarDoc" />
          {documentLinks?.aadhaar && (
            <FieldDescription>
              <a href={documentLinks.aadhaar} target="_blank" rel="noreferrer" className="underline">
                View current file
              </a>
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="medicalRecords">Upload Medical Records</FieldLabel>
          <FileInput id="medicalRecords" name="medicalRecords" />
          {documentLinks?.medicalRecords && (
            <FieldDescription>
              <a href={documentLinks.medicalRecords} target="_blank" rel="noreferrer" className="underline">
                View current file
              </a>
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="profilePicture">Upload Profile Picture</FieldLabel>
          <FileInput id="profilePicture" name="profilePicture" accept="image/*" />
          {documentLinks?.profilePicture && (
            <FieldDescription>
              <a href={documentLinks.profilePicture} target="_blank" rel="noreferrer" className="underline">
                View current file
              </a>
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>

      {state?.error && (
        <FieldDescription className="text-destructive">{state.error}</FieldDescription>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

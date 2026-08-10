"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileInput } from "@/components/ui/file-input";
import { PackageField, type PackageOption } from "./package-field";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FILLED_INPUT,
} from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { selectLabel, cn } from "@/lib/utils";
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
  additionalBatchIds?: string[];
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

const STEPS = [{ label: "Player Data" }, { label: "Parent Data" }];

function Required() {
  return <span className="text-destructive">*</span>;
}

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
  packages: PackageOption[];
  batches: Option[];
  defaultValues?: PlayerDefaultValues;
  parentEmailEditable?: boolean;
  documentLinks?: Record<string, string>;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState<1 | 2>(1);
  const [playerTypeId, setPlayerTypeId] = useState(defaultValues?.playerTypeId ?? "");
  const step1Ref = useRef<HTMLDivElement>(null);

  // Native constraint validation, scoped to just this step's fields — the
  // other step's fields stay mounted (so their values survive navigating
  // back and forth) but hidden via CSS, and a hidden field can't reliably
  // surface its own validation UI, so each step only ever checks the inputs
  // it's currently showing. :invalid picks up every required field
  // (native inputs, and Select/RadioGroup/FileInput's underlying native
  // elements) without having to name each one.
  function goToStep2() {
    const invalid = step1Ref.current?.querySelector<HTMLInputElement>(":invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setStep(2);
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-8">
        <Stepper steps={STEPS} currentStep={step} className="mx-auto max-w-sm" />

        <form action={formAction} className="space-y-8">
          <div ref={step1Ref} className={cn("space-y-6", step !== 1 && "hidden")}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">Player Information</h2>
              <FieldDescription className="text-right">
                Mandatory fields are marked with an asterisk (*)
              </FieldDescription>
            </div>

            <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">
                  Name <Required />
                </FieldLabel>
                <Input id="name" name="name" defaultValue={defaultValues?.name} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="dateOfBirth">
                  Date of Birth <Required />
                </FieldLabel>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={defaultValues?.dateOfBirth}
                  className={FILLED_INPUT}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>
                  Gender <Required />
                </FieldLabel>
                <RadioGroup name="gender" defaultValue={defaultValues?.gender ?? undefined} required className="h-8">
                  <Field orientation="horizontal" className="w-fit gap-1.5">
                    <RadioGroupItem value="Male" id="genderMale" />
                    <FieldLabel htmlFor="genderMale" className="font-normal">Male</FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-fit gap-1.5">
                    <RadioGroupItem value="Female" id="genderFemale" />
                    <FieldLabel htmlFor="genderFemale" className="font-normal">Female</FieldLabel>
                  </Field>
                  <Field orientation="horizontal" className="w-fit gap-1.5">
                    <RadioGroupItem value="Other" id="genderOther" />
                    <FieldLabel htmlFor="genderOther" className="font-normal">Other</FieldLabel>
                  </Field>
                </RadioGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="ageCategoryId">
                  Age Category <Required />
                </FieldLabel>
                <Select name="ageCategoryId" defaultValue={defaultValues?.ageCategoryId ?? undefined} required>
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
                <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contactNumber">
                  Player Contact Number <Required />
                </FieldLabel>
                <Input id="contactNumber" name="contactNumber" defaultValue={defaultValues?.contactNumber ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="playerTypeId">
                  Program Type <Required />
                </FieldLabel>
                <Select
                  name="playerTypeId"
                  value={playerTypeId}
                  onValueChange={(v) => setPlayerTypeId(v as string)}
                  required
                >
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
                defaultPackageId={defaultValues?.packageId}
              />
              <Field>
                <FieldLabel htmlFor="batchId">
                  Batch Allotment <Required />
                </FieldLabel>
                <Select name="batchId" defaultValue={defaultValues?.batchId ?? undefined} required>
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
              <Field className="sm:col-span-2">
                <FieldLabel>Additional Batches</FieldLabel>
                <FieldDescription>
                  Optional — enroll this player in other batches too. Each batch keeps its own
                  coach, attendance calendar, and 5S testing.
                </FieldDescription>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {batches.map((o) => (
                    <Field key={o.id} orientation="horizontal" className="w-fit gap-1.5">
                      <Checkbox
                        name="additionalBatchIds"
                        value={o.id}
                        id={`additionalBatch-${o.id}`}
                        defaultChecked={defaultValues?.additionalBatchIds?.includes(o.id)}
                      />
                      <FieldLabel htmlFor={`additionalBatch-${o.id}`} className="font-normal">
                        {o.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="bloodGroup">Blood Group</FieldLabel>
                <Input id="bloodGroup" name="bloodGroup" defaultValue={defaultValues?.bloodGroup ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="heightCm">Height (cm)</FieldLabel>
                <Input id="heightCm" name="heightCm" type="number" step="0.1" defaultValue={defaultValues?.heightCm ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
                <Input id="weightKg" name="weightKg" type="number" step="0.1" defaultValue={defaultValues?.weightKg ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="birthMark">Birth Mark</FieldLabel>
                <Input id="birthMark" name="birthMark" defaultValue={defaultValues?.birthMark ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="medicalCondition">Medical Condition</FieldLabel>
                <Textarea id="medicalCondition" name="medicalCondition" defaultValue={defaultValues?.medicalCondition ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="foodAllergy">Food Allergy</FieldLabel>
                <Textarea id="foodAllergy" name="foodAllergy" defaultValue={defaultValues?.foodAllergy ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="aiffNumber">AIFF Number</FieldLabel>
                <Input id="aiffNumber" name="aiffNumber" defaultValue={defaultValues?.aiffNumber ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
                <Input id="passportNumber" name="passportNumber" placeholder={documentLinks ? "Leave blank to keep existing" : undefined} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="aadhaarNumber">
                  Aadhaar Number <Required />
                </FieldLabel>
                <Input id="aadhaarNumber" name="aadhaarNumber" placeholder={documentLinks ? "Leave blank to keep existing" : undefined} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="aadhaarDoc">
                  Upload Aadhaar <Required />
                </FieldLabel>
                <FileInput id="aadhaarDoc" name="aadhaarDoc" required />
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
                <FieldLabel htmlFor="profilePicture">
                  Upload Profile Picture <Required />
                </FieldLabel>
                <FileInput id="profilePicture" name="profilePicture" accept="image/*" required />
                {documentLinks?.profilePicture && (
                  <FieldDescription>
                    <a href={documentLinks.profilePicture} target="_blank" rel="noreferrer" className="underline">
                      View current file
                    </a>
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>

            <div className="flex justify-end">
              <Button type="button" onClick={goToStep2}>
                Next step <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className={cn("space-y-6", step !== 2 && "hidden")}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">Parent / Guardian Information</h2>
              <FieldDescription className="text-right">
                Mandatory fields are marked with an asterisk (*)
              </FieldDescription>
            </div>

            <FieldGroup className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fatherName">
                  Father Name / Guardian Name <Required />
                </FieldLabel>
                <Input id="fatherName" name="fatherName" defaultValue={defaultValues?.fatherName ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="motherName">Mother Name</FieldLabel>
                <Input id="motherName" name="motherName" defaultValue={defaultValues?.motherName ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="parentEmail">
                  Parent / Guardian Email ID <Required />
                </FieldLabel>
                <Input
                  id="parentEmail"
                  name="parentEmail"
                  type="email"
                  defaultValue={defaultValues?.parentEmail}
                  readOnly={!parentEmailEditable}
                  className={FILLED_INPUT}
                  required
                />
                {!parentEmailEditable && (
                  <FieldDescription>
                    This is the parent&apos;s login — create a new player record to change it.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="parentContactNumber">
                  Parent / Guardian Contact Number <Required />
                </FieldLabel>
                <Input id="parentContactNumber" name="parentContactNumber" defaultValue={defaultValues?.parentContactNumber ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="addressLine1">
                  Address Line 1 <Required />
                </FieldLabel>
                <Input id="addressLine1" name="addressLine1" defaultValue={defaultValues?.addressLine1 ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
                <Input id="addressLine2" name="addressLine2" defaultValue={defaultValues?.addressLine2 ?? ""} className={FILLED_INPUT} />
              </Field>
              <Field>
                <FieldLabel htmlFor="country">
                  Country <Required />
                </FieldLabel>
                <Input id="country" name="country" defaultValue={defaultValues?.country ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="state">
                  State <Required />
                </FieldLabel>
                <Input id="state" name="state" defaultValue={defaultValues?.state ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="city">
                  City <Required />
                </FieldLabel>
                <Input id="city" name="city" defaultValue={defaultValues?.city ?? ""} className={FILLED_INPUT} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="pincode">
                  Pincode <Required />
                </FieldLabel>
                <Input id="pincode" name="pincode" defaultValue={defaultValues?.pincode ?? ""} className={FILLED_INPUT} required />
              </Field>
            </FieldGroup>

            {state?.error && (
              <FieldDescription className="text-destructive">{state.error}</FieldDescription>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

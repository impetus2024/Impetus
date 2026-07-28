import { ViewField } from "@/components/view-field";
import { calculateAge } from "@/lib/age";

type Option = { id: string; name: string };

export type PlayerProfileViewValues = {
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
};

export function PlayerProfileView({
  values,
  ageCategories,
  playerTypes,
  packages,
  batches,
  documentLinks,
}: {
  values: PlayerProfileViewValues;
  ageCategories: Option[];
  playerTypes: Option[];
  packages: Option[];
  batches: Option[];
  documentLinks?: Record<string, string>;
}) {
  const lookup = (options: Option[], id: string | null) => options.find((o) => o.id === id)?.name;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <ViewField label="Name" value={values.name} />
      <ViewField label="Age" value={`${calculateAge(values.dateOfBirth)} years`} />
      <ViewField label="Age Category" value={lookup(ageCategories, values.ageCategoryId)} />
      <ViewField label="Player Email ID" value={values.email} />
      <ViewField label="Player Contact Number" value={values.contactNumber} />
      <ViewField label="Program Type" value={lookup(playerTypes, values.playerTypeId)} />
      <ViewField label="Package" value={lookup(packages, values.packageId)} />
      <ViewField label="Batch Allotment" value={lookup(batches, values.batchId)} />
      <ViewField label="Gender" value={values.gender} />
      <ViewField label="Blood Group" value={values.bloodGroup} />
      <ViewField label="Height (cm)" value={values.heightCm} />
      <ViewField label="Weight (kg)" value={values.weightKg} />
      <ViewField label="Birth Mark" value={values.birthMark} />
      <ViewField label="AIFF Number" value={values.aiffNumber} />
      <ViewField label="Medical Condition" value={values.medicalCondition} fullWidth />
      <ViewField label="Food Allergy" value={values.foodAllergy} fullWidth />
      <ViewField
        label="Aadhaar Document"
        value={documentLinks?.aadhaar && (
          <a href={documentLinks.aadhaar} target="_blank" rel="noreferrer" className="text-primary underline">
            View file
          </a>
        )}
      />
      <ViewField
        label="Medical Records"
        value={documentLinks?.medicalRecords && (
          <a href={documentLinks.medicalRecords} target="_blank" rel="noreferrer" className="text-primary underline">
            View file
          </a>
        )}
      />
    </div>
  );
}

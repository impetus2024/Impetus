import { ViewField } from "@/components/view-field";

export type ParentProfileViewValues = {
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

export function ParentProfileView({ values }: { values: ParentProfileViewValues }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <ViewField label="Father Name / Guardian Name" value={values.fatherName} />
      <ViewField label="Mother Name" value={values.motherName} />
      <ViewField label="Parent / Guardian Email ID" value={values.parentEmail} />
      <ViewField label="Parent / Guardian Contact Number" value={values.parentContactNumber} />
      <ViewField label="Address Line 1" value={values.addressLine1} />
      <ViewField label="Address Line 2" value={values.addressLine2} />
      <ViewField label="Country" value={values.country} />
      <ViewField label="State" value={values.state} />
      <ViewField label="City" value={values.city} />
      <ViewField label="Pincode" value={values.pincode} />
    </div>
  );
}

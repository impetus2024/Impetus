import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ViewField } from "@/components/view-field";

export type AdministratorProfileViewValues = {
  name: string;
  dateOfBirth: string | null;
  contactNumber: string | null;
  dateOfJoining: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
};

// "profilePicture" is deliberately not in this list — it's shown as an
// actual Avatar above instead of a "View file" link like the other
// documents, same as how a player's profile picture renders (see
// ProfileCard) rather than being buried in a document list.
const DOC_FIELDS: { key: string; label: string }[] = [
  { key: "aadhaar", label: "Aadhaar Card" },
  { key: "birthCertificate", label: "Birth Certificate" },
  { key: "otherDocuments", label: "Other Documents" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}

export function AdministratorProfileView({
  values,
  documentLinks,
}: {
  values: AdministratorProfileViewValues;
  documentLinks?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <Avatar className="size-20 ring-4 ring-primary/15">
        {documentLinks?.profilePicture && (
          <AvatarImage src={documentLinks.profilePicture} alt={values.name} />
        )}
        <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
          {initials(values.name)}
        </AvatarFallback>
      </Avatar>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <ViewField label="Name" value={values.name} />
        <ViewField label="Date of Birth" value={values.dateOfBirth} />
        <ViewField label="Contact Number" value={values.contactNumber} />
        <ViewField label="Date of Joining" value={values.dateOfJoining} />
        <ViewField label="Address Line 1" value={values.addressLine1} />
        <ViewField label="Address Line 2" value={values.addressLine2} />
        <ViewField label="Country" value={values.country} />
        <ViewField label="State" value={values.state} />
        <ViewField label="City" value={values.city} />
        <ViewField label="Pincode" value={values.pincode} />
        {DOC_FIELDS.map(({ key, label }) => (
          <ViewField
            key={key}
            label={label}
            value={
              documentLinks?.[key] && (
                <a href={documentLinks[key]} target="_blank" rel="noreferrer" className="text-primary underline">
                  View file
                </a>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

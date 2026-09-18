import "server-only";
import * as z from "zod";

// Personal details a staff member's profile carries, shared by the Centre
// Admin edit form (updateAdministrator) and the coach's own /coach/profile
// form, so both validate identically. Deliberately excludes role, centre and
// email: those are identity/permission fields with their own dedicated flows.
export const StaffDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Name is required." })
    .max(100, { error: "Name must be 100 characters or fewer." }),
  // Permissive on purpose: existing staff numbers were saved without format
  // rules, and editing any other field must not be blocked by them.
  contactNumber: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, { error: "Enter a valid contact number." }),
  dateOfBirth: z.iso
    .date({ error: "Enter a valid date of birth." })
    .refine((d) => d <= new Date().toISOString().slice(0, 10), {
      error: "Date of birth can't be in the future.",
    })
    .optional(),
  addressLine1: z.string().trim().max(200, { error: "Address line 1 is too long." }).optional(),
  addressLine2: z.string().trim().max(200, { error: "Address line 2 is too long." }).optional(),
  country: z.string().trim().max(100, { error: "Country is too long." }).optional(),
  state: z.string().trim().max(100, { error: "State is too long." }).optional(),
  city: z.string().trim().max(100, { error: "City is too long." }).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, { error: "Enter a valid pincode." })
    .optional(),
});

export type StaffDetails = z.infer<typeof StaffDetailsSchema>;

function emptyToUndefined(v: FormDataEntryValue | null) {
  return v && v.toString().trim() !== "" ? v.toString() : undefined;
}

export function readStaffDetails(formData: FormData) {
  return {
    name: formData.get("name"),
    contactNumber: formData.get("contactNumber"),
    dateOfBirth: emptyToUndefined(formData.get("dateOfBirth")),
    addressLine1: emptyToUndefined(formData.get("addressLine1")),
    addressLine2: emptyToUndefined(formData.get("addressLine2")),
    country: emptyToUndefined(formData.get("country")),
    state: emptyToUndefined(formData.get("state")),
    city: emptyToUndefined(formData.get("city")),
    pincode: emptyToUndefined(formData.get("pincode")),
  };
}

// staff_profiles columns for the details above (name lives on profiles).
export function staffDetailsColumns(d: StaffDetails) {
  return {
    contact_number: d.contactNumber,
    date_of_birth: d.dateOfBirth ?? null,
    address_line1: d.addressLine1 ?? null,
    address_line2: d.addressLine2 ?? null,
    country: d.country ?? null,
    state: d.state ?? null,
    city: d.city ?? null,
    pincode: d.pincode ?? null,
  };
}

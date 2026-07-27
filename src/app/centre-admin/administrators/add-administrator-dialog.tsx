"use client";

import { useDialogFormAction } from "@/hooks/use-dialog-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "@/components/ui/field";
import {
  createAdministrator,
  type AdministratorFormState,
} from "./actions";

export function AddAdministratorDialog() {
  const { open, setOpen, pending, state, submit } =
    useDialogFormAction<AdministratorFormState>(createAdministrator);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Administrator</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Administrator</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-6">
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email ID</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contactNumber">Contact Number</FieldLabel>
                <Input id="contactNumber" name="contactNumber" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel>
                <Input id="addressLine1" name="addressLine1" />
              </Field>
              <Field>
                <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
                <Input id="addressLine2" name="addressLine2" />
              </Field>
              <Field>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <Input id="country" name="country" />
              </Field>
              <Field>
                <FieldLabel htmlFor="state">State</FieldLabel>
                <Input id="state" name="state" />
              </Field>
              <Field>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input id="city" name="city" />
              </Field>
              <Field>
                <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
                <Input id="pincode" name="pincode" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Role</FieldLabel>
                <Select name="role" defaultValue="coach" required>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centre_admin">Centre Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="dateOfJoining">Date of Joining</FieldLabel>
                <Input id="dateOfJoining" name="dateOfJoining" type="date" />
              </Field>
              <Field>
                <FieldLabel htmlFor="aadhaarCard">Aadhaar Card</FieldLabel>
                <Input id="aadhaarCard" name="aadhaarCard" type="file" />
              </Field>
              <Field>
                <FieldLabel htmlFor="birthCertificate">
                  Birth Certificate
                </FieldLabel>
                <Input
                  id="birthCertificate"
                  name="birthCertificate"
                  type="file"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profilePicture">
                  Upload Profile Picture
                </FieldLabel>
                <Input
                  id="profilePicture"
                  name="profilePicture"
                  type="file"
                  accept="image/*"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="otherDocuments">
                  Other Documents
                </FieldLabel>
                <Input id="otherDocuments" name="otherDocuments" type="file" />
              </Field>
            </FieldGroup>
          </FieldSet>

          {state?.error && (
            <FieldDescription className="text-destructive">
              {state.error}
            </FieldDescription>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create Administrator"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

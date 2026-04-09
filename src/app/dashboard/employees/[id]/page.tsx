"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEmployee, useUpdateEmployee, useResetEmployeePassword, useDeactivateEmployee } from "@/hooks/use-employees";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Pencil, Save, X, KeyRound, UserMinus } from "lucide-react";
import type { UpdateEmployeeInput } from "@/lib/validations/schemas";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("COMPANY_ADMIN");

  const { data: employee, isLoading, error } = useEmployee(id);
  const updateEmployee = useUpdateEmployee(id);
  const resetPassword = useResetEmployeePassword(id);
  const deactivateEmployee = useDeactivateEmployee();

  const [editing, setEditing] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [editForm, setEditForm] = useState<Partial<UpdateEmployeeInput>>({});

  const startEditing = () => {
    if (!employee) return;
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      designation: employee.designation,
      role: employee.role === "SUPER_ADMIN" ? undefined : employee.role as "COMPANY_ADMIN" | "MANAGER" | "EMPLOYEE",
      dateOfJoining: employee.dateOfJoining,
      dateOfBirth: employee.dateOfBirth,
      gender: employee.gender,
      address: employee.address || { street: "", city: "", state: "", zipCode: "", country: "" },
      emergencyContact: employee.emergencyContact || { name: "", relationship: "", phone: "" },
      bankDetails: employee.bankDetails || { bankName: "", accountNumber: "", ifscCode: "", accountHolderName: "" },
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    try {
      const payload = { ...editForm };
      // Strip empty nested objects
      if (payload.address && Object.values(payload.address).every((v) => !v)) {
        delete payload.address;
      }
      if (payload.emergencyContact && Object.values(payload.emergencyContact).every((v) => !v)) {
        delete payload.emergencyContact;
      }
      if (payload.bankDetails && Object.values(payload.bankDetails).every((v) => !v)) {
        delete payload.bankDetails;
      }
      await updateEmployee.mutateAsync(payload);
      setEditing(false);
    } catch {
      // Error handled by React Query
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccess("");
    try {
      await resetPassword.mutateAsync(newPassword);
      setResetSuccess("Password reset successfully!");
      setNewPassword("");
      setTimeout(() => {
        setShowResetPassword(false);
        setResetSuccess("");
      }, 2000);
    } catch {
      // Error handled by React Query
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate this employee?")) return;
    await deactivateEmployee.mutateAsync(id);
    router.push("/dashboard/employees");
  };

  const updateField = (field: string, value: string) => {
    setEditForm((prev) => {
      const keys = field.split(".");
      const newForm = { ...prev } as Record<string, unknown>;
      let current = newForm;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newForm as Partial<UpdateEmployeeInput>;
    });
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "active": return "success" as const;
      case "inactive": return "secondary" as const;
      case "terminated": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Employee not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/employees")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-lg">
              {employee.firstName[0]}{employee.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground">
              {employee.employeeId} · {employee.designation}
            </p>
          </div>
          <Badge variant={statusVariant(employee.status)}>{employee.status}</Badge>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" onClick={() => setShowResetPassword(!showResetPassword)}>
                  <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                </Button>
                {employee.status === "active" && (
                  <Button variant="destructive" onClick={handleDeactivate}>
                    <UserMinus className="mr-2 h-4 w-4" /> Deactivate
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button onClick={handleSave} disabled={updateEmployee.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateEmployee.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={cancelEditing}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Messages */}
      {updateEmployee.isError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {updateEmployee.error instanceof Error ? updateEmployee.error.message : "Failed to update employee"}
        </div>
      )}

      {/* Reset Password Form */}
      {showResetPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reset Password for {employee.firstName}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting..." : "Reset Password"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowResetPassword(false); setNewPassword(""); }}>
                Cancel
              </Button>
            </form>
            {resetPassword.isError && (
              <p className="mt-2 text-sm text-destructive">
                {resetPassword.error instanceof Error ? resetPassword.error.message : "Failed to reset password"}
              </p>
            )}
            {resetSuccess && (
              <p className="mt-2 text-sm text-green-600">{resetSuccess}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Employee Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    <Input value={editForm.firstName || ""} onChange={(e) => updateField("firstName", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <Input value={editForm.lastName || ""} onChange={(e) => updateField("lastName", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input type="email" value={editForm.email || ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input value={editForm.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                    <Input type="date" value={editForm.dateOfBirth || ""} onChange={(e) => updateField("dateOfBirth", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={editForm.gender || ""}
                      onChange={(e) => updateField("gender", e.target.value)}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Email" value={employee.email} />
                <DetailRow label="Phone" value={employee.phone} />
                <DetailRow label="Date of Birth" value={employee.dateOfBirth} />
                <DetailRow label="Gender" value={employee.gender} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Work Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <Input value={editForm.department || ""} onChange={(e) => updateField("department", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Designation</Label>
                  <Input value={editForm.designation || ""} onChange={(e) => updateField("designation", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={editForm.role || "EMPLOYEE"}
                    onChange={(e) => updateField("role", e.target.value)}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date of Joining</Label>
                  <Input type="date" value={editForm.dateOfJoining || ""} onChange={(e) => updateField("dateOfJoining", e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Department" value={employee.department} />
                <DetailRow label="Designation" value={employee.designation} />
                <DetailRow label="Role" value={employee.role} />
                <DetailRow label="Date of Joining" value={employee.dateOfJoining} />
                <DetailRow label="Employee ID" value={employee.employeeId} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Street</Label>
                  <Input value={(editForm.address as Record<string, string>)?.street || ""} onChange={(e) => updateField("address.street", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={(editForm.address as Record<string, string>)?.city || ""} onChange={(e) => updateField("address.city", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <Input value={(editForm.address as Record<string, string>)?.state || ""} onChange={(e) => updateField("address.state", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Zip Code</Label>
                  <Input value={(editForm.address as Record<string, string>)?.zipCode || ""} onChange={(e) => updateField("address.zipCode", e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <Input value={(editForm.address as Record<string, string>)?.country || ""} onChange={(e) => updateField("address.country", e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Street" value={employee.address?.street} />
                <DetailRow label="City" value={employee.address?.city} />
                <DetailRow label="State" value={employee.address?.state} />
                <DetailRow label="Zip Code" value={employee.address?.zipCode} />
                <DetailRow label="Country" value={employee.address?.country} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input value={(editForm.emergencyContact as Record<string, string>)?.name || ""} onChange={(e) => updateField("emergencyContact.name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Relationship</Label>
                  <Input value={(editForm.emergencyContact as Record<string, string>)?.relationship || ""} onChange={(e) => updateField("emergencyContact.relationship", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input value={(editForm.emergencyContact as Record<string, string>)?.phone || ""} onChange={(e) => updateField("emergencyContact.phone", e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Name" value={employee.emergencyContact?.name} />
                <DetailRow label="Relationship" value={employee.emergencyContact?.relationship} />
                <DetailRow label="Phone" value={employee.emergencyContact?.phone} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Bank Details */}
        {isAdmin && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Bank Details</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Bank Name</Label>
                    <Input value={(editForm.bankDetails as Record<string, string>)?.bankName || ""} onChange={(e) => updateField("bankDetails.bankName", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Account Holder</Label>
                    <Input value={(editForm.bankDetails as Record<string, string>)?.accountHolderName || ""} onChange={(e) => updateField("bankDetails.accountHolderName", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Account Number</Label>
                    <Input value={(editForm.bankDetails as Record<string, string>)?.accountNumber || ""} onChange={(e) => updateField("bankDetails.accountNumber", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">IFSC Code</Label>
                    <Input value={(editForm.bankDetails as Record<string, string>)?.ifscCode || ""} onChange={(e) => updateField("bankDetails.ifscCode", e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="Bank Name" value={employee.bankDetails?.bankName} />
                  <DetailRow label="Account Holder" value={employee.bankDetails?.accountHolderName} />
                  <DetailRow label="Account Number" value={employee.bankDetails?.accountNumber} />
                  <DetailRow label="IFSC Code" value={employee.bankDetails?.ifscCode} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

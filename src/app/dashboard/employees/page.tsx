"use client";

import { useState } from "react";
import { useEmployees, useCreateEmployee, useDeactivateEmployee } from "@/hooks/use-employees";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, UserMinus, Eye } from "lucide-react";
import type { CreateEmployeeInput } from "@/lib/validations/schemas";
import Link from "next/link";

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: employees, isLoading } = useEmployees({ page, pageSize: 20 });
  const createEmployee = useCreateEmployee();
  const deactivateEmployee = useDeactivateEmployee();

  const isAdmin = hasRole("COMPANY_ADMIN");

  const [form, setForm] = useState<Partial<CreateEmployeeInput>>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    designation: "",
    role: "EMPLOYEE",
    dateOfJoining: new Date().toISOString().split("T")[0],
    dateOfBirth: "",
    gender: "male",
    address: { street: "", city: "", state: "", zipCode: "", country: "" },
    emergencyContact: { name: "", relationship: "", phone: "" },
    bankDetails: { bankName: "", accountNumber: "", ifscCode: "", accountHolderName: "" },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Strip empty nested objects so optional validation passes
      const payload = { ...form };
      if (payload.address && Object.values(payload.address).every((v) => !v)) {
        delete payload.address;
      }
      if (payload.emergencyContact && Object.values(payload.emergencyContact).every((v) => !v)) {
        delete payload.emergencyContact;
      }
      if (payload.bankDetails && Object.values(payload.bankDetails).every((v) => !v)) {
        delete payload.bankDetails;
      }
      await createEmployee.mutateAsync(payload as CreateEmployeeInput);
      setShowForm(false);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        department: "",
        designation: "",
        role: "EMPLOYEE",
        dateOfJoining: new Date().toISOString().split("T")[0],
        dateOfBirth: "",
        gender: "male",
        address: { street: "", city: "", state: "", zipCode: "", country: "" },
        emergencyContact: { name: "", relationship: "", phone: "" },
        bankDetails: { bankName: "", accountNumber: "", ifscCode: "", accountHolderName: "" },
      });
    } catch {
      // Error is handled by React Query
    }
  };

  const updateForm = (path: string, value: string) => {
    setForm((prev) => {
      const keys = path.split(".");
      const newForm = { ...prev } as Record<string, unknown>;
      let current = newForm;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newForm as Partial<CreateEmployeeInput>;
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

  const filteredEmployees = employees?.filter(
    (emp) =>
      !search ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">Manage your company&apos;s employees</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Add Employee Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              {createEmployee.isError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {createEmployee.error instanceof Error ? createEmployee.error.message : "Failed to create employee"}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => updateForm("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => updateForm("lastName", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => updateForm("department", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input
                    value={form.designation}
                    onChange={(e) => updateForm("designation", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.role}
                    onChange={(e) => updateForm("role", e.target.value)}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={form.dateOfJoining}
                    onChange={(e) => updateForm("dateOfJoining", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => updateForm("dateOfBirth", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.gender}
                    onChange={(e) => updateForm("gender", e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Address</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <Input placeholder="Street" value={form.address?.street} onChange={(e) => updateForm("address.street", e.target.value)} />
                  <Input placeholder="City" value={form.address?.city} onChange={(e) => updateForm("address.city", e.target.value)} />
                  <Input placeholder="State" value={form.address?.state} onChange={(e) => updateForm("address.state", e.target.value)} />
                  <Input placeholder="Zip Code" value={form.address?.zipCode} onChange={(e) => updateForm("address.zipCode", e.target.value)} />
                  <Input placeholder="Country" value={form.address?.country} onChange={(e) => updateForm("address.country", e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={createEmployee.isPending}>
                  {createEmployee.isPending ? "Creating..." : "Create Employee"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees?.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{emp.employeeId}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.designation}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.role}</Badge>
                    </TableCell>
                  <TableCell>
                      <Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/dashboard/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isAdmin && emp.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Deactivate this employee?")) {
                                deactivateEmployee.mutate(emp.id);
                              }
                            }}
                            title="Deactivate"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredEmployees || filteredEmployees.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

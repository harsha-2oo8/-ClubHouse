import { useState } from "react";
import {
  useListCollegeRoles, getListCollegeRolesQueryKey,
  useGetCollegeRolesCatalog, getGetCollegeRolesCatalogQueryKey,
  useCreateCollegeRole, useUpdateCollegeRole, useDeleteCollegeRole,
  useListRoleAssignments, getListRoleAssignmentsQueryKey,
  useAssignCollegeRole, useUnassignCollegeRole,
  useUpdateMemberType, useVerifyMemberType,
  useGetCollegeSettings, getGetCollegeSettingsQueryKey, useUpdateCollegeSettings,
  type MemberTypeUpdateMemberType,
  type CollegeRoleInputMemberType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Plus, Trash2, Check, X } from "lucide-react";
import { DeleteConfirm } from "@/components/delete-confirm";
import { cn } from "@/lib/utils";

interface RolesTabProps {
  collegeId: number;
  userId: string | null;
  members: Array<Record<string, unknown>>;
}

type RoleRecord = Record<string, unknown> & {
  id: number; name: string; memberType: string; priority: number;
  isSystem: boolean; description?: string | null;
  permissions: string[]; memberCount: number;
};

const typeColors: Record<string, string> = {
  COLLEGE_HEAD: "bg-purple-500/10 text-purple-700 border-purple-200",
  TRUSTEE: "bg-blue-500/10 text-blue-700 border-blue-200",
  TEACHER: "bg-green-500/10 text-green-700 border-green-200",
  STAFF: "bg-orange-500/10 text-orange-700 border-orange-200",
  STUDENT: "bg-muted text-muted-foreground border-border",
};

/** College Head governance: roles, assignments, identity verification, settings. */
export function RolesTab({ collegeId, userId, members }: RolesTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RoleRecord | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [assignMember, setAssignMember] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [requestType, setRequestType] = useState("TEACHER");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListCollegeRolesQueryKey(collegeId) });
    qc.invalidateQueries({ queryKey: getGetCollegeSettingsQueryKey(collegeId) });
  };

  const { data: rolesData } = useListCollegeRoles(collegeId, {
    query: { queryKey: getListCollegeRolesQueryKey(collegeId) },
  });
  const { data: catalogData } = useGetCollegeRolesCatalog(collegeId, {
    query: { queryKey: getGetCollegeRolesCatalogQueryKey(collegeId) },
  });
  const { data: settings } = useGetCollegeSettings(collegeId, {
    query: { queryKey: getGetCollegeSettingsQueryKey(collegeId) },
  });
  const { data: assignments } = useListRoleAssignments(collegeId, expanded ?? 0, {
    query: {
      queryKey: getListRoleAssignmentsQueryKey(collegeId, expanded ?? 0),
      enabled: expanded !== null,
    },
  });
  const typedAssignments = ((assignments as unknown as Array<Record<string, unknown>>) ?? []);

  const roles = ((rolesData as unknown as RoleRecord[]) ?? []).slice().sort((a, b) => b.priority - a.priority);
  const catalog = (catalogData as unknown as {
    permissions: Array<{ key: string; scope: string; label: string; description: string }>;
  } | undefined);
  const typedSettings = settings as unknown as { allowStudentCreate?: boolean; openJoin?: boolean } | undefined;
  const pendingIdentities = members.filter((m) => m.memberStatus === "PENDING");

  const createRole = useCreateCollegeRole();
  const updateRole = useUpdateCollegeRole();
  const deleteRole = useDeleteCollegeRole();
  const assignRoleMut = useAssignCollegeRole();
  const unassignRole = useUnassignCollegeRole();
  const updateType = useUpdateMemberType();
  const verifyType = useVerifyMemberType();
  const updateSettings = useUpdateCollegeSettings();

  async function handleAssign() {
    if (!assignMember || !assignRole) {
      toast({ title: "Pick a member and a role", variant: "destructive" });
      return;
    }
    try {
      await assignRoleMut.mutateAsync({ collegeId, roleId: Number(assignRole), data: { clerkId: assignMember } });
      toast({ title: "Role assigned" });
      setAssignMember("");
      setAssignRole("");
      refresh();
    } catch {
      toast({ title: "Could not assign role (hierarchy?)", variant: "destructive" });
    }
  }

  async function handleVerify(clerkId: string, status: "VERIFIED" | "REJECTED" | "SUSPENDED") {
    try {
      await verifyType.mutateAsync({ collegeId, userId: clerkId, data: { status } });
      toast({ title: `Identity ${status.toLowerCase()}` });
      refresh();
    } catch {
      toast({ title: "Could not update verification", variant: "destructive" });
    }
  }

  async function handleRequestType() {
    try {
      await updateType.mutateAsync({ collegeId, userId: userId!, data: { memberType: requestType as MemberTypeUpdateMemberType } });
      toast({ title: requestType === "STUDENT" ? "Identity updated" : "Sent for verification" });
      refresh();
    } catch {
      toast({ title: "Could not submit request", variant: "destructive" });
    }
  }

  async function handleSettings(patch: { allowStudentCreate?: boolean; openJoin?: boolean }) {
    try {
      await updateSettings.mutateAsync({ collegeId, data: patch });
      toast({ title: "Settings saved" });
      refresh();
    } catch {
      toast({ title: "Could not save settings", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Identity verification queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Identity verification
            {pendingIdentities.length > 0 && (
              <Badge className="h-5 px-1.5 text-xs">{pendingIdentities.length} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingIdentities.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending identity claims.</p>
          )}
          {pendingIdentities.map((m) => (
            <div key={String(m.clerkId)} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{String(m.name)}</p>
                <p className="text-xs text-muted-foreground">
                  Claims <Badge variant="outline" className="text-xs mx-1">{String(m.memberType)}</Badge>
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => void handleVerify(String(m.clerkId), "VERIFIED")} data-testid={`button-verify-${m.clerkId}`}>
                  <Check className="h-3.5 w-3.5" /> Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleVerify(String(m.clerkId), "REJECTED")} data-testid={`button-reject-identity-${m.clerkId}`}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground flex-1">Request your own identity type (teacher/staff/trustee claims need verification):</p>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger className="w-40" data-testid="select-request-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["STUDENT", "TEACHER", "STAFF", "TRUSTEE"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => void handleRequestType()} data-testid="button-request-type">
              Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assign */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assign role</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Select value={assignMember} onValueChange={setAssignMember}>
            <SelectTrigger className="flex-1" data-testid="select-assign-member"><SelectValue placeholder="Member" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={String(m.clerkId)} value={String(m.clerkId)}>
                  {String(m.name)} ({String(m.memberType ?? "STUDENT")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignRole} onValueChange={setAssignRole}>
            <SelectTrigger className="flex-1" data-testid="select-assign-role"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.priority})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void handleAssign()} disabled={assignRoleMut.isPending} data-testid="button-assign-role">
            Assign
          </Button>
        </CardContent>
      </Card>

      {/* Role cards */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Roles ({roles.length})</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)} data-testid="button-create-role">
          <Plus className="h-4 w-4" /> Create Role
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <Card key={r.id} data-testid={`card-role-${r.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-display font-bold">{r.name}</h4>
                {r.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className={cn("text-xs border", typeColors[r.memberType] ?? "bg-muted")}>
                  {r.memberType}
                </Badge>
                <span className="text-xs text-muted-foreground">Priority {r.priority}</span>
                <span className="text-xs text-muted-foreground">· {r.memberCount} members</span>
              </div>
              {r.description && <p className="text-sm text-muted-foreground mb-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1 mb-3">
                {r.permissions.map((p) => (
                  <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" title={p}>
                    {p}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(r)} data-testid={`button-edit-role-${r.id}`}>
                  Manage Role
                </Button>
                {!r.isSystem && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(r)} data-testid={`button-delete-role-${r.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  data-testid={`button-role-members-${r.id}`}
                >
                  {expanded === r.id ? "Hide" : "Members"}
                </Button>
              </div>
              {expanded === r.id && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {typedAssignments.map((a) => (
                    <div key={String(a.id)} className="flex items-center justify-between text-sm">
                      <span>{String(a.userName || a.clerkId)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => void handleUnassign(r.id, Number(a.id))}
                        aria-label={`Remove ${a.userName || a.clerkId}`}
                        data-testid={`button-unassign-${a.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {typedAssignments.length === 0 && (
                    <p className="text-xs text-muted-foreground">No members assigned.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Governance settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Students may create projects, clubs and events</p>
              <p className="text-xs text-muted-foreground">Off = only explicitly granted members can create</p>
            </div>
            <Switch
              checked={typedSettings?.allowStudentCreate ?? true}
              onCheckedChange={(v) => void handleSettings({ allowStudentCreate: v })}
              data-testid="switch-allow-student-create"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Open joining</p>
              <p className="text-xs text-muted-foreground">Off = new join requests are refused</p>
            </div>
            <Switch
              checked={typedSettings?.openJoin ?? true}
              onCheckedChange={(v) => void handleSettings({ openJoin: v })}
              data-testid="switch-open-join"
            />
          </div>
        </CardContent>
      </Card>

      <RoleEditor
        collegeId={collegeId}
        role={editing}
        creating={creating}
        catalog={catalog?.permissions ?? []}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={refresh}
      />
      <DeleteConfirm
        open={deleting !== null}
        onOpenChange={(next) => { if (!next) setDeleting(null); }}
        title="Delete role"
        statement={`Permanently remove the "${deleting?.name ?? ""}" role? Members keep their other grants.`}
        onConfirm={() => void (async () => {
          if (!deleting) return;
          try {
            await deleteRole.mutateAsync({ collegeId, roleId: deleting.id });
            toast({ title: "Role deleted" });
            setDeleting(null);
            refresh();
          } catch {
            toast({ title: "Could not delete role", variant: "destructive" });
          }
        })()}
      />
    </div>
  );

  async function handleUnassign(roleId: number, assignmentId: number) {
    try {
      await unassignRole.mutateAsync({ collegeId, roleId, assignmentId });
      toast({ title: "Assignment removed" });
      qc.invalidateQueries({ queryKey: getListCollegeRolesQueryKey(collegeId) });
    } catch {
      toast({ title: "Could not remove assignment", variant: "destructive" });
    }
  }
}

function RoleEditor({ collegeId, role, creating, catalog, onClose, onSaved }: {
  collegeId: number;
  role?: RoleRecord | null;
  creating: boolean;
  catalog: Array<{ key: string; scope: string; label: string; description: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createRole = useCreateCollegeRole();
  const updateRole = useUpdateCollegeRole();
  const [name, setName] = useState("");
  const [memberType, setMemberType] = useState("STUDENT");
  const [priority, setPriority] = useState("650");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [initializedFor, setInitializedFor] = useState<number | "new" | null>(null);

  const open = creating || role !== null;
  const target = creating ? "new" : role?.id ?? null;
  if (open && initializedFor !== target) {
    setInitializedFor(target);
    setName(role?.name ?? "");
    setMemberType(role?.memberType ?? "STUDENT");
    setPriority(String(role?.priority ?? 650));
    setDescription(role?.description ?? "");
    setPerms(role?.permissions ?? []);
  }
  if (!open && initializedFor !== null) setInitializedFor(null);

  const scopes = [...new Set(catalog.map((p) => p.scope))];

  async function save() {
    try {
      if (creating) {
        await createRole.mutateAsync({
          collegeId,
          data: { name: name.trim(), memberType: memberType as CollegeRoleInputMemberType, priority: Number(priority), description: description || undefined, permissions: perms },
        });
        toast({ title: "Role created" });
      } else if (role) {
        await updateRole.mutateAsync({
          collegeId,
          roleId: role.id,
          data: { name: role.isSystem ? undefined : name.trim(), description, permissions: perms },
        });
        toast({ title: "Role updated" });
      }
      onSaved();
      onClose();
    } catch {
      toast({ title: "Could not save role", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{creating ? "Create role" : `Manage ${role?.name ?? ""}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Role name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={Boolean(role?.isSystem)}
              placeholder="e.g. Events Coordinator"
              data-testid="input-role-name"
            />
            {role?.isSystem && <p className="text-xs text-muted-foreground mt-1">System role names are locked.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Member type</label>
              <Select value={memberType} onValueChange={setMemberType} disabled={Boolean(role?.isSystem)}>
                <SelectTrigger data-testid="select-role-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["STUDENT", "TEACHER", "STAFF", "TRUSTEE", "COLLEGE_HEAD"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Priority (1–999)</label>
              <Input
                type="number" min={1} max={999} value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={Boolean(role?.isSystem)}
                data-testid="input-role-priority"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-role-desc" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Permissions</p>
            <div className="space-y-3 max-h-64 overflow-y-auto rounded-lg border p-3">
              {scopes.map((scope) => (
                <div key={scope}>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{scope}</p>
                  {catalog.filter((p) => p.scope === scope).map((p) => (
                    <label key={p.key} className="flex items-start gap-2 py-1 cursor-pointer" title={p.description}>
                      <Checkbox
                        checked={perms.includes(p.key)}
                        onCheckedChange={(v) => setPerms(v ? [...perms, p.key] : perms.filter((x) => x !== p.key))}
                        data-testid={`perm-${p.key}`}
                      />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => void save()} className="w-full" data-testid="button-save-role">
            Save role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

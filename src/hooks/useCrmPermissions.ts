"use client";

/**
 * @file useCrmPermissions.ts
 * @description CRM-specific permission hook. Combines useOrgRole with the CRM permission matrix.
 * Use this in CRM components to check what the current user can do.
 */

import { useMemo } from "react";
import { useOrgRole } from "@/hooks/useOrgRole";
import { getCrmPermissions } from "@/lib/rbac";
import type { OrgRole, CrmPermissions, OrgMember } from "@/lib/rbac";

interface UseCrmPermissionsReturn extends CrmPermissions {
  /** The current user's org role. */
  role: OrgRole;
  /** True while the role is loading from Firestore. */
  isRoleLoading: boolean;
  /** All org members (only populated for Admin/Owner). */
  members: OrgMember[];
  /** Update a member's role. Only Admins/Owners. */
  setMemberRole: (targetUid: string, newRole: OrgRole) => Promise<void>;
}

export function useCrmPermissions(orgId: string = "soltheory"): UseCrmPermissionsReturn {
  const { role, isLoading, members, setMemberRole } = useOrgRole(orgId);

  const permissions = useMemo(() => getCrmPermissions(role), [role]);

  return {
    role,
    isRoleLoading: isLoading,
    members,
    setMemberRole,
    ...permissions,
  };
}

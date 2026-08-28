export interface PermissionRule {
  collection: string;
  action: "create" | "read" | "update" | "delete";
  filter?: Record<string, unknown>;
  /** Omit for all fields. Listing fields explicitly is how private columns stay unreadable. */
  fields?: string[];
}

export interface PolicyDefinition {
  name: string;
  icon: string;
  description: string;
  adminAccess: boolean;
  appAccess: boolean;
  /** When set, a matching Role is created and linked to this Policy. */
  role?: { icon: string };
  rules: PermissionRule[];
}

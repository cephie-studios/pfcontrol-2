export interface RolesTable {
  id: number;
  name: string;
  description?: string;
  permissions: object;
  color?: string;
  icon?: string;
  priority?: number;
  created_at?: Date;
  updated_at?: Date;
}

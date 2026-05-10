export interface DeveloperApplicationsTable {
  id: number;
  user_id: string;
  who_text: string;
  why_text: string;
  requested_scopes: unknown;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reviewer_note: string | null;
  approved_scopes: unknown | null;
  created_at: Date;
  updated_at: Date;
}
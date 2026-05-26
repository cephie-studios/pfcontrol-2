export interface WebsocketSnapshotsTable {
  id?: number;
  namespace_id: string;
  connected_count: number;
  sampled_at: Date;
}
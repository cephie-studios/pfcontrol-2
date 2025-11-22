export interface AcarsMessage {
  id: string;
  timestamp: string;
  station: string;
  text: string;
  type: 'system' | 'pdc' | 'atis' | 'contact' | 'warning' | 'Success';
  link?: {
    text: string;
    url: string;
  };
}

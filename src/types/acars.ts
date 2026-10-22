export interface AcarsMessage {
  id: string;
  timestamp: string;
  station: string;
  text: string;
  type:
    | 'system'
    | 'pdc'
    | 'atis'
    | 'contact'
    | 'warning'
    | 'Success'
    | 'atc'
    | 'pilot';
  chatId?: number;
  own?: boolean;
  link?: {
    text: string;
    url: string;
  };
}

export interface MetarCloud {
  cover: string;
  base: number;
}

export interface MetarData {
  icaoId: string;
  receiptTime: string;
  obsTime: number;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  visib: string;
  altim: number;
  qcField: number;
  metarType: string;
  rawOb: string;
  lat: number;
  lon: number;
  elev: number;
  name: string;
  cover: string;
  clouds: MetarCloud[];
  fltCat: string;
  wgst?: number;
}

export type MetarResponse = MetarData[];

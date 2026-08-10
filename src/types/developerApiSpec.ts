export interface DeveloperApiDocHeader {
  name: string;
  required: boolean;
  description: string;
}

export interface DeveloperApiDocEndpoint {
  scopeId: string;
  endpointKey: string;
  title: string;
  summary: string;
  method: string;
  pathTemplate: string;
  fullUrlExample: string;
  pathParams?: { name: string; description: string; example?: string }[];
  queryParams?: {
    name: string;
    required: boolean;
    description: string;
    example?: string;
  }[];
  requestBodySummary?: string;
  requestBodyExampleJson?: string;
  requestHeaders: DeveloperApiDocHeader[];
  responseContentType: string;
  responseSummary: string;
  exampleCurl: string;
  availableSince: 1 | 2;
}

export interface DeveloperApiDocWebsocketEvent {
  name: string;
  direction: 'server-to-client' | 'client-to-server';
  description: string;
}

export interface DeveloperApiDocWebsocket {
  title: string;
  scopeId: string;
  path: string;
  description: string;
  authentication: string;
  events: DeveloperApiDocWebsocketEvent[];
  exampleCode: string;
}

export interface DeveloperApiPublicSpec {
  specVersion: number;
  generatedAt: string;
  title: string;
  description: string;
  baseUrlTemplate: string;
  legacyBaseUrlTemplate: string;
  authentication: {
    description: string;
    headers: DeveloperApiDocHeader[];
  };
  rateLimiting: {
    description: string;
    defaultPerMinute: number;
    envVar: string;
  };
  endpoints: DeveloperApiDocEndpoint[];
  websockets: DeveloperApiDocWebsocket[];
}

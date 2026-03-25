export interface StartLlmServerRequest {}

export interface StartLlmServerResponse {
  warmed: boolean;
  fakeMode: boolean;
  serverRunning: boolean;
}

export interface StopLlmServerRequest {}

export interface StopLlmServerResponse {
  stopped: boolean;
  hasRuntime: boolean;
  serverRunning: boolean;
}

export interface GetLlmServerStatusRequest {}

export interface GetLlmServerStatusResponse {
  hasRuntime: boolean;
  runtimeKey: unknown[] | null;
  serverRunning: boolean;
}

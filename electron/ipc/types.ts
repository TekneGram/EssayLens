export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: unknown, payload?: unknown) => unknown | Promise<unknown>
  ): void;
}

declare module "playwright" {
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<{
      newContext(opts?: Record<string, unknown>): Promise<{
        addInitScript(script: string | { path: string }): Promise<void>;
        newPage(): Promise<Record<string, unknown>>;
        close(): Promise<void>;
      }>;
      close(): Promise<void>;
      isConnected(): boolean;
    }>;
  };
}

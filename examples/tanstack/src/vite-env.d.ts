/// <reference types="vite-plus/client" />

declare module "*.css?url" {
  const content: string;
  export default content;
}

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input?: unknown) => unknown | Promise<unknown>;
}

interface Navigator {
  modelContext?: {
    registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void;
    provideContext?: (context: { tools: WebMcpTool[] }, options?: { signal?: AbortSignal }) => void;
  };
}

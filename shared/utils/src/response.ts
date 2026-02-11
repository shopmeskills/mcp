/**
 * Create a standard MCP text content response.
 */
export function createTextResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Create a standard MCP error response.
 */
export function createErrorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// Minimal JSON-RPC 2.0 server over stdio with LSP-style Content-Length framing,
// which is what tsc uses to talk to content mapper processes.

type Handler = (params: unknown) => unknown | Promise<unknown>;

export function serve(handlers: Record<string, Handler>): void {
  let buffer = Buffer.alloc(0);

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) throw new Error(`Bad header: ${header}`);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      buffer = buffer.subarray(bodyStart + length);
      void dispatch(JSON.parse(body));
    }
  });

  async function dispatch(message: { id?: number | string; method: string; params?: unknown }) {
    const handler = handlers[message.method];
    let response: Record<string, unknown>;
    try {
      if (!handler) throw new Error(`Unknown method ${message.method}`);
      const result = await handler(message.params);
      response = { jsonrpc: "2.0", id: message.id, result: result ?? {} };
    } catch (error) {
      response = {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32603, message: error instanceof Error ? error.stack ?? error.message : String(error) },
      };
    }
    if (message.id === undefined) return;
    const payload = Buffer.from(JSON.stringify(response), "utf8");
    process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
    process.stdout.write(payload);
  }
}

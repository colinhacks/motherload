import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { ROOT } from "./helpers.ts";

/** Talks to the mapper process over its JSON-RPC framing, as tsc does. */
function client() {
  const child = spawn(process.execPath, ["src/mapper.ts"], { cwd: ROOT, stdio: ["pipe", "pipe", "inherit"] });
  let buffer = Buffer.alloc(0);
  const waiting = new Map<number, (value: any) => void>();
  child.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) return;
      const length = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, end).toString())![1]);
      if (buffer.length < end + 4 + length) return;
      const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString());
      buffer = buffer.subarray(end + 4 + length);
      waiting.get(message.id)?.(message);
    }
  });
  let id = 0;
  return {
    call(method: string, params: unknown): Promise<any> {
      const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }));
      child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
      child.stdin.write(body);
      return new Promise((resolve) => waiting.set(id, resolve));
    },
    close: () => child.kill(),
  };
}

test("the mapper answers the protocol, reports options and places errors in UTF-8 bytes", async () => {
  const mapper = client();
  try {
    const init = await mapper.call("initialize", { protocolVersion: 1 });
    assert.deepEqual(init.result, { protocolVersion: 1, positionEncoding: "utf-8", diagnosticSource: "motherload" });
    const open = await mapper.call("openProject", { configFileName: `${ROOT}tsconfig.json`, projectHandle: "p", compilerOptions: {}, options: { literal: true } });
    assert.equal(open.result.optionDiagnostics[0].path[0], "literal");
    const ok = await mapper.call("transform", { fileName: `${ROOT}x.toml`, content: "a = 1\n", projectHandle: "p" });
    assert.equal(ok.result.extension, ".ts");
    assert.match(ok.result.text, /declare const data: \{ a: number \};/);
    // "é" is two bytes in UTF-8: the error after it starts one byte later than its UTF-16 offset.
    const content = 'name = "é"\nport = nope\n';
    const bad = await mapper.call("transform", { fileName: `${ROOT}x.toml`, content, projectHandle: "p" });
    assert.equal(bad.result.diagnostics[0].start, Buffer.byteLength(content.slice(0, content.indexOf("nope"))));
    const unknown = await mapper.call("transform", { fileName: `${ROOT}x.ini`, content: "", projectHandle: "p" });
    assert.match(unknown.result.diagnostics[0].messageText, /Motherload reads/);
  } finally {
    mapper.close();
  }
});

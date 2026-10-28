import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { ROOT } from "./helpers.ts";

/** Talks to a package's mapper process over its JSON-RPC framing, as tsc does: `motherload`'s, or a format package's in `packages/`. */
function client(cwd = ROOT) {
  const child = spawn(process.execPath, ["src/mapper.ts"], { cwd, stdio: ["pipe", "pipe", "inherit"] });
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
    assert.equal(ok.result.extension, ".mts");
    assert.match(ok.result.text, /declare const data: \{ readonly a: 1 \};/);
    // "é" is two bytes in UTF-8: the error after it starts one byte later than its UTF-16 offset.
    const content = 'name = "é"\nport = nope\n';
    const bad = await mapper.call("transform", { fileName: `${ROOT}x.toml`, content, projectHandle: "p" });
    assert.equal(bad.result.diagnostics[0].start, Buffer.byteLength(content.slice(0, content.indexOf("nope"))));
    // A syntax error at the end of a cut-off or empty text stays within it: TypeScript refuses a
    // response whose diagnostic runs past the end (TS18069), so one at the end is empty.
    for (const [name, text] of [["x.toml", 'name = "é"\nport = '], ["x.yaml", "name: é\nports: [80,\n"], ["x.jsonc", '{ "name": "é",\n'], ["x.json5", "{ name: 'é',\n"], ["x.jsonc", ""], ["x.json5", ""]] as const) {
      const cut = await mapper.call("transform", { fileName: `${ROOT}${name}`, content: text, projectHandle: "p" });
      assert.ok(cut.result.diagnostics.length > 0, `${name} ${JSON.stringify(text)}`);
      for (const diagnostic of cut.result.diagnostics) {
        assert.equal(diagnostic.code, 1);
        assert.deepEqual([diagnostic.start, diagnostic.length], [Buffer.byteLength(text), 0], `${name} ${JSON.stringify(text)}: ${diagnostic.messageText}`);
      }
    }
    const unknown = await mapper.call("transform", { fileName: `${ROOT}x.ini`, content: "", projectHandle: "p" });
    assert.match(unknown.result.diagnostics[0].messageText, /Motherload reads/);
  } finally {
    mapper.close();
  }
});

test("the mapper takes `strict` as true or false and reports any other option; a package that reads no .env file takes none", async () => {
  const open = async (mapper: ReturnType<typeof client>, options: Record<string, unknown>) =>
    (await mapper.call("openProject", { configFileName: `${ROOT}tsconfig.json`, projectHandle: "p", compilerOptions: {}, options })).result.optionDiagnostics.map((d: any) => [d.path[0], d.messageText]);
  for (const cwd of [ROOT, `${ROOT}packages/env`]) {
    const mapper = client(cwd);
    try {
      await mapper.call("initialize", { protocolVersion: 1 });
      assert.deepEqual(await open(mapper, { strict: false }), []);
      assert.deepEqual(await open(mapper, { strict: true }), []);
      assert.deepEqual(await open(mapper, { strict: "no", literal: true }), [
        ["strict", 'Motherload\'s "strict" option is true or false, not "no".'],
        ["literal", 'Motherload takes one option, "strict"; remove "literal".'],
      ]);
    } finally {
      mapper.close();
    }
  }
  const toml = client(`${ROOT}packages/toml`);
  try {
    await toml.call("initialize", { protocolVersion: 1 });
    assert.deepEqual(await open(toml, { strict: false }), [["strict", 'Motherload takes no options; remove "strict".']]);
  } finally {
    toml.close();
  }
});

test("a format package's own mapper reads its format and names it for any other extension", async () => {
  const mapper = client(`${ROOT}packages/toml`);
  try {
    const init = await mapper.call("initialize", { protocolVersion: 1 });
    assert.equal(init.result.diagnosticSource, "motherload");
    await mapper.call("openProject", { configFileName: `${ROOT}tsconfig.json`, projectHandle: "p", compilerOptions: {} });
    const ok = await mapper.call("transform", { fileName: `${ROOT}x.toml`, content: "a = 1\n", projectHandle: "p" });
    assert.match(ok.result.text, /declare const data: \{ readonly a: 1 \};/);
    const other = await mapper.call("transform", { fileName: `${ROOT}x.yaml`, content: "a: 1\n", projectHandle: "p" });
    assert.equal(other.result.diagnostics[0].messageText, `@motherload/toml reads .toml files; ${ROOT}x.yaml is none of them. Remove its extension from @motherload/toml's contentMappers entry.`);
  } finally {
    mapper.close();
  }
});

// A Turbopack loader that runs on fumadocs-mdx's output in `next dev` only (`withDocsKit`, next.mjs). It
// changes nothing the page renders; it keeps the dev server's memory flat across edits.
//
// It gives the compiled page a source map that names the `.mdx` file and ignore-lists it. In
// development, React's Flight client rebuilds the stack of every element a Server Component
// renders: for each distinct frame it evals a stand-in function whose source is padded with one
// newline per line above the frame and ends with the frame's `//# sourceMappingURL`, and it keeps
// every one in a cache that is never cleared (as Node keeps a per-line table of each). On
// 2026-10-11 Reylo's page compiled to about 35,000 JSX calls on 178,000 lines, so its frames cost
// gigabytes, and every edit that moves the code makes a new set. Worse, after an edit server Fast
// Refresh runs the page's new code under a `file://…?id=` URL that Next.js does not map to the
// chunk's `.map` file, so Next.js inlines the page's whole source map (16.8 MB of base64) as that
// URL, and every stand-in carries a copy: `next dev` ran out of an 8 GB heap on the first render
// after an edit. Next.js leaves out of those stacks the frames of a module whose source map
// ignore-lists all of its sources (filterStackFrameDEV in next/dist/server/lib/source-maps.js), and
// Turbopack keeps the map a loader returns. The map has no mappings: fumadocs-mdx makes none, and
// without this loader Turbopack mapped the page onto its own 8.7-million-character compiled output,
// which no reader of a stack trace wants either.
//
// It also makes the code smaller, because Next.js keeps several copies of it in memory, and one
// more after each edit while a browser has the page open (React's async debug tracking holds on to
// the previous render). Turbopack writes each call of an imported function as a 370-character
// reference to its module, so the page's `_jsx(…)` calls took 13 million characters: the JSX
// runtime is imported once into local constants instead. And V8 stores a string with any character
// above U+00FF at two bytes per character: the page's few such characters are written as `\uXXXX`
// escapes, which mean the same characters in the string literals MDX writes. A copy went from 70 MB
// to 21 MB (and to 9 MB once mdx/recma-shared-popups.ts built each popup once).

const JSX_RUNTIME = /^import \{([^}]*)\} from "react\/jsx-runtime";$/m;

export default function mdxDevLoader(source, map) {
  const code = source
    .replace(JSX_RUNTIME, (_, names) => {
      const constants = names.split(',').map((name) => {
        const [imported, local = imported] = name.trim().split(/\s+as\s+/);
        return `${local} = _jsxRuntime.${imported}`;
      });
      return `import * as _jsxRuntime from "react/jsx-runtime"; const ${constants.join(', ')};`;
    })
    .replace(/[\u0100-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const input = typeof map === 'string' ? JSON.parse(map) : map;
  const output = input?.mappings
    ? { ...input, ignoreList: input.sources.map((_, i) => i) }
    : { version: 3, sources: [this.resourcePath], names: [], mappings: '', ignoreList: [0] };
  this.callback(null, code, output);
}

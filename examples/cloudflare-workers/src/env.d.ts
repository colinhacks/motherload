// The Worker's main module, the type of `exports` in the tests.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./worker");
  }
}

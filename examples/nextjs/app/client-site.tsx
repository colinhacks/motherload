"use client";

// A client component: the data files' modules are bundled into the browser's code too.
import { site } from "../site";

export function ClientSite() {
  return <pre id="client">{JSON.stringify(site())}</pre>;
}

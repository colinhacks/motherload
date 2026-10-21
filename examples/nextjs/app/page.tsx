// A server component: the data files' values are rendered on the server, into the prerendered page.
import config from "../config.toml";
import { site } from "../site";
import { ClientSite } from "./client-site";

// @ts-expect-error config.toml has no `missing` key
config.missing;

export default function Page() {
  return (
    <main>
      <pre id="server">{JSON.stringify(site())}</pre>
      <ClientSite />
    </main>
  );
}

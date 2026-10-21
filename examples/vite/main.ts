import { site } from "./site.ts";

document.querySelector("#site")!.textContent = JSON.stringify(site());

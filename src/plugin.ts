// motherload as one loader: every format's package behind one mapper, one preload and one
// plugin, each path going to the format that claims its longest suffix.
import { combine } from "@motherload/core";
import { loader as toml } from "@motherload/toml/loader";
import { loader as yaml } from "@motherload/yaml/loader";
import { loader as json5 } from "@motherload/json5/loader";
import { loader as jsonc } from "@motherload/jsonc/loader";
import { loader as env } from "@motherload/env/loader";
import { loader as csv } from "@motherload/csv/loader";
import { loader as txt } from "@motherload/txt/loader";
import { loader as md } from "@motherload/md/loader";

/** Each format's loader, in the order Motherload's messages name their extensions. */
export const loaders = [toml, yaml, json5, jsonc, env, csv, txt, md];

export const plugin = combine("motherload", "Motherload", loaders);

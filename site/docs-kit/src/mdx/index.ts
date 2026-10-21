// The build-time half of docs-kit: everything here runs while the page compiles, never in the app.
// fumadocs-mdx imports it in Node itself, from the site's source.config.ts, and Node's ES module loader
// resolves no relative import without its extension, so these modules name theirs (`./options.ts`); a site's
// tsconfig sets `allowImportingTsExtensions` for its type check to accept them.
export { docsMdxOptions, type DocsMdxOptions } from './options.ts';
export { docsTwoslash, mountPackage, twoslashOptions, type DocsTwoslashOptions, type MountedPackage } from './twoslash.ts';
export { pageMarkdown, remarkSections, toAgentMarkdown } from './remark-sections.ts';
export { recmaSharedPopups } from './recma-shared-popups.ts';
export { hangingIndent } from './hanging-indent.ts';

// The build-time half of docs-kit: everything here runs while the page compiles, never in the app.
// `next dev` has fumadocs-mdx's loader import it in Node itself, whose ES module loader resolves no
// relative import without its extension, so these modules name theirs (`./options.ts`); a site's
// tsconfig sets `allowImportingTsExtensions` for its type check to accept them.
export { docsMdxOptions, type DocsMdxOptions } from './options.ts';
export { docsTwoslash, mountPackage, twoslashOptions, type DocsTwoslashOptions, type MountedPackage } from './twoslash.ts';
export { remarkSections, toAgentMarkdown } from './remark-sections.ts';
export { recmaSharedPopups } from './recma-shared-popups.ts';
export { hangingIndent } from './hanging-indent.ts';

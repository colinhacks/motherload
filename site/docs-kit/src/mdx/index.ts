// The build-time half of docs-kit: everything here runs while the page compiles, never in the app.
export { docsMdxOptions, type DocsMdxOptions } from './options';
export { docsTwoslash, mountPackage, twoslashOptions, type DocsTwoslashOptions, type MountedPackage } from './twoslash';
export { remarkSections, toAgentMarkdown } from './remark-sections';
export { recmaSharedPopups } from './recma-shared-popups';
export { hangingIndent } from './hanging-indent';

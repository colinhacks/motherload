import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * A hash of the text of the image's route (app/routes/opengraph-image.tsx), for the image's URL in
 * the meta tags, so that a change to the card changes the URL and the caches of X and Slack fetch the
 * new card. Read at build time, by the pages' loaders.
 */
export async function ogHash(): Promise<string> {
  return createHash('sha256').update(await readFile('app/routes/opengraph-image.tsx')).digest('hex').slice(0, 16);
}

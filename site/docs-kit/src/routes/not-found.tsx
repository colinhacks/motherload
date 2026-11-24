// `/404`, rendered to a file at build time, which the host serves for an address the site does not
// have (`404.html`, react-router.config.ts).
import { NotFound } from '../components/not-found';

export function meta() {
  return [{ title: '404: This page could not be found.' }, { name: 'robots', content: 'noindex' }];
}

export default function Missing() {
  return <NotFound />;
}

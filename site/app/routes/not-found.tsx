import type { Route } from './+types/not-found';
import { NotFound } from '@/components/not-found';

// The page a missing address gets. Rendered to build/client/404/index.html and copied to
// build/client/404.html (react-router.config.ts), which Vercel serves, with a 404, for any path the
// site does not have.
export const meta: Route.MetaFunction = () => [{ title: '404: This page could not be found.' }, { name: 'robots', content: 'noindex' }];

export default function Missing() {
  return <NotFound />;
}

// `/manifest.webmanifest`: the site as a web app, named, in its colour, with the 192 and 512 pixel
// icons of `public/`.
import site from '@/docs.config';

export function loader() {
  const manifest = {
    name: site.name,
    short_name: site.name,
    ...(site.description ? { description: site.description } : {}),
    start_url: '/',
    display: 'browser',
    ...(site.color ? { background_color: site.color, theme_color: site.color } : {}),
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } });
}

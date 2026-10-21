// For a browser that saves the site to a home screen: the name and the tile (public/icon-192.png
// and public/icon-512.png, the gold bars of public/icon.svg on the dark page's coal), on the dark
// page's own background. Written to build/client/manifest.webmanifest.
export function loader() {
  const manifest = {
    name: 'Motherload',
    short_name: 'Motherload',
    description: 'Import data files into TypeScript as typed modules.',
    start_url: '/',
    display: 'browser',
    background_color: '#0D0E10',
    theme_color: '#0D0E10',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } });
}

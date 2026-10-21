import type { MetadataRoute } from 'next';

// For a browser that saves the site to a home screen: the name and the tile (public/icon-192.png
// and public/icon-512.png, the gold bars of app/icon.svg on the dark page's coal), on the dark
// page's own background.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
}

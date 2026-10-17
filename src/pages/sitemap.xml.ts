import { decisions, companions } from '../lib/content';
export function GET() {
  const paths = [
    '/',
    '/about/',
    ...decisions.map((item) => item.path),
    ...companions.map((item) => item.path),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>https://adr.stephens.page${path}</loc></url>`).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}

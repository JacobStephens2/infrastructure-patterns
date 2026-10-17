import { readFileSync } from 'node:fs';
export function GET() {
  return new Response(
    new Uint8Array(readFileSync('observability/app-service.png')),
    { headers: { 'Content-Type': 'image/png' } },
  );
}

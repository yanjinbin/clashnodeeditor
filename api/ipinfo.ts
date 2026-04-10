/**
 * Vercel Edge Function: IP quality proxy → ip-api.com
 *
 * GET  /api/ipinfo?ip=1.2.3.4          → single IP
 * POST /api/ipinfo   body: ["1.2.3.4"] → batch (max 100)
 */
export const config = { runtime: 'edge' }

const FIELDS = 'status,country,countryCode,city,lat,lon,isp,proxy,hosting,query'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'max-age=3600',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    if (request.method === 'POST') {
      const ips: string[] = await request.json()
      const batch = ips.slice(0, 100)
      const res = await fetch(`http://ip-api.com/batch?fields=${FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      const data = await res.json()
      return Response.json(data, { headers: CORS })
    }

    const ip = new URL(request.url).searchParams.get('ip')
    if (!ip) return Response.json({ error: 'missing ip' }, { status: 400, headers: CORS })
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${FIELDS}`)
    const data = await res.json()
    return Response.json(data, { headers: CORS })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502, headers: CORS })
  }
}

/**
 * Vercel Edge Function: CORS-free subscription proxy
 * GET /api/proxy?url=<encoded_url>
 *
 * Runs on Vercel's edge network — transparent, auditable, no third-party dependency.
 */
export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('url')

  if (!target) {
    return new Response('Missing "url" query parameter', { status: 400 })
  }

  // Only allow http/https URLs
  let targetUrl: URL
  try {
    targetUrl = new URL(target)
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return new Response('Only http/https URLs are allowed', { status: 400 })
    }
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  const ua = searchParams.get('ua') || 'clash-verge/v2.2.3'

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        Accept: 'text/plain,application/x-yaml,text/yaml,*/*',
        'User-Agent': ua,
      },
    })

    const text = await upstream.text()

    const subInfo = upstream.headers.get('Subscription-Userinfo') ?? ''

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
    if (subInfo) {
      responseHeaders['X-Subscription-Userinfo'] = subInfo
      responseHeaders['Access-Control-Expose-Headers'] = 'X-Subscription-Userinfo'
    }

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (err) {
    return new Response(`Upstream fetch failed: ${(err as Error).message}`, { status: 502 })
  }
}

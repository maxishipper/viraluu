/**
 * Cloudflare Worker for go.vira.lu Short Links
 * 
 * This worker intercepts requests to go.vira.lu
 * and calls your Supabase redirect Edge Function
 */

const SUPABASE_FUNCTION_URL = 'https://rcdomqahdxcjqhaumhrh.supabase.co/functions/v1/redirect';
const SHORT_DOMAIN = 'go.vira.lu';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only handle requests to go.vira.lu
    if (url.hostname !== SHORT_DOMAIN) {
      return new Response('Invalid domain', { status: 400 });
    }

    // Extract the short key from the path
    const shortKey = url.pathname.slice(1); // Remove leading slash
    
    if (!shortKey) {
      // No key provided, show a landing page or redirect to main site
      return Response.redirect('https://vira.lu', 302);
    }

    try {
      // Call the Supabase redirect function
      const redirectUrl = new URL(SUPABASE_FUNCTION_URL);
      redirectUrl.searchParams.set('host', SHORT_DOMAIN);
      redirectUrl.searchParams.set('key', shortKey);

      // Forward all query parameters (for UTM tracking, etc.)
      url.searchParams.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });

      const response = await fetch(redirectUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': request.headers.get('User-Agent') || '',
          'Referer': request.headers.get('Referer') || '',
          'CF-Connecting-IP': request.headers.get('CF-Connecting-IP') || '',
          'CF-IPCountry': request.headers.get('CF-IPCountry') || '',
        },
      });

      // The Edge Function returns a 302 redirect
      // We need to follow it and return to the user
      if (response.redirected) {
        return Response.redirect(response.url, 302);
      }

      // If not a redirect, check for Location header
      const location = response.headers.get('Location');
      if (location) {
        return Response.redirect(location, 302);
      }

      // If no redirect, something went wrong
      if (response.status === 404) {
        return new Response('Link not found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      return new Response('Service unavailable', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
};

/**
 * ALTERNATIVE: Simplified version without calling Edge Function
 * 
 * If you want to handle everything in the Worker:
 * 
 * 1. Install @supabase/supabase-js in your Worker
 * 2. Store SUPABASE_URL and SUPABASE_ANON_KEY as Worker secrets
 * 3. Query the database directly in the Worker
 * 4. Return the redirect
 * 
 * This approach is faster (one less hop) but requires more setup.
 */

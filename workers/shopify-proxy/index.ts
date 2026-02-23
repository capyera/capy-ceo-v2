/**
 * Cloudflare Worker - Shopify API Proxy
 * 
 * Handles CORS and authentication for Shopify Admin API calls.
 * Deploy to Cloudflare Workers and set the SHOPIFY_ACCESS_TOKEN secret.
 * 
 * Environment Variables (set in Cloudflare dashboard):
 * - SHOPIFY_ACCESS_TOKEN: The Shopify Admin API access token
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins (optional)
 */

const SHOPIFY_STORE = '152919-65.myshopify.com';
const API_VERSION = '2024-01';

interface Env {
  SHOPIFY_ACCESS_TOKEN: string;
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace('/api/shopify', '');
    
    // Validate the path
    if (!path || path === '/') {
      return new Response(JSON.stringify({ 
        error: 'Invalid endpoint',
        usage: '/api/shopify/{endpoint}' 
      }), {
        status: 400,
        headers: corsHeaders(request, env),
      });
    }

    // Build Shopify API URL
    const shopifyUrl = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}${url.search}`;

    try {
      const response = await fetch(shopifyUrl, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': env.SHOPIFY_ACCESS_TOKEN,
        },
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      // Clone response and add CORS headers
      const data = await response.text();
      
      return new Response(data, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...corsHeaders(request, env),
          'Content-Type': 'application/json',
          // Forward pagination headers
          ...(response.headers.get('Link') ? { 'Link': response.headers.get('Link')! } : {}),
        },
      });
    } catch (error) {
      console.error('Shopify API error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: corsHeaders(request, env),
      });
    }
  },
};

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
    'https://capyera.github.io',
    'http://localhost:5173',
    'http://localhost:4173',
  ];

  const allowOrigin = allowedOrigins.includes(origin) || allowedOrigins.includes('*')
    ? origin 
    : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCORS(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env),
  });
}

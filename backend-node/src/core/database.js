import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import config from './config.js';

// Polyfill global WebSocket for Node.js environments
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

let supabaseClient = null;

export const getSupabase = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = config;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment');
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });

  return supabaseClient;
};

// Test helper to allow injecting mock Supabase client
export const setSupabaseClient = (client) => {
  supabaseClient = client;
};

export const resetSupabaseClient = () => {
  supabaseClient = null;
};

// Proxy export for direct usage: `supabase.table(...)`
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default supabase;

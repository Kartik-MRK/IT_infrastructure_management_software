import dotenv from 'dotenv';
dotenv.config();

const corsEnv = process.env.CORS_ORIGINS || '';
const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://itims.kartik-mrk.me',
  'http://itims.kartik-mrk.me',
];

const parsedCorsOrigins = [
  ...defaultCorsOrigins,
  ...corsEnv.split(',').map((o) => o.trim()).filter(Boolean),
];

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Secret Keys
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || 'your-secret-key-change-this',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  // Email / SMTP Configuration
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SERVER: process.env.SMTP_SERVER || 'smtp.resend.com',
  SMTP_USE_SSL: process.env.SMTP_USE_SSL !== 'false',
  SMTP_USE_TLS: process.env.SMTP_USE_TLS === 'true',
  SMTP_USERNAME: process.env.SMTP_USERNAME || 'resend',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_DEFAULT_SENDER: process.env.SMTP_DEFAULT_SENDER || 'ITIMS Support <auth@mail.kartik-mrk.me>',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,

  // CORS Configuration
  CORS_ORIGINS: parsedCorsOrigins,
};

export default config;

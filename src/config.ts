import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/backlink_exchange',
};
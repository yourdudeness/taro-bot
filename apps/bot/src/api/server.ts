import Fastify from 'fastify';
import { config } from '../config.js';

export async function startApi() {
  const app = Fastify({ logger: true });
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

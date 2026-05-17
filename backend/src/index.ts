import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';

const port = process.env.PORT || 3000;

const app = new Elysia()
  .use(cors())
  .get('/', () => ({ status: 'ready' }))
  .listen(port);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

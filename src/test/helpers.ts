import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { tournamentRoutes } from '../routes/tournaments.ts';
import { playerRoutes } from '../routes/players.ts';

// Test server helper that builds server without auto-start
export async function createTestServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false }); // Disable logging in tests

  // Register routes
  await server.register(tournamentRoutes);
  await server.register(playerRoutes);

  // Add health check
  server.get('/health', async (request, reply) => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  // Ensure the server is ready for testing
  await server.ready();

  return server;
}

// Helper to close test server
export async function closeTestServer(server: FastifyInstance): Promise<void> {
  await server.close();
}

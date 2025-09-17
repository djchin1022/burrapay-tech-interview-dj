import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { FastifyInstance } from 'fastify'
import supertest from 'supertest'
import { createTestServer, closeTestServer } from './helpers.ts'
import { storage } from '../storage/index.ts'
import { clearPokemonCache } from '../routes/players.ts'

describe('Pokemon Tournament API Integration Tests', () => {
  let server: FastifyInstance
  let request: any

  beforeAll(async () => {
    server = await createTestServer()
    request = supertest(server.server)
  })

  afterAll(async () => {
    await closeTestServer(server)
  })

  beforeEach(() => {
    // Clear storage between tests
    storage.tournaments.clear()
    storage.players.clear()
    clearPokemonCache()
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request
        .get('/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'OK',
        timestamp: expect.any(String)
      })
    })
  })

  describe('Tournament Management', () => {
    it('should create a new tournament', async () => {
      const tournamentData = { name: 'Pokemon Championship' }

      const response = await request
        .post('/tournaments')
        .send(tournamentData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Pokemon Championship',
        createdAt: expect.any(String)
      })

      // Verify tournament is stored
      expect(storage.tournaments.size).toBe(1)
    })

    it('should handle empty tournament name', async () => {
      const tournamentData = { name: '' }

      const response = await request
        .post('/tournaments')
        .send(tournamentData)
        .expect(201) // createTournament doesn't validate empty names in current implementation

      expect(response.body.name).toBe('')
    })

    it("should list all tournaments", async () => {
        // Create two tournaments first
        const t1 = await request
          .post("/tournaments")
          .send({ name: "Tournament One" })
          .expect(201);
        const t2 = await request
          .post("/tournaments")
          .send({ name: "Tournament Two" })
          .expect(201);

        // Call GET /tournaments
        const response = await request
          .get("/tournaments")
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);

        // Verify structure
        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: t1.body.id,
                    name: "Tournament One",
                    createdAt: expect.any(String),
                }),
                expect.objectContaining({
                    id: t2.body.id,
                    name: "Tournament Two",
                    createdAt: expect.any(String),
                }),
            ])
        );
    });
  })

  describe('Pokemon Player Management', () => {
    let tournamentId: string

    beforeEach(async () => {
      // Create a tournament for player tests
      const tournamentResponse = await request
        .post('/tournaments')
        .send({ name: 'Test Tournament' })
        .expect(201)

      tournamentId = tournamentResponse.body.id
    })

    it('should add a valid Pokemon as player', async () => {
      const playerData = { name: 'pikachu' }

      const response = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(playerData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'pikachu',
        tournamentId: tournamentId
      })

      // Verify player is stored with Pokemon data
      const players = Array.from(storage.players.values())
      expect(players).toHaveLength(1)
      expect(players[0]).toMatchObject({
        name: 'pikachu',
        tournamentId: tournamentId,
        pokemonData: {
          id: expect.any(Number),
          types: expect.any(Array),
          height: expect.any(Number),
          weight: expect.any(Number)
        }
      })
    })

    it('should reject invalid Pokemon names', async () => {
      const playerData = { name: 'InvalidPokemon123' }

      const response = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(playerData)
        .expect(400)

      expect(response.body).toMatchObject({
        error: 'Name is not a valid Pokemon'
      })

      // Verify no player was stored
      expect(storage.players.size).toBe(0)
    })

    it('should reject regular human names', async () => {
      const playerData = { name: 'Ash Ketchum' }

      const response = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(playerData)
        .expect(400)

      expect(response.body).toMatchObject({
        error: 'Name is not a valid Pokemon'
      })

      expect(storage.players.size).toBe(0)
    })

    it('should handle tournament not found', async () => {
      const invalidTournamentId = 'non-existent-tournament-id'
      const playerData = { name: 'pikachu' }

      const response = await request
        .post(`/tournaments/${invalidTournamentId}/players`)
        .send(playerData)
        .expect(404)

      expect(response.body).toMatchObject({
        error: 'Tournament not found'
      })
    })

    it('should add multiple Pokemon to the same tournament', async () => {
      const pokemon1 = { name: 'pikachu' }
      const pokemon2 = { name: 'charizard' }

      // Add first Pokemon
      const response1 = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(pokemon1)
        .expect(201)

      // Add second Pokemon
      const response2 = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(pokemon2)
        .expect(201)

      expect(response1.body.name).toBe('pikachu')
      expect(response2.body.name).toBe('charizard')
      expect(storage.players.size).toBe(2)

      // Verify both players belong to same tournament
      const players = Array.from(storage.players.values())
      expect(players.every(p => p.tournamentId === tournamentId)).toBe(true)
    })

        it('should list all players of a tournament', async () => {
      // Add two players
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'pikachu' })
        .expect(201)

      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'charizard' })
        .expect(201)

      // Fetch players via GET
      const response = await request
        .get(`/tournaments/${tournamentId}/players`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body).toHaveLength(2)
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: 'pikachu',
            tournamentId: tournamentId,
          }),
          expect.objectContaining({
            id: expect.any(String),
            name: 'charizard',
            tournamentId: tournamentId,
          }),
        ])
      )
    })

    it('should return empty array if tournament has no players', async () => {
      const response = await request
        .get(`/tournaments/${tournamentId}/players`)
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('should return 404 if tournament does not exist', async () => {
      const response = await request
        .get('/tournaments/non-existent-id/players')
        .expect(404)

      expect(response.body).toMatchObject({
        error: 'Tournament not found'
      })
    })
  })

  describe('Pokemon API Integration', () => {
    let tournamentId: string

    beforeEach(async () => {
      const tournamentResponse = await request
        .post('/tournaments')
        .send({ name: 'Pokemon API Test Tournament' })

      tournamentId = tournamentResponse.body.id
    })

    it('should fetch and store Pokemon type information', async () => {
      const playerData = { name: 'charizard' }

      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(playerData)
        .expect(201)

      const players = Array.from(storage.players.values())
      const charizard = players.find(p => p.name === 'charizard')

      expect(charizard?.pokemonData.types).toContain('fire')
      expect(charizard?.pokemonData.types).toContain('flying')
      expect(charizard?.pokemonData.id).toBe(6) // Charizard's Pokedex number
    })

    it('should handle case-insensitive Pokemon names', async () => {
      const playerData = { name: 'PIKACHU' }

      const response = await request
        .post(`/tournaments/${tournamentId}/players`)
        .send(playerData)
        .expect(201)

      expect(response.body.name).toBe('PIKACHU')

      const players = Array.from(storage.players.values())
      const pikachu = players.find(p => p.name === 'PIKACHU')
      
      expect(pikachu?.pokemonData.types).toContain('electric')
      expect(pikachu?.pokemonData.id).toBe(25) // Pikachu's Pokedex number
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed request bodies', async () => {
      await request
        .post('/tournaments')
        .send({ invalidField: 'test' })
        .expect(400)
    })

    it('should handle missing request body', async () => {
      await request
        .post('/tournaments')
        .expect(400)
    })

    it('should handle network timeouts gracefully', async () => {
      // This test would require mocking the fetch function to simulate timeout
      // For now, we test with a very unusual Pokemon name that should fail quickly
      const tournamentResponse = await request
        .post('/tournaments')
        .send({ name: 'Network Test Tournament' })

      const tournamentId = tournamentResponse.body.id
      
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'definitely-not-a-pokemon-name-12345' })
        .expect(400)
    })
  })

  describe('Rate Limiting', () => {
    let tournamentId: string;

    beforeEach(async () => {
      const tournamentResponse = await request
        .post('/tournaments')
        .send({ name: 'Rate Limit Tournament' })
        .expect(201);

      tournamentId = tournamentResponse.body.id;
    });

    it('should queue extra Pokemon requests and still succeed', async () => {
      // Fire 20 add-player requests in parallel
      const responses = await Promise.all(
        Array.from({ length: 20 }).map(() =>
          request
            .post(`/tournaments/${tournamentId}/players`)
            .send({ name: 'pikachu' })
        )
      );

      // All should succeed (201), just throttled internally
      responses.forEach((res) => expect(res.status).toBe(201));

      // Verify storage has all 20 players
      expect(storage.players.size).toBe(20);
    })

    it('should handle burst requests sequentially (no more than 5 active at once)', async () => {
      // Warmup: measure single request duration
      const warmupStart = Date.now();
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'pikachu' }) // unique
        .expect(201);
      const avgSingle = Date.now() - warmupStart;

      const validPokemons = [
        'bulbasaur', 'ivysaur', 'venusaur',
        'charmander', 'charmeleon', 'charizard',
        'squirtle', 'wartortle', 'blastoise',
        'caterpie', 'metapod', 'butterfree',
        'weedle', 'kakuna', 'beedrill',
        'pidgey', 'pidgeotto', 'pidgeot',
        'rattata', 'raticate'
      ];

      // Burst: send 20 unique names so no cache kicks in
      const start = Date.now();
      const responses = await Promise.all(
        validPokemons.slice(0, 20).map((poke) =>
          request
            .post(`/tournaments/${tournamentId}/players`)
            .send({ name: poke })
        )
      );
      const elapsed = Date.now() - start;

      // Validate all requests succeeded
      responses.forEach((res) => expect(res.status).toBe(201));

      // Expected batches: ceil(20 / concurrencyLimit)
      const concurrencyLimit = 5;
      const batches = Math.ceil(20 / concurrencyLimit);
      const expectedMin = avgSingle * batches * 0.8; // allow 20% slack

      expect(elapsed).toBeGreaterThanOrEqual(expectedMin);
    })
  })

  describe('Pokemon Cache', () => {
    let tournamentId: string

    beforeEach(async () => {
      const tournamentResponse = await request
        .post('/tournaments')
        .send({ name: 'Cache Test Tournament' })
        .expect(201)

      tournamentId = tournamentResponse.body.id
    })

    it('should use cache for repeated Pokemon lookups', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')

      // First request → hits PokeAPI
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'pikachu' })
        .expect(201)

      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Second request with same Pokemon → cache hit, no new fetch
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'pikachu' })
        .expect(201)

      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Third request with different Pokemon → new fetch
      await request
        .post(`/tournaments/${tournamentId}/players`)
        .send({ name: 'charizard' })
        .expect(201)

      expect(fetchSpy).toHaveBeenCalledTimes(2)

      fetchSpy.mockRestore()
    })
  })
})
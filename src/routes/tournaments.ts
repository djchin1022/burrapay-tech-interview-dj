import { FastifyInstance } from "fastify";
import { pipe } from 'fp-ts/lib/function'
import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { CreateTournamentRequest, TournamentResponse } from "../types/index.ts";
import { createTournament, storage } from "../storage/index.ts";
import { validateTournamentInput } from "../validators";

export async function tournamentRoutes(fastify: FastifyInstance) {
    // Create tournament
    fastify.post<{ Body: CreateTournamentRequest }>("/tournaments", async (request, reply) => {
        const validation = validateTournamentInput(request.body);
        if (!validation.ok) {
            return reply.status(400).send({ error: validation.errorMessage });
        }
        const body = validation.value;
        // const result = createTournament(body.name.trim());

        return pipe(
            createTournament(body.name.trim()),
            E.fold(
                (error) => reply.status(400).send({ error: error }),
                (tournament) => {
                    const resp: TournamentResponse = {
                        id: tournament.id,
                        name: tournament.name,
                        createdAt: tournament.createdAt.toISOString(),
                    };
                    return reply.status(201).send(resp);
                }
            )
        );
    });

    // List tournaments
    fastify.get("/tournaments", async (request, reply) => {
        const items: TournamentResponse[] = Array.from(storage.tournaments.values()).map((t) => ({
            id: t.id,
            name: t.name,
            createdAt: t.createdAt.toISOString(),
        }));

        return reply.status(200).send(items);
    });
}

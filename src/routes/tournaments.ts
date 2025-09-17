import { FastifyInstance } from "fastify";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import { CreateTournamentRequest, TournamentResponse } from "../types/index.ts";
import { createTournament, storage } from "../storage/index.ts";

export async function tournamentRoutes(fastify: FastifyInstance) {
    // Create tournament
    fastify.post<{ Body: CreateTournamentRequest }>("/tournaments", async (request, reply) => {
        const body = request.body;
        if (!body || typeof body.name !== "string") {
            return reply.status(400).send({ error: "Tournament name is required" });
        }

        const result = createTournament(body.name.trim());

        return pipe(
            result,
            E.fold(
                (err) => reply.status(400).send({ error: err }),
                (t) => {
                    const resp: TournamentResponse = {
                        id: t.id,
                        name: t.name,
                        createdAt: t.createdAt.toISOString(),
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

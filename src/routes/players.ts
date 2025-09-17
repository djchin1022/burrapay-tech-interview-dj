import { FastifyInstance } from "fastify";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { CreatePlayerRequest, PokemonApiResponse } from "../types/index.ts";
import { createPlayer, getTournament, getPlayersByTournament } from "../storage/index.ts";

// Validate a pokemon name by calling PokeAPI and returning parsed shape
const validatePokemon = (name: string): TE.TaskEither<string, PokemonApiResponse> => {
    const normalized = name.trim().toLowerCase();
    return TE.tryCatch(
        async () => {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalized)}`);
            if (!res.ok) {
                // Normalize all invalid names into same message
                throw new Error("Name is not a valid Pokemon");
            }
            const json = (await res.json()) as PokemonApiResponse;
            // Basic structural validation (we rely on PokeAPI contract)
            if (typeof json.id !== "number" || !Array.isArray(json.types)) {
                throw new Error("Invalid Pokemon data from API");
            }
            return json as PokemonApiResponse;
        },
        () => "Name is not a valid Pokemon"
    );
};

export async function playerRoutes(fastify: FastifyInstance) {
    fastify.post<{
        Params: { tournamentId: string };
        Body: CreatePlayerRequest;
    }>("/tournaments/:tournamentId/players", async (request, reply) => {
        const tournamentId = request.params.tournamentId;
        const body = request.body;

        // Validate request body
        if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
            return reply.status(400).send({ error: "Player name is required" });
        }

        // Validate tournament exists
        const tournamentOpt = getTournament(tournamentId);
        if (O.isNone(tournamentOpt)) {
            return reply.status(404).send({ error: "Tournament not found" });
        }

        const playerName = body.name.trim();

        // Pipeline:
        // 1) validate pokemon via api (TaskEither<string, PokemonApiResponse>)
        // 2) map to storage.createPlayer (which returns Either<string, Player>)
        // 3) fold to send reply
        return pipe(
            validatePokemon(playerName),
            TE.chain((poke) => {
                const pokemonData = {
                    id: poke.id,
                    types: poke.types.map((t) => t.type.name),
                    height: poke.height,
                    weight: poke.weight,
                };

                const eitherPlayer = createPlayer(playerName, tournamentId, pokemonData);
                return TE.fromEither(eitherPlayer); // TaskEither<string, Player>
            }),
            TE.fold(
                (err) => async () => {
                    // Differentiate tournament-not-found vs pokemon/not allowed vs other errors
                    if (err === "Tournament not found") {
                        return reply.status(404).send({ error: err });
                    }
                    // For Pokemon not found or API errors, return 400
                    return reply.status(400).send({ error: err });
                },
                (player) => async () => {
                    // Return the Player object as created (Player type defined in types)
                    // We follow PlayerResponse shape (id, name, tournamentId)
                    return reply.status(201).send({
                        id: player.id,
                        name: player.name,
                        tournamentId: player.tournamentId,
                    });
                }
            )
        )();
    });

    fastify.get<{ Params: { tournamentId: string } }>("/tournaments/:tournamentId/players", async (request, reply) => {
        const { tournamentId } = request.params;
        const tournamentOpt = getTournament(tournamentId);

        if (O.isNone(tournamentOpt)) {
            return reply.status(404).send({ error: "Tournament not found" });
        }

        const players = getPlayersByTournament(tournamentId).map((p) => ({
            id: p.id,
            name: p.name,
            tournamentId: p.tournamentId,
        }));

        return reply.status(200).send(players);
    });
}

import * as t from "io-ts";
import { fold } from "fp-ts/lib/Either";

// 🔹 Common validation result type
type ValidationResult<A> = { ok: true; value: A } | { ok: false; errorMessage: string };

// ✅ Tournament codec
const CreateTournamentCodec = t.type({
    name: t.string,
});

// ✅ Player codec
const CreatePlayerCodec = t.type({
    name: t.string,
});

// 🔹 Validate tournament name
export function validateTournamentInput(input: unknown): ValidationResult<t.TypeOf<typeof CreateTournamentCodec>> {
    const result = CreateTournamentCodec.decode(input);

    return fold(
        (): ValidationResult<t.TypeOf<typeof CreateTournamentCodec>> => ({
            ok: false,
            errorMessage: "Tournament name is required",
        }),
        (value: t.TypeOf<typeof CreateTournamentCodec>): ValidationResult<t.TypeOf<typeof CreateTournamentCodec>> => {
            if (typeof value.name !== "string") {
                return { ok: false, errorMessage: "Tournament name is required" };
            }
            return { ok: true, value };
        }
    )(result);
}

// 🔹 Validate player name
export function validatePlayerInput(input: unknown): ValidationResult<t.TypeOf<typeof CreatePlayerCodec>> {
    const result = CreatePlayerCodec.decode(input);

    return fold(
        (): ValidationResult<t.TypeOf<typeof CreatePlayerCodec>> => ({
            ok: false,
            errorMessage: "Player name is required",
        }),
        (value: t.TypeOf<typeof CreatePlayerCodec>): ValidationResult<t.TypeOf<typeof CreatePlayerCodec>> => {
            if (!value.name || value.name.trim().length === 0) {
                return { ok: false, errorMessage: "Player name is required" };
            }
            return { ok: true, value };
        }
    )(result);
}

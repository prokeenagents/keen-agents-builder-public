// Voting: three IDENTICAL elements = three independent votes of one Voter flow.
// Each run sees only its element, so the listing travels inside it.
const VOTERS = 3;

export const exec = () => {
    dictionary.votes = Array.from({ length: VOTERS }, (_, i) => ({ n: i + 1, listing: dictionary.listing }));
    return { ok: true };
};

// The invalid-input path of a worker flow tool: the start already replied; only clean up.
// Key/Value Pair: key.
export async function exec(props) {
    delete dictionary[String(props.key)];
    return { ok: true };
}

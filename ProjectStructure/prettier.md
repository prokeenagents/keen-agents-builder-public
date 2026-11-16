# `.prettierrc` and `.prettierignore`

## Description

These two files configure Prettier. They make every script and JSON file in the project look the same however it was
written: by the builder, by a person, or by Shira's scaffold. `.prettierrc` holds the formatting rules, and
`.prettierignore` lists what Prettier must not touch.

Who reads them: only Prettier, run by a person or by the builder (`npm run format`), and VS Code's Prettier extension
when it formats on save. Shira, keen-validate, keen-deploy, the deploy service and the engines never read them, and they
are never uploaded.

This is a **house standard**. Shira's Create Project does not write these files, and no Keen tool checks formatting today.

## Location and name

- Paths: `<project root>/.prettierrc` and `<project root>/.prettierignore`. Never put them inside `src/`, because Shira
  would upload them.
- Optional for the platform. In a builder-made project (house standard), the builder creates both.
- `.prettierrc` is JSON with no extension. Do not also add a `prettier` key in `package.json` or a `prettier.config.js`:
  that is one configuration in two places.

## Structure

`.prettierrc` uses the same values as the Keen platform repos:

| Property | Required | What it means and what it is for |
|---|---|---|
| `semi` | Yes (house) | `true`: statements end with `;` |
| `singleQuote` | Yes (house) | `true`: `'text'` in JavaScript (JSON keeps double quotes) |
| `trailingComma` | Yes (house) | `"none"`: no comma after the last item |
| `tabWidth` | Yes (house) | `4`: 4-space indentation |
| `printWidth` | Yes (house) | `200`: long lines stay on one line |
| `bracketSpacing` | Yes (house) | `true`: `{ a }`, not `{a}` |
| `arrowParens` | Yes (house) | `"avoid"`: `x => x`, not `(x) => x` |
| `endOfLine` | Yes (house) | `"lf"`: LF line endings on every machine |

`.prettierignore` lists the files Prettier must leave alone:

| Line | Why |
|---|---|
| `src/flows/` | The canvas writes `.flow` files itself (JSON, 2-space indentation). Reformatting them causes churn on every save and an upload while Shira is connected. |
| `node_modules/` | Installed packages, not ours. |
| `package-lock.json` | npm writes it. |
| `.vscode/keen.json` | A local secrets file. No tool needs to open it. |

## Rules and validation

- No Keen tool checks formatting, and the deploy accepts code in any style.
- (house standard — not checked by any tool yet) Run `npm run format` before every `keen-validate` → `keen-deploy`.
  The builder writes 4-space, single-quote JavaScript from the start, so the format run changes nothing.
- (house standard — not checked by any tool yet) Never format `.flow` files by hand or with a tool. Edit them only
  through the canvas, or by writing them as JSON.

## Security

Neither file holds secrets. Both are committed.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `.prettierrc` placed in `src/` | Shira uploads it with the code | The project root |
| `src/flows/` left out of `.prettierignore` | A format run may reindent flows the canvas then rewrites, so the diffs never settle | List `src/flows/` |
| Comments or trailing commas in `.prettierrc` | Prettier fails to read its configuration | Plain JSON |
| `tabWidth: 2` | Scripts differ from the house style and from Shira's 4-space scaffold | `4` |
| Formatting with a global Prettier of another major version | Small output differences between machines | The project's own `prettier` from `devDependencies` |

## Example

`.prettierrc`:

```json
{
    "semi": true,
    "singleQuote": true,
    "trailingComma": "none",
    "tabWidth": 4,
    "printWidth": 200,
    "bracketSpacing": true,
    "arrowParens": "avoid",
    "endOfLine": "lf"
}
```

`.prettierignore`:

```
src/flows/
node_modules/
package-lock.json
.vscode/keen.json
```

# `package.json`

## Description

The project's Node package file. It names the project and marks its `.js` files as ES modules for local tools, such as
VS Code's JavaScript support and Prettier.

Who reads it:
- **Shira** checks only that it exists, because it is one of the five project markers.
- **keen-validate, keen-deploy, the deploy service, the engines:** none of them read it, and it is never uploaded
  (it sits outside `src/`).
- **People and npm**, when they run `npm install` / `npm run` for local tooling such as Prettier.

The platform runs every script as an ES module whatever this file says. The deploy scan parses each `.js` file as a
module, and scripts use `import` / `export const exec`. `"type": "module"` keeps local tools in step with that.

## Location and name

- Path: `<project root>/package.json`, beside `src/`, never inside it.
- Required, as a Shira project marker. Without it the project is not detected and Connect / Upload stay off.
- Created by Shira's **Create Project** as `{ name, version: "0.0.1", private: true, type: "module" }`, with `name` taken
  from the folder name. Otherwise the builder writes it.

## Structure

| Property | Required | What it means and what it is for |
|---|---|---|
| `name` | Yes (house) | The project's name. Shira copies the folder name, which may hold spaces or capitals that npm refuses. Write kebab-case (e.g. `support-agent`). |
| `version` | Yes (house) | `0.0.1` at the start. No tool reads it. Raise it when you release the project to others. |
| `private` | Yes (house) | `true`, so it can never be published to npm by mistake. |
| `type` | Yes (house) | `"module"`, so `.js` files are ES modules for Node and the editor, the same as on the platform. |
| `scripts` | No (house) | `format` / `format:check` running Prettier. There is no deploy script: deploying is Shira's Upload or `keen-deploy`. |
| `devDependencies` | No (house) | `prettier` only, for local formatting. |
| `dependencies` | Never | Scripts cannot use npm packages. Only `system/*` and relative imports are allowed, and packages are never uploaded. |

## Rules and validation

- Shira: a missing `package.json` means the project is not detected. It does not read the content.
- keen-validate, keen-deploy and the deploy service do not check this file.
- (house standard — not checked by any tool yet) Use exactly the properties above, indented with 4 spaces. Set no
  `main`, no `dependencies` and no deploy scripts. Commit `package-lock.json` when Prettier is installed.

## Security

No secrets. The file is committed. Never put a token or a password in a script line.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| The file is moved into `src/` | Shira no longer detects the project. Shira's Upload would also send it | Keep it in the project root |
| `"dependencies": { "axios": "…" }` and `import axios from 'axios'` | keen-validate errors, and the deploy scan refuses the import (`Unauthorized import "axios" …`) | `import Http from 'system/http'` |
| `"type": "commonjs"` or no `type` | The editor and Node read `export` as an error locally (the platform is unchanged) | `"type": "module"` |
| `"name": "My Agent"` | npm refuses the name when you install Prettier | `"name": "my-agent"` |
| `"scripts": { "deploy": "…" }` | Nothing calls it, and it misleads the next person | Deploy with Shira's Upload or `keen-deploy` |

## Example

```json
{
    "name": "support-agent",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "scripts": {
        "format": "prettier --write .",
        "format:check": "prettier --check ."
    },
    "devDependencies": {
        "prettier": "^3.9.10"
    }
}
```

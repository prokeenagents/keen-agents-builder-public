# `.vscode/settings.json`

## Description

The editor settings for this one project, in VS Code's workspace settings format. Shira (the VS Code extension) writes it
as an empty `{}` placeholder, and no Keen tool reads it. Only VS Code itself reads it, for whoever opens the folder.

`.flow` files open in Shira's canvas without anything set here, because Shira registers its own editor for `*.flow`.

## Location and name

- Path: `<project root>/.vscode/settings.json`.
- Optional: it is not one of Shira's project markers, so a project without it is still detected.
- Created by Shira's **Create Project** as `{}`. A builder writes it by hand, using the house content below.

## Structure

The file is a JSON object of VS Code settings, and every key is optional. The keys we use:

| Property | Required | What it means and what it is for |
|---|---|---|
| `editor.tabSize` | No (house) | `4` — 4-space indentation, the house code style |
| `editor.insertSpaces` | No (house) | `true` — spaces, never tabs |
| `editor.detectIndentation` | No (house) | `false` — VS Code does not guess the indentation from a file's content |
| `files.eol` | No (house) | `"\n"` — LF line endings, the same as Prettier's `endOfLine` |
| `editor.defaultFormatter` | No (house) | `"esbenp.prettier-vscode"` — Prettier formats `.js` and `.json` using `.prettierrc` |
| `editor.formatOnSave` | No (house) | `true` — every save is formatted the same way |
| `flowBuilder.aiModels` | No | Optional: a list of models that Shira only **counts** on the panel's **Models** chip — a JSON array as a string (a `models.json` paste), a comma-separated string of model names, or a real array. It never reaches the canvas: the LLM and Summarizer menus are the platform's own model list (24 models). It is usually set once in the user settings, if at all. |

`flowBuilder.theme` (`dark` / `light`) also exists, but Shira's **Toggle Theme** button writes it to the user settings,
not to this file.

## Rules and validation

- Shira, keen-validate, keen-deploy and the deploy service do not read or check this file. It is never uploaded.
- In Shira's panel, the Models chip shows `<N> model(s)`, `none` when `flowBuilder.aiModels` is empty, and
  `invalid JSON` when it cannot be read (broken JSON, a JSON value that is not an array, an object or a number).
- (house standard — not checked by any tool yet) Use the keys above in a builder-made project. Store no secrets and no
  machine paths here, because this file is committed.
- (house standard — not checked by any tool yet) Format-on-save never touches `.flow` files: the canvas writes them, and
  `.prettierignore` lists `src/flows/`.

## Security

This file holds no secrets. It is committed. Never move `keen.json` values into it.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"flowBuilder.aiModels": { … }` (an object) | the Models chip says `invalid JSON` | an array, a JSON array string or a comma list |
| Setting `flowBuilder.aiModels` to change the LLM node's models | Nothing changes on the canvas | Nothing to set: the canvas offers the platform's list |
| A `files.associations` entry mapping `*.flow` to `json` | A `.flow` file may open as text instead of in the canvas | No association; Shira registers the canvas editor |
| The deploy token or the password copied here | They get committed | Keep them in `.vscode/keen.json` only |
| Comments, when another tool must parse the file | VS Code accepts them, but a plain JSON reader fails | Plain JSON |

## Example

```json
{
    "editor.tabSize": 4,
    "editor.insertSpaces": true,
    "editor.detectIndentation": false,
    "files.eol": "\n",
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
}
```

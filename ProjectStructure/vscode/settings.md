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
| `flowBuilder.aiModels` | No | Shira's model catalogue: a JSON array of `{ id, model_name, params, company }` **written as a string**. In Shira 0.0.6 it feeds only the panel's **Models** chip — the canvas's model selector uses the list built into the canvas, not this setting. It is usually set once in the user settings. |

`flowBuilder.theme` (`dark` / `light`) also exists, but Shira's **Toggle Theme** button writes it to the user settings,
not to this file.

## Rules and validation

- Shira, keen-validate, keen-deploy and the deploy service do not read or check this file. It is never uploaded.
- In Shira's panel, the Models chip shows `invalid JSON` when `flowBuilder.aiModels` does not parse, and `none` when it
  is empty.
- (house standard — not checked by any tool yet) Use the keys above in a builder-made project. Store no secrets and no
  machine paths here, because this file is committed.
- (house standard — not checked by any tool yet) Format-on-save never touches `.flow` files: the canvas writes them, and
  `.prettierignore` lists `src/flows/`.

## Security

This file holds no secrets. It is committed. Never move `keen.json` values into it.

## Mistakes that break it

| Mistake | What happens | Write instead |
|---|---|---|
| `"flowBuilder.aiModels": [ … ]` (an array, not a string) | VS Code flags the wrong type and Shira cannot use the list | The array as one JSON string |
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

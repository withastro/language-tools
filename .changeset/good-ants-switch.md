---
'@astrojs/language-server': minor
'@astrojs/ts-plugin': minor
'astro-vscode': minor
---

Internally type Astro files individually instead of applying a specific configuration to every file loaded in the Astro language server, this should generally result in more accurate types when using JSX frameworks. But should generally be an invisible change for most users.

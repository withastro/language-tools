# Astro Language Tools

This repository contains all the editor tooling required for the [Astro](https://astro.build/) language (`.astro` files).

Notably, it contains an implementation of the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) which as of now is used for the [official VSCode Extension](https://marketplace.visualstudio.com/items?itemName=astro-build.astro-vscode) but could also be used to power a plugin for your favorite IDE in the future.

## Packages

### [`@astrojs/language-server`](packages/language-server)

The Astro language server, the structure is inspired by the [Svelte Language Server](https://github.com/sveltejs/language-tools).

### [`astro-vscode`](packages/vscode)

The official VS Code extension for Astro. This enables all of the editing features you depend on in VSCode.

Any time you open a `.astro` file these tools power editing functionality such as:

* [Go to Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition)
* Code hover hints
* Code completion
* Function signatures
* Syntax highlighting
* Code folding
* Emmet

## Contributing

Pull requests of any size and any skill level are welcome, no contribution is too small. Changes to the Astro Language Tools are subject to [Astro Governance](https://github.com/withastro/astro/blob/main/GOVERNANCE.md) and should adhere to the [Astro Style Guide](https://github.com/withastro/astro/blob/main/STYLE_GUIDE.md)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on how to setup your development environnement

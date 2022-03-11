# Language Server configuration

Between the Language Server config (that you can configure [through VS Code](https://code.visualstudio.com/docs/getstarted/settings) and other editors), the Astro project config and the TypeScript config, it can be really hard to understand what is meant in the source code by the word `config`

The truth is that most of the time, what is meant is the Language Server config. Notably, you might see the word config being thrown a lot in [the different plugins](plugins.md) to check if certain features are enabled

To facilitate accessing and updating the user's config, we use a class creatively named [ConfigManager](/packages/language-server/src/core/config/ConfigManager.ts)

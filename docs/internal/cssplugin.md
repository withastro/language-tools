# CSS Documents

When looking through [the different plugins](./plugins.md), you might notice that the CSS plugin seems weirdly complicated compared to the HTML or Astro one. After all, CSS is pretty simple right? Get the CSS, get completions (or other features) for it, send them back and we're done, right? Unfortunately, it's not that easy due to the nature of where you can find CSS in an `.astro` file.

Unlike HTML (which is everything that is under the frontmatter) and Astro (which is the entire file) or even TypeScript (which is the entire file, but converted to TSX first), CSS can find itself in multiple places at the same time, such as in multiple `<style>` tags but also in inline `style` tags in all kinds of elements. Because of that, we can't simply put a `css` field on our AstroDocuments, pass that to the CSSPlugin like we do for HTML and call it a day.

Instead, what we do is keep a list of style elements in our AstroDocument but we can't stop there because the CSS language service expect you to give it a full on Document, not just a string. So we have this little class called CSSDocument

# codepad

[![tests](https://github.com/ProBurakElci/codepad/actions/workflows/ci.yml/badge.svg)](https://github.com/ProBurakElci/codepad/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A code editor in your browser. Write something, press Run.**

### → [proburakelci.github.io/codepad](https://proburakelci.github.io/codepad/)

No account, no server, no build step, no dependencies. One HTML file, five small scripts, and a worker.

## What actually runs

This is the part most online editors are vague about, so here it is plainly.

| | |
|---|---|
| **JavaScript** | runs for real, in a Web Worker. `console.log`, objects, `Map`, `Set`, promises, errors and timings all come back to the output panel. |
| **Python** | runs for real, through [Pyodide](https://pyodide.org) — CPython compiled to WebAssembly. About 10 MB, downloaded from a CDN the first time you press Run, then cached by your browser. |
| **HTML** | rendered in a sandboxed `<iframe>`, scripts and all. |

**Fourteen more languages are highlighted, not run** — TypeScript, CSS, JSON, SQL, Java, C/C++, C#, Go, Rust, PHP, Ruby, Shell, YAML and Markdown. The menu marks the three that run with a ▸, and pressing Run on any of the others says so instead of pretending. Running Rust would mean shipping a Rust toolchain; that is a different project.

## The safety of it

- **JavaScript never runs in the page.** It runs in a worker, which has no `document`, no `window` and no access to this page's DOM or storage. The worst a snippet can do to the site around it is nothing.
- **Infinite loops are survivable.** There is no way to interrupt a busy loop in JavaScript, so after five seconds the page terminates the whole worker. `while (true) {}` stops the run instead of freezing the tab.
- **HTML previews are sandboxed** with `allow-scripts` but *without* `allow-same-origin`, so a preview can run its own scripts but cannot read this page, its storage, or anything of yours.
- **Nothing is uploaded.** No account, no analytics, no telemetry. Your code goes into the editor, and optionally into the address bar if you press Share.

## Sharing

**Share** puts the whole snippet inside the link, base64'd and made URL-safe, so it survives chat apps. There is no server storing anything — the link *is* the storage. Above roughly 8,000 characters it tells you the link is too long and to use Save instead.

**Save** downloads the file with the right extension. **Ctrl+S** does the same.

Your current draft is kept in this browser's `localStorage` so a reload does not lose it, and nowhere else.

## The editor

A `<textarea>` sits on top of a highlighted copy of the same text, in the same font, scrolled together. The textarea handles selection, undo, IME, mobile keyboards and accessibility — everything a browser already does well and a hand-written editor usually gets wrong.

What it adds on top is the part a plain textarea gets wrong for code:

- **Tab** indents instead of leaving the field; **Shift+Tab** outdents; both work on a selection
- **Enter** keeps the current indentation, and opens a block when the line ends in a bracket
- brackets and quotes close themselves, typing over a closer steps past it, and backspacing an empty pair removes both halves
- **Ctrl+Enter** runs

Undo still works, because edits go through the browser's own insert rather than by reassigning `value`.

## Tests

```bash
node test/run-tests.js
```

68 checks. Two of them matter more than the rest:

**Nothing reaches `innerHTML` unescaped.** The highlighted layer is built as HTML, so a token carrying `<script>` would otherwise execute in the page. Six dangerous inputs are run through all seventeen languages, and the output is checked for any `<` or `>` that this module did not write itself.

**The tokeniser never loses a character.** If the highlighted layer and the textarea disagree by one character, the caret drifts away from the text under it. Seventeen inputs — unterminated strings, unterminated block comments, emoji, tabs, a 5,000-character line — are round-tripped through every language and compared exactly.

The rest covers what each language should recognise, the link encoding (unicode, `+`, `/`, `&`, `#`, empty, 3,000 characters), a corrupted draft, a full storage quota, and that highlighting 400 KB stays under 400 ms.

Two bugs came out of writing those: an empty snippet could not round-trip through a link, and a corrupted link decoded to mangled bytes instead of being rejected, because base64 decoders quietly skip characters they do not recognise.

## Structure

```
index.html        the page
styles.css        the look, and the metrics the editor depends on
worker.js         the sandbox JavaScript runs in
js/highlight.js   the tokeniser and seventeen language descriptions (pure)
js/samples.js     a starting snippet for each language
js/share.js       code in and out of a link, and the draft (pure)
js/runner.js      the worker, the timeout, the frame, Pyodide
js/editor.js      the textarea, the highlighted layer, and the key handling
js/app.js         wiring
```

`highlight.js`, `share.js` and `samples.js` have no DOM in them, which is why the tests run in Node with nothing installed and nothing mocked.

## Adding a language

One entry in `LANGUAGES` in `js/highlight.js`: what a comment looks like, which quotes start a string, the keywords, the literals, the builtins. One sample in `js/samples.js`. That is the whole change — there is no parser to write.

## License

MIT — see [LICENSE](LICENSE).

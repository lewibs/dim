# Dim landing page

A static landing page for [Dim](https://github.com/lewibs/dim) written in plain HTML, CSS and JavaScript, with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Files

- `index.html`: the page
- `styles.css`: design tokens (dark by default, light when the system is set to light) and layout
- `main.js`: theme toggle, download button that matches the visitor's OS, diagram-kind tabs, scroll reveal
- `demo.js`: the live demo engine
- `scenes.js`: the scripted scenes each demo plays
- `demo.css`: styles for the recreated editor inside the demos
- `assets/images/`: Open Graph image, favicon

## Live demos

None of the product shots are videos. Like cursor.com, each one is a plain-HTML recreation of Dim (explorer, view toggle, diagrams, Claude terminal, review bar) animated by a script. Every demo is laid out at a fixed size and scaled to fit, so positions are predictable. Demos follow the light/dark theme, play only while on screen, and show a still end state to visitors who prefer reduced motion.

A demo is an element with `data-demo="<scene>"`. `demo.js` mounts it on load. The diagram-kind tabs call `dimDemo.mount(element, 'kind-<id>')` when the visitor switches tabs.

A scene is registered in `scenes.js` with `dimDemo.scene(name, { width, height, html, reset, play, final })`:

- `html()` returns the stage markup. The hero leaves it out and uses the markup already in `index.html`.
- `reset(ctx)` puts the stage back to its first frame.
- `play(ctx)` is the story. It runs on a loop with a short fade between runs.
- `final(ctx)` is the still frame for reduced motion.

`ctx` has `$(name)` for `[data-d="name"]` elements, `sleep`, `moveTo` and `click` for the fake cursor, `pop` to reveal elements in turn, `type` and `stream` for terminal text, and `connect` to draw diagram arrows between boxes.

| Scene | Where | Story |
| --- | --- | --- |
| `hero` | Hero | Structure diagram → prompt → Claude edits two files → diagram redraws with the change highlighted → Accept All → README explains the new behavior. |
| `readme` | Feature 1 | Open a file from the explorer → README view → Structure → Raw → back to README. |
| `navigate` | Feature 2 | Class diagram → click a method → its sequence diagram → click a call → another file's logic diagram with the path lit → breadcrumb back. |
| `big-picture` | Feature 3 | Ask what happens when someone clicks Buy → a big-picture diagram draws from the browser to the server → click a box to open the code behind it. |
| `kind-structure` … `kind-data` | Diagrams tabs | One scene per diagram kind: class, sequence, logic, states, data. |
| `review` | Review | Claude edits six files → changed nodes light up → Raw shows the hunks → Accept All stages the batch. |

## Before launch

- `assets/images/og.png` (1200×630) for link previews is still missing.
- The download buttons point to `https://github.com/lewibs/dim/releases/latest`. Point them at per-OS installers once releases exist.

// Live demo engine: plays scripted scenes on plain-HTML recreations of Dim, the way cursor.com shows its product.
// Each `[data-demo="<scene>"]` element gets a fixed-size stage that is scaled to fit, plays while it is on screen,
// stops when it leaves, and shows the scene's end state to visitors who prefer reduced motion.
// Scenes are registered in scenes.js with `dimDemo.scene(name, definition)`.

window.dimDemo = (() => {
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scenes = new Map();
	const mounted = new WeakMap();
	let uid = 0;

	class Cancelled extends Error { }

	/* ---------- Diagram edges ---------- */
	const directions = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };

	function anchor(element, side) {
		const x = element.offsetLeft;
		const y = element.offsetTop;
		const w = element.offsetWidth;
		const h = element.offsetHeight;
		switch (side) {
			case 'l': return [x, y + h / 2];
			case 'r': return [x + w, y + h / 2];
			case 't': return [x + w / 2, y];
			default: return [x + w / 2, y + h];
		}
	}

	/** Picks the facing sides of two boxes: left/right when they sit side by side, top/bottom otherwise. */
	function facingSides(a, b) {
		const gapRight = b.offsetLeft - (a.offsetLeft + a.offsetWidth);
		const gapLeft = a.offsetLeft - (b.offsetLeft + b.offsetWidth);
		const gapDown = b.offsetTop - (a.offsetTop + a.offsetHeight);
		const gapUp = a.offsetTop - (b.offsetTop + b.offsetHeight);
		const gapX = Math.max(gapRight, gapLeft);
		const gapY = Math.max(gapDown, gapUp);
		if (gapX >= gapY) {
			return gapRight >= gapLeft ? ['r', 'l'] : ['l', 'r'];
		}
		return gapDown >= gapUp ? ['b', 't'] : ['t', 'b'];
	}

	function marker(svg, tone) {
		if (!svg.dataset.uid) {
			svg.dataset.uid = String(++uid);
			svg.append(document.createElementNS(SVG_NS, 'defs'));
		}
		const id = `d-arrow-${svg.dataset.uid}-${tone}`;
		if (!svg.querySelector(`#${id}`)) {
			const element = document.createElementNS(SVG_NS, 'marker');
			element.id = id;
			element.setAttribute('class', `is-${tone}`);
			element.setAttribute('viewBox', '0 0 10 10');
			element.setAttribute('refX', '9');
			element.setAttribute('refY', '5');
			element.setAttribute('markerWidth', '7');
			element.setAttribute('markerHeight', '7');
			element.setAttribute('orient', 'auto-start-reverse');
			const head = document.createElementNS(SVG_NS, 'path');
			head.setAttribute('d', 'M0 0L10 5L0 10z');
			element.append(head);
			svg.querySelector('defs').append(element);
		}
		return `url(#${id})`;
	}

	/**
	 * Draws a curved arrow from box `a` to box `b` inside `svg`. Boxes and svg must share a positioned parent.
	 * Options: `sides` such as 'rl' or 'bt', `label`, `dashed`, `tone` ('plain' | 'added' | 'accent'), `shown`.
	 */
	function connect(svg, a, b, options = {}) {
		const [fromSide, toSide] = options.sides ? options.sides.split('') : facingSides(a, b);
		const tone = options.tone || 'plain';
		const [x1, y1] = anchor(a, fromSide);
		const [x2, y2] = anchor(b, toSide);
		const pull = Math.max(28, Math.hypot(x2 - x1, y2 - y1) / 2.6);
		const [dx1, dy1] = directions[fromSide];
		const [dx2, dy2] = directions[toSide];

		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', `M${x1} ${y1} C${x1 + dx1 * pull} ${y1 + dy1 * pull} ${x2 + dx2 * pull} ${y2 + dy2 * pull} ${x2} ${y2}`);
		path.setAttribute('marker-end', marker(svg, tone));
		path.setAttribute('class', `d-edge is-${tone}${options.dashed ? ' is-dashed' : ''}${options.shown ? '' : ' is-hidden'}`);
		svg.append(path);

		let label;
		if (options.label) {
			const middle = path.getPointAtLength(path.getTotalLength() / 2);
			label = document.createElementNS(SVG_NS, 'text');
			label.setAttribute('x', String(middle.x));
			label.setAttribute('y', String(middle.y - 6));
			label.setAttribute('class', `d-edge-label${options.shown ? '' : ' is-hidden'}`);
			label.textContent = options.label;
			svg.append(label);
		}
		return { path, label };
	}

	function clearEdges(svg) {
		svg.querySelectorAll('path.d-edge, text.d-edge-label').forEach(element => element.remove());
	}

	/** Reveals an edge, tracing it from its start when `animate` is set. */
	function showEdge(edge, animate) {
		const { path, label } = edge;
		path.classList.remove('is-hidden');
		label?.classList.remove('is-hidden');
		if (!animate || path.classList.contains('is-dashed')) {
			return;
		}
		const length = path.getTotalLength();
		path.style.transition = 'none';
		path.style.strokeDasharray = String(length);
		path.style.strokeDashoffset = String(length);
		path.getBoundingClientRect();
		path.style.transition = '';
		path.style.strokeDashoffset = '0';
	}

	/* ---------- One running demo ---------- */
	function mount(root, name) {
		mounted.get(root)?.dispose();
		const scene = scenes.get(name);
		if (!scene) {
			return;
		}

		const width = scene.width || 1100;
		const height = scene.height || 640;
		root.dataset.demo = name;
		root.style.aspectRatio = `${width} / ${height}`;

		let stage = root.querySelector('.demo-stage');
		if (scene.html) {
			stage?.remove();
			stage = document.createElement('div');
			stage.className = 'demo-stage';
			stage.setAttribute('aria-hidden', 'true');
			stage.innerHTML = scene.html();
			root.append(stage);
		}
		stage.style.width = `${width}px`;
		stage.style.height = `${height}px`;

		let cursor = stage.querySelector('.d-cursor');
		if (!cursor) {
			cursor = document.createElement('div');
			cursor.className = 'd-cursor';
			cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8.2-6.3 1.4L9.6 19z"/></svg>';
			stage.append(cursor);
		}

		let scale = 1;
		let run = 0;
		let visible = false;
		let disposed = false;
		const state = {};

		const resizeObserver = new ResizeObserver(() => {
			scale = root.clientWidth / width;
			root.style.setProperty('--demo-scale', String(scale));
		});
		resizeObserver.observe(root);

		/** Helpers handed to the scene. Everything that waits throws `Cancelled` once this run is stopped. */
		function context(id) {
			const ctx = {
				root,
				stage,
				state,
				$: name => stage.querySelector(`[data-d="${name}"]`),
				$$: selector => Array.from(stage.querySelectorAll(selector)),
				connect,
				clearEdges,
				showEdge,

				sleep(ms) {
					return new Promise((resolve, reject) => {
						setTimeout(() => id === run && !disposed ? resolve() : reject(new Cancelled()), ms);
					});
				},

				pointAt(target, offsetX = 0.5, offsetY = 0.6) {
					const box = target.getBoundingClientRect();
					const frame = stage.getBoundingClientRect();
					return {
						x: (box.left - frame.left) / scale + (box.width / scale) * offsetX,
						y: (box.top - frame.top) / scale + (box.height / scale) * offsetY
					};
				},

				/** Puts the pointer on a target element (or `{x, y}` point) without waiting. */
				place(target, animate = false, offsetX, offsetY) {
					const point = target instanceof Element ? ctx.pointAt(target, offsetX, offsetY) : target;
					cursor.classList.remove('is-hidden');
					cursor.style.transition = animate ? '' : 'none';
					cursor.style.transform = `translate(${point.x}px, ${point.y}px)`;
				},

				async moveTo(target, offsetX, offsetY) {
					ctx.place(target, true, offsetX, offsetY);
					await ctx.sleep(750);
				},

				async click(target, offsetX, offsetY) {
					await ctx.moveTo(target, offsetX, offsetY);
					cursor.classList.add('is-pressed');
					target.classList.add('is-pressed');
					await ctx.sleep(150);
					cursor.classList.remove('is-pressed');
					target.classList.remove('is-pressed');
					await ctx.sleep(120);
				},

				hideCursor() {
					cursor.classList.add('is-hidden');
				},

				/** Adds `is-in` to each element in turn. */
				async pop(elements, gap = 110) {
					for (const element of elements) {
						element.classList.add('is-in');
						await ctx.sleep(gap);
					}
				},

				async type(element, text) {
					for (const char of text) {
						element.textContent += char;
						await ctx.sleep(char === ' ' ? 70 : 42);
					}
				},

				async stream(element, text) {
					for (const word of text.split(' ')) {
						element.textContent += (element.textContent ? ' ' : '') + word;
						await ctx.sleep(55);
					}
				}
			};
			return ctx;
		}

		async function loop() {
			const id = ++run;
			const ctx = context(id);
			try {
				for (; ;) {
					scene.reset(ctx);
					await scene.play(ctx);
					stage.classList.add('is-fading');
					await ctx.sleep(450);
					stage.classList.remove('is-fading');
				}
			} catch (error) {
				if (!(error instanceof Cancelled)) {
					throw error;
				}
			}
		}

		function stop() {
			run++;
			stage.classList.remove('is-fading');
		}

		function update() {
			if (visible && !document.hidden && !disposed) {
				loop();
			} else {
				stop();
			}
		}

		const intersectionObserver = new IntersectionObserver(entries => {
			const next = entries[entries.length - 1].isIntersecting;
			if (next !== visible) {
				visible = next;
				update();
			}
		}, { threshold: 0.3 });

		document.fonts.ready.then(() => {
			if (disposed) {
				return;
			}
			const ctx = context(run);
			scene.reset(ctx);
			if (reducedMotion) {
				scene.final(ctx);
				ctx.hideCursor();
				return;
			}
			intersectionObserver.observe(root);
			document.addEventListener('visibilitychange', update);
		});

		const controller = {
			dispose() {
				disposed = true;
				stop();
				resizeObserver.disconnect();
				intersectionObserver.disconnect();
				document.removeEventListener('visibilitychange', update);
				mounted.delete(root);
			}
		};
		mounted.set(root, controller);
		return controller;
	}

	function scene(name, definition) {
		scenes.set(name, definition);
	}

	// Scripts load at the end of the body, so every scene is registered by the time the DOM is ready.
	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll('[data-demo]').forEach(root => {
			if (!mounted.has(root)) {
				mount(root, root.dataset.demo);
			}
		});
	});

	return { scene, mount };
})();

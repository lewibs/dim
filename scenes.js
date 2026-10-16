// Scenes for the live demos. Each scene is a small plain-HTML recreation of Dim plus a scripted story.
// `html()` builds the stage (the hero's stage lives in index.html instead), `reset()` puts it back at the start,
// `play()` runs the story with the helpers from demo.js, and `final()` is the still frame for reduced motion.

(() => {
	const { scene } = window.dimDemo;

	/* ---------- Markup builders ---------- */
	const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	const TOKENS = /(?<comment>\/\/.*$)|(?<string>'[^']*')|\b(?<keyword>export|class|extends|implements|private|readonly|public|const|let|new|return|if|for|of|await|async|this|super|constructor|throw|try|catch)\b|\b(?<type>[A-Z][A-Za-z0-9]*)\b|\b(?<fn>[a-z_$][\w$]*)(?=\()/g;

	/** A tiny TypeScript highlighter, enough for the code views. */
	function highlight(line) {
		let html = '';
		let last = 0;
		for (const match of line.matchAll(TOKENS)) {
			const kind = Object.keys(match.groups).find(name => match.groups[name] !== undefined);
			html += escape(line.slice(last, match.index)) + `<span class="t-${kind}">${escape(match[0])}</span>`;
			last = match.index + match[0].length;
		}
		return html + escape(line.slice(last));
	}

	/** Code with line numbers. Lines starting with '+ ' or '- ' render as added or removed, '* ' as marked. */
	function code(lines, start = 1) {
		let number = start;
		const rows = lines.map(line => {
			const kind = { '+ ': 'is-add', '- ': 'is-del', '* ': 'is-mark' }[line.slice(0, 2)] || '';
			const text = kind ? line.slice(2) : line;
			const label = kind === 'is-del' ? '' : number++;
			return `<div class="d-code-line ${kind}"><span class="d-ln">${label}</span><span class="d-src">${highlight(text)}</span></div>`;
		});
		return `<div class="d-code">${rows.join('')}</div>`;
	}

	/** A class or entity box. Rows are HTML strings or `{ html, d, className }`. */
	function classNode({ id, x, y, w, title, tag, rows }) {
		const items = rows.map(row => {
			const { html, d, className } = typeof row === 'string' ? { html: row } : row;
			return `<li${d ? ` data-d="${d}"` : ''}${className ? ` class="${className}"` : ''}>${html}</li>`;
		});
		return `<div class="d-node" data-node="${id}" style="left:${x}px;top:${y}px;width:${w}px">`
			+ `<header>${tag ? `<small>${tag}</small>` : ''}${escape(title)}</header><ul>${items.join('')}</ul></div>`;
	}

	/** A flowchart or state box. Shapes: rect, round, diamond, start, end. */
	function box({ id, x, y, w, h, text = '', sub, shape = 'rect' }) {
		const size = shape === 'start' || shape === 'end' ? 18 : undefined;
		const width = size || w;
		const height = size || (shape === 'diamond' ? w : h || 44);
		return `<div class="d-box d-box-${shape}" data-node="${id}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">`
			+ `<span>${text}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
	}

	/** A sequence diagram: actors with lifelines and the messages between them, top to bottom. */
	function sequence({ actors, messages, start = 110, step = 46 }) {
		const xOf = id => actors.find(actor => actor.id === id).x;
		const heads = actors.map(actor => `<div class="d-actor" style="left:${actor.x - 75}px">${actor.name}</div><div class="d-life" style="left:${actor.x}px"></div>`);
		const arrows = messages.map((message, index) => {
			const from = xOf(message.from);
			const to = xOf(message.to);
			const classes = ['d-msg', to < from ? 'is-left' : '', message.ret ? 'is-ret' : ''].join(' ');
			return `<div class="${classes}"${message.d ? ` data-d="${message.d}"` : ''} style="left:${Math.min(from, to)}px;top:${start + index * step}px;width:${Math.abs(to - from)}px"><span>${message.label}</span></div>`;
		});
		return heads.join('') + arrows.join('');
	}

	function canvas(name, inner, shown) {
		return `<div class="d-view d-diagram${shown ? ' is-shown' : ''}" data-panel="${name}"><svg class="d-edges" data-d="edges-${name}"></svg>${inner}</div>`;
	}

	function file(name, { d, active, badge, isNew, folder } = {}) {
		const classes = ['d-file', folder ? 'd-folder' : '', active ? 'is-active' : '', isNew ? 'd-file-new' : ''].join(' ');
		const git = badge ? ` <span class="d-git d-git-${badge.toLowerCase()}"${d ? ` data-d="git-${d}"` : ''}>${badge}</span>` : '';
		return `<div class="${classes}"${d ? ` data-d="file-${d}"` : ''}>${folder ? '⌄ ' : ''}${name}${git}</div>`;
	}

	function views(names, on) {
		return `<div class="d-views" data-d="views">${names.map(name => `<span data-view="${name.toLowerCase()}"${name === on ? ' class="is-on"' : ''}>${name}</span>`).join('')}</div>`;
	}

	const activity = `<aside class="d-activity">
		<svg viewBox="0 0 24 24" class="is-on"><path d="M6 3h8l4 4v14H6z M14 3v4h4"/></svg>
		<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>
		<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M6 8.2v7.6M18 11.2c0 3-5 3-10.5 5"/></svg>
		<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.3L20 10.5l-5.8 2.2L12 18l-2.2-5.3L4 10.5l5.8-2.2z"/></svg>
	</aside>`;

	/** The editor column: tab strip, optional breadcrumbs, editor and optional Claude terminal. */
	function main({ tabs, viewNames, viewOn, crumbs, editor, terminal }) {
		return `<section class="d-main">
			<div class="d-tabs"><div class="d-tab-strip">${tabs}</div>${viewNames ? views(viewNames, viewOn) : ''}</div>
			${crumbs ? '<div class="d-crumbs" data-d="crumbs"></div>' : ''}
			<div class="d-editor">${editor}</div>
			${terminal ? `<div class="d-terminal" style="height:${terminal}px"><div class="d-term-head"><span class="is-on">Claude</span><span>Terminal</span><span>Problems</span></div><div class="d-term-body" data-d="term"></div></div>` : ''}
		</section>`;
	}

	const pill = (d, text, ok, className = '') => `<div class="d-pill${ok ? ' d-pill-ok' : ''}${className ? ` ${className}` : ''}" data-d="${d}">${text}</div>`;

	/* ---------- Story helpers ---------- */
	const node = (ctx, id) => ctx.stage.querySelector(`[data-node="${id}"]`);

	function showView(ctx, name) {
		ctx.$$('[data-view]').forEach(tab => tab.classList.toggle('is-on', tab.dataset.view === name));
		ctx.$$('[data-panel]').forEach(panel => panel.classList.toggle('is-shown', panel.dataset.panel === name));
	}

	/** Removes the given state classes from everything inside the stage. */
	function clear(ctx, ...classes) {
		ctx.$$(classes.map(name => `.${name}`).join(',')).forEach(element => {
			if (!element.closest('.d-legend')) {
				element.classList.remove(...classes);
			}
		});
	}

	/** Draws a canvas's edges, hidden, and returns them keyed by 'from>to'. */
	function drawEdges(ctx, panel, list) {
		const svg = ctx.$(`edges-${panel}`);
		ctx.clearEdges(svg);
		const edges = {};
		for (const [from, to, options] of list) {
			edges[`${from}>${to}`] = ctx.connect(svg, node(ctx, from), node(ctx, to), options);
		}
		return edges;
	}

	/** Pops boxes in and traces the edges between them as each target appears. */
	async function build(ctx, ids, edges, gap = 140) {
		for (const id of ids) {
			node(ctx, id).classList.add('is-in');
			for (const [key, edge] of Object.entries(edges)) {
				const [from, to] = key.split('>');
				if ((to === id && ids.indexOf(from) < ids.indexOf(id)) || (from === id && ids.indexOf(to) < ids.indexOf(id))) {
					ctx.showEdge(edge, true);
				}
			}
			await ctx.sleep(gap);
		}
	}

	function showAll(ctx, ids, edges) {
		ids.forEach(id => node(ctx, id).classList.add('is-in'));
		Object.values(edges).forEach(edge => ctx.showEdge(edge, false));
	}

	function addLine(ctx, html, className) {
		const line = document.createElement('div');
		line.className = className ? `d-line ${className}` : 'd-line';
		line.innerHTML = html;
		ctx.$('term').append(line);
		return line;
	}

	function promptLine(ctx, text = '') {
		return addLine(ctx, `<span class="d-prompt">›</span><span class="d-typed">${text}</span>`, 'd-input');
	}

	/** Moves to the terminal and types a prompt into its last input line. */
	async function ask(ctx, text) {
		await ctx.moveTo(ctx.$('term'), 0.75, 0.5);
		const caret = Object.assign(document.createElement('span'), { className: 'd-caret' });
		const input = ctx.$('term').lastElementChild;
		input.append(caret);
		await ctx.sleep(250);
		await ctx.type(input.querySelector('.d-typed'), text);
		await ctx.sleep(350);
		caret.remove();
	}

	const tool = (verb, target, extra = '') => `<span class="d-dot">⏺</span>${verb} <b>${target}</b>${extra ? ` ${extra}` : ''}`;
	const plus = count => `<span class="d-plus">+${count}</span>`;
	const minus = count => `<span class="d-minus">−${count}</span>`;

	async function flash(ctx, name, ms) {
		ctx.$(name).classList.add('is-in');
		await ctx.sleep(ms);
		ctx.$(name).classList.remove('is-in');
	}

	/* ====================================================================
	 * Hero: open the diagram, ask Claude for a change, watch it redraw, accept, read the README.
	 * ==================================================================== */
	const HERO_PROMPT = 'retry failed payments with backoff';
	const heroTools = [
		tool('Read', 'paymentService.ts'),
		tool('Write', 'retryPolicy.ts', plus(41)),
		tool('Update', 'paymentService.ts', `${plus(18)} ${minus(3)}`)
	];
	const heroReply = 'Failed payments now retry up to 3 times, waiting longer after each attempt.';

	function heroChange(ctx, animate) {
		ctx.$('new-file').classList.add('is-in');
		ctx.$('git-service').classList.add('is-in');
		ctx.$('row-retry').classList.add('is-in', 'is-added');
		ctx.$('row-send').classList.add('is-changed');
		node(ctx, 'service').classList.add('is-changed');
		node(ctx, 'retry').classList.add('is-in', 'is-added');
		ctx.showEdge(ctx.state.edges['service>retry'], animate);
	}

	scene('hero', {
		reset(ctx) {
			ctx.$('term').replaceChildren();
			promptLine(ctx);
			['new-file', 'readme-new', 'row-retry', 'status', 'toast', 'review', 'git-service'].forEach(name => ctx.$(name).classList.remove('is-in'));
			clear(ctx, 'is-in', 'is-added', 'is-changed');
			ctx.state.edges = drawEdges(ctx, 'structure', [
				['service', 'payment'],
				['service', 'gateway'],
				['service', 'retry', { tone: 'added' }]
			]);
			showView(ctx, 'readme');
			ctx.place(ctx.$('term'), false, 0.75, 0.55);
		},

		final(ctx) {
			ctx.$('term').replaceChildren();
			promptLine(ctx, HERO_PROMPT);
			heroTools.forEach(html => addLine(ctx, html));
			addLine(ctx, heroReply, 'd-reply');
			showView(ctx, 'structure');
			showAll(ctx, ['payment', 'gateway', 'service'], { a: ctx.state.edges['service>payment'], b: ctx.state.edges['service>gateway'] });
			heroChange(ctx, false);
			ctx.$('review').classList.add('is-in');
		},

		async play(ctx) {
			const { edges } = ctx.state;
			await ctx.sleep(1400);

			// 1. Open the diagram for the file.
			await ctx.click(ctx.$$('[data-view="structure"]')[0]);
			showView(ctx, 'structure');
			await ctx.pop(['payment', 'gateway', 'service'].map(id => node(ctx, id)));
			ctx.showEdge(edges['service>payment'], true);
			ctx.showEdge(edges['service>gateway'], true);
			await ctx.sleep(900);

			// 2. Ask Claude for a change.
			await ask(ctx, HERO_PROMPT);
			ctx.place(ctx.$('accept').parentElement, true, 0.5, -1.4);
			const thinking = addLine(ctx, '✻ Thinking…', 'd-thinking');
			await ctx.sleep(1100);
			thinking.remove();
			for (const html of heroTools) {
				addLine(ctx, html);
				await ctx.sleep(480);
			}
			ctx.$('new-file').classList.add('is-in');
			ctx.$('git-service').classList.add('is-in');
			await ctx.stream(addLine(ctx, '', 'd-reply'), heroReply);

			// 3. The diagram redraws with the change highlighted.
			await flash(ctx, 'status', 1300);
			heroChange(ctx, true);
			await ctx.sleep(700);
			ctx.$('review').classList.add('is-in');
			await ctx.sleep(1500);

			// 4. Accept the whole change.
			await ctx.click(ctx.$('accept'));
			ctx.$('review').classList.remove('is-in');
			clear(ctx, 'is-added', 'is-changed');
			ctx.$('git-service').classList.remove('is-in');
			await flash(ctx, 'toast', 1200);

			// 5. The README already explains the new behavior.
			await ctx.click(ctx.$$('[data-view="readme"]')[0]);
			showView(ctx, 'readme');
			await ctx.sleep(250);
			ctx.$('readme-new').classList.add('is-in');
			await ctx.sleep(3000);
		}
	});

	/* ====================================================================
	 * Feature 1: open a file from the explorer, land on its README, flip to Structure, then Raw.
	 * ==================================================================== */
	const cartNodes = [
		classNode({ id: 'cart', x: 24, y: 40, w: 230, title: 'Cart', rows: ['items: CartItem[]', 'coupon?: Coupon', 'add(product, quantity)', 'total()'] }),
		classNode({ id: 'coupon', x: 24, y: 280, w: 230, title: 'Coupon', rows: ['code: string', 'percentOff: number'] }),
		classNode({ id: 'item', x: 356, y: 30, w: 220, title: 'CartItem', rows: ['product: Product', 'quantity: number', 'subtotal()'] }),
		classNode({ id: 'product', x: 356, y: 262, w: 220, title: 'Product', rows: ['name: string', 'price: number'] })
	].join('');

	const cartCode = code([
		'export class Cart {',
		'',
		'\tprivate readonly items: CartItem[] = [];',
		'\tprivate coupon?: Coupon;',
		'',
		'\tadd(product: Product, quantity = 1): void {',
		'\t\tconst item = this.itemFor(product);',
		'\t\tif (item) {',
		'\t\t\titem.quantity += quantity;',
		'\t\t} else {',
		'\t\t\tthis.items.push(new CartItem(product, quantity));',
		'\t\t}',
		'\t}',
		'',
		'\ttotal(): number {',
		'\t\tconst sum = sumOf(this.items, item => item.subtotal());',
		'\t\treturn this.coupon ? this.coupon.apply(sum) : sum;',
		'\t}',
		'}'
	], 12);

	scene('readme', {
		width: 800,
		height: 500,
		html: () => `
			<aside class="d-explorer" style="width:184px">
				<div class="d-explorer-title">Explorer</div>
				${file('src', { folder: true })}
				${file('account.ts')}
				${file('cart.ts', { d: 'target' })}
				${file('checkout.ts')}
				${file('product.ts')}
				${file('test', { folder: true })}
				${file('cart.test.ts')}
			</aside>
			${main({
				tabs: '<div class="d-tab d-tab-new" data-d="tab">cart.ts</div>',
				viewNames: ['Raw', 'README', 'Structure'],
				viewOn: 'README',
				editor: `
					<div class="d-view d-empty is-shown" data-panel="empty"><span class="d-empty-mark">◐</span>Open a file to see what it does</div>
					<div class="d-view d-readme" data-panel="readme">
						<p class="d-readme-label d-reveal">cart.ts</p>
						<p class="d-reveal"><b>Holds what a shopper plans to buy and works out the total.</b></p>
						<p class="d-reveal">A <b>Cart</b> keeps one <b>CartItem</b> per <b>Product</b>, so adding the same product twice raises its quantity. If the shopper applies a <b>Coupon</b>, its discount comes off the total.</p>
						<p class="d-chips d-reveal"><span>Used by</span><i>CheckoutPage</i><i>OrderService</i><i>cart.test.ts</i></p>
					</div>
					${canvas('structure', cartNodes)}
					<div class="d-view" data-panel="raw">${cartCode}</div>`
			})}`,

		reset(ctx) {
			ctx.$('file-target').classList.remove('is-active');
			['tab', 'views'].forEach(name => ctx.$(name).classList.remove('is-in'));
			clear(ctx, 'is-in');
			ctx.state.edges = drawEdges(ctx, 'structure', [
				['cart', 'item', { label: '1..*' }],
				['item', 'product', { label: 'refers to' }],
				['cart', 'coupon', { label: '0..1', dashed: true }]
			]);
			showView(ctx, 'empty');
			ctx.place({ x: 470, y: 330 });
		},

		final(ctx) {
			ctx.$('file-target').classList.add('is-active');
			['tab', 'views'].forEach(name => ctx.$(name).classList.add('is-in'));
			ctx.$$('.d-reveal').forEach(element => element.classList.add('is-in'));
			showAll(ctx, ['cart', 'coupon', 'item', 'product'], ctx.state.edges);
			showView(ctx, 'readme');
		},

		async play(ctx) {
			await ctx.sleep(700);
			await ctx.click(ctx.$('file-target'));
			ctx.$('file-target').classList.add('is-active');
			ctx.$('tab').classList.add('is-in');
			ctx.$('views').classList.add('is-in');
			showView(ctx, 'readme');
			await ctx.pop(ctx.$$('.d-reveal'), 380);
			await ctx.sleep(2200);

			await ctx.click(ctx.$$('[data-view="structure"]')[0]);
			showView(ctx, 'structure');
			await build(ctx, ['cart', 'item', 'product', 'coupon'], ctx.state.edges);
			await ctx.sleep(2400);

			await ctx.click(ctx.$$('[data-view="raw"]')[0]);
			showView(ctx, 'raw');
			await ctx.sleep(2400);

			await ctx.click(ctx.$$('[data-view="readme"]')[0]);
			showView(ctx, 'readme');
			await ctx.sleep(2000);
		}
	});

	/* ====================================================================
	 * Feature 2: class diagram → click a method → its sequence → click a call → the next file's logic.
	 * ==================================================================== */
	scene('navigate', {
		width: 800,
		height: 500,
		html: () => main({
			tabs: '<div class="d-tab" data-d="tab-checkout">checkout.ts</div><div class="d-tab d-tab-new" data-d="tab-orders">orderService.ts</div>',
			viewNames: ['Raw', 'Structure', 'Sequence', 'Logic'],
			viewOn: 'Structure',
			crumbs: true,
			editor: [
				canvas('structure', [
					classNode({ id: 'checkout', x: 40, y: 50, w: 260, title: 'Checkout', rows: ['cart: Cart', 'address: Address', { html: 'placeOrder()', d: 'row-place' }, 'cancel()'] }),
					classNode({ id: 'payments', x: 470, y: 30, w: 240, title: 'PaymentService', rows: ['charge(card, amount)', 'refund(id)'] }),
					classNode({ id: 'orders', x: 470, y: 238, w: 240, title: 'OrderService', rows: ['createOrder(cart)', 'find(id)'] })
				].join('')),
				canvas('sequence', sequence({
					actors: [
						{ id: 'page', name: 'CheckoutPage', x: 100 },
						{ id: 'checkout', name: 'Checkout', x: 300 },
						{ id: 'payments', name: 'PaymentService', x: 500 },
						{ id: 'orders', name: 'OrderService', x: 700 }
					],
					messages: [
						{ from: 'page', to: 'checkout', label: 'placeOrder()' },
						{ from: 'checkout', to: 'payments', label: 'charge(card, total)' },
						{ from: 'payments', to: 'checkout', label: 'paid', ret: true },
						{ from: 'checkout', to: 'orders', label: 'createOrder(cart)', d: 'msg-create' },
						{ from: 'orders', to: 'checkout', label: 'order', ret: true },
						{ from: 'checkout', to: 'page', label: 'show confirmation', ret: true }
					]
				})),
				canvas('logic', [
					box({ id: 'start', shape: 'start', x: 34, y: 196 }),
					box({ id: 'coupon', shape: 'diamond', x: 96, y: 145, w: 120, text: 'Coupon applied?' }),
					box({ id: 'discount', x: 290, y: 50, w: 160, text: 'Take off the discount' }),
					box({ id: 'store', x: 290, y: 183, w: 160, text: 'Save the order' }),
					box({ id: 'receipt', x: 520, y: 183, w: 160, text: 'Email the receipt' }),
					box({ id: 'end', shape: 'end', x: 740, y: 196 })
				].join(''))
			].join('')
		}),

		reset(ctx) {
			clear(ctx, 'is-in', 'is-hover', 'is-lit', 'is-off');
			ctx.$('tab-checkout').classList.remove('is-off');
			ctx.state.structure = drawEdges(ctx, 'structure', [
				['checkout', 'payments', { label: 'charges with' }],
				['checkout', 'orders', { label: 'saves with', dashed: true }]
			]);
			ctx.state.logic = drawEdges(ctx, 'logic', [
				['start', 'coupon'],
				['coupon', 'discount', { sides: 'tl', label: 'yes' }],
				['coupon', 'store', { label: 'no' }],
				['discount', 'store', { sides: 'bt' }],
				['store', 'receipt'],
				['receipt', 'end']
			]);
			ctx.state.crumbs = [{ label: 'Checkout', kind: 'Structure' }];
			renderCrumbs(ctx);
			showView(ctx, 'structure');
			ctx.place({ x: 380, y: 400 });
		},

		final(ctx) {
			ctx.$('tab-checkout').classList.add('is-off');
			ctx.$('tab-orders').classList.add('is-in');
			ctx.state.crumbs.push({ label: 'placeOrder()', kind: 'Sequence' }, { label: 'createOrder()', kind: 'Logic' });
			renderCrumbs(ctx);
			showAll(ctx, ['start', 'coupon', 'discount', 'store', 'receipt', 'end'], ctx.state.logic);
			showView(ctx, 'logic');
		},

		async play(ctx) {
			await ctx.sleep(500);
			await build(ctx, ['checkout', 'payments', 'orders'], ctx.state.structure);
			await ctx.sleep(1100);

			// Hop 1: a method opens its sequence.
			const row = ctx.$('row-place');
			await ctx.moveTo(row, 0.2);
			row.classList.add('is-hover');
			await ctx.sleep(450);
			await ctx.click(row, 0.2);
			ctx.state.crumbs.push({ label: 'placeOrder()', kind: 'Sequence' });
			renderCrumbs(ctx);
			showView(ctx, 'sequence');
			await ctx.sleep(300);
			await ctx.pop(ctx.$$('[data-panel="sequence"] .d-msg'), 380);
			await ctx.sleep(900);

			// Hop 2: a call follows into the next file.
			const call = ctx.$('msg-create');
			await ctx.moveTo(call.firstElementChild);
			call.classList.add('is-hover');
			await ctx.sleep(450);
			await ctx.click(call.firstElementChild);
			ctx.$('tab-checkout').classList.add('is-off');
			ctx.$('tab-orders').classList.add('is-in');
			ctx.state.crumbs.push({ label: 'createOrder()', kind: 'Logic' });
			renderCrumbs(ctx);
			showView(ctx, 'logic');
			await build(ctx, ['start', 'coupon', 'discount', 'store', 'receipt', 'end'], ctx.state.logic, 160);
			ctx.place({ x: 400, y: 400 }, true);
			await ctx.sleep(600);
			for (const id of ['start', 'coupon', 'store', 'receipt', 'end']) {
				node(ctx, id).classList.add('is-lit');
				await ctx.sleep(380);
			}
			await ctx.sleep(1400);

			// Back to where we started.
			await ctx.click(ctx.$('crumbs').firstElementChild);
			clear(ctx, 'is-hover', 'is-lit');
			ctx.state.crumbs.length = 1;
			renderCrumbs(ctx);
			ctx.$('tab-orders').classList.remove('is-in');
			ctx.$('tab-checkout').classList.remove('is-off');
			showView(ctx, 'structure');
			await ctx.sleep(1600);
		}
	});

	function renderCrumbs(ctx) {
		const items = ctx.state.crumbs;
		ctx.$('crumbs').innerHTML = items.map((item, index) => `<span class="d-crumb${index === items.length - 1 ? ' is-on' : ''}">${item.label}<em>${item.kind}</em></span>`).join('<i>›</i>');
	}

	/* ====================================================================
	 * Feature 3: ask how something works, Claude draws the flow across files, then opens the right one.
	 * ==================================================================== */
	const BIG_PROMPT = 'what happens when someone clicks Buy?';
	const bigTools = [
		tool('Search', '"checkout"', '<span class="d-faint">9 files</span>'),
		tool('Read', '5 files'),
		tool('Draw', 'the checkout flow')
	];
	const bigReply = 'The page sends the cart to the server, the checkout route charges the card, and the new order comes back to the page.';
	const bigOrder = ['button', 'cart', 'api', 'route', 'payments'];

	scene('big-picture', {
		width: 800,
		height: 500,
		html: () => main({
			tabs: '<div class="d-tab" data-d="tab-button">checkoutPage.ts</div><div class="d-tab d-tab-new" data-d="tab-big">Big picture · checkout</div><div class="d-tab d-tab-new" data-d="tab-route">checkoutRoute.ts</div>',
			editor: `
				<div class="d-view is-shown" data-panel="button">${code([
					'async function onBuyClicked(): Promise<void> {',
					'\tbuyButton.disabled = true;',
					'\tconst order = await cartStore.checkout();',
					'\tbuyButton.disabled = false;',
					'\tshowConfirmation(order);',
					'}'
				], 41)}</div>
				${canvas('big', `
					<div class="d-lane" data-d="lanes"><span>Browser</span><span>Server</span></div>
					${box({ id: 'button', x: 30, y: 26, w: 190, h: 58, text: 'Buy button', sub: 'checkoutPage.ts' })}
					${box({ id: 'cart', x: 300, y: 26, w: 190, h: 58, text: 'CartStore', sub: 'cartStore.ts' })}
					${box({ id: 'api', x: 570, y: 26, w: 200, h: 58, text: 'API client', sub: 'api.ts' })}
					${box({ id: 'route', x: 570, y: 174, w: 200, h: 58, text: 'Checkout route', sub: 'checkoutRoute.ts' })}
					${box({ id: 'payments', x: 300, y: 174, w: 190, h: 58, text: 'PaymentService', sub: 'paymentService.ts' })}
				`)}
				<div class="d-view" data-panel="route">${code([
					'router.post(\'/checkout\', async (request, response) => {',
					'\tconst cart = await carts.get(request.body.cartId);',
					'* \tconst payment = await payments.charge(request.body.card, cart.total());',
					'\tconst order = await orders.createOrder(cart, payment);',
					'\tresponse.json(order);',
					'});'
				], 18)}</div>`,
			terminal: 184
		}),

		reset(ctx) {
			ctx.$('term').replaceChildren();
			ctx.$('term').classList.add('is-tail');
			promptLine(ctx);
			clear(ctx, 'is-in', 'is-lit', 'is-off');
			ctx.state.edges = drawEdges(ctx, 'big', [
				['button', 'cart', { label: 'checkout()' }],
				['cart', 'api', { label: 'post()' }],
				['api', 'route', { label: 'POST /checkout', sides: 'bt' }],
				['route', 'payments', { label: 'charge()' }]
			]);
			showView(ctx, 'button');
			ctx.place({ x: 420, y: 200 });
		},

		final(ctx) {
			ctx.$('tab-button').classList.add('is-off');
			ctx.$('tab-big').classList.add('is-in');
			ctx.$('term').querySelector('.d-typed').textContent = BIG_PROMPT;
			bigTools.forEach(html => addLine(ctx, html));
			addLine(ctx, bigReply, 'd-reply');
			ctx.$('lanes').classList.add('is-in');
			showAll(ctx, bigOrder, ctx.state.edges);
			showView(ctx, 'big');
		},

		async play(ctx) {
			await ctx.sleep(800);
			await ask(ctx, BIG_PROMPT);
			ctx.place({ x: 420, y: 140 }, true);
			const thinking = addLine(ctx, '✻ Thinking…', 'd-thinking');
			await ctx.sleep(900);
			thinking.remove();
			for (const html of bigTools) {
				addLine(ctx, html);
				await ctx.sleep(520);
			}

			// The big picture opens beside the code and draws itself.
			ctx.$('tab-button').classList.add('is-off');
			ctx.$('tab-big').classList.add('is-in');
			showView(ctx, 'big');
			ctx.$('lanes').classList.add('is-in');
			await ctx.sleep(300);
			await build(ctx, bigOrder, ctx.state.edges, 420);
			await ctx.stream(addLine(ctx, '', 'd-reply'), bigReply);
			await ctx.sleep(900);

			// Follow the flow into the file that matters.
			const ext = node(ctx, 'route');
			await ctx.click(ext);
			ext.classList.add('is-lit');
			await ctx.sleep(400);
			ctx.$('tab-big').classList.add('is-off');
			ctx.$('tab-route').classList.add('is-in');
			showView(ctx, 'route');
			await ctx.sleep(2800);
		}
	});

	/* ====================================================================
	 * Diagram kinds: one small scene per tab in the Diagrams section.
	 * ==================================================================== */
	function kindChrome(fileName, kind, editor) {
		return main({
			tabs: `<div class="d-tab">${fileName}</div>`,
			viewNames: ['Raw', 'README', kind],
			viewOn: kind,
			editor: `${editor}${pill('opened', '', false, 'is-bottom')}`
		});
	}

	/** Clicks a target, then shows where Dim took you. */
	async function follow(ctx, target, text, offsetX) {
		await ctx.moveTo(target, offsetX);
		target.classList.add('is-hover');
		await ctx.sleep(500);
		await ctx.click(target, offsetX);
		ctx.$('opened').innerHTML = text;
		await flash(ctx, 'opened', 2200);
	}

	function kindScene({ fileName, kind, nodes, edges, order, play }) {
		return {
			width: 800,
			height: 500,
			html: () => kindChrome(fileName, kind, canvas('diagram', nodes, true)),
			reset(ctx) {
				clear(ctx, 'is-in', 'is-hover', 'is-lit', 'is-current');
				ctx.state.edges = drawEdges(ctx, 'diagram', edges);
				ctx.place({ x: 400, y: 440 });
			},
			final(ctx) {
				showAll(ctx, order, ctx.state.edges);
				ctx.$$('.d-msg').forEach(message => message.classList.add('is-in'));
			},
			async play(ctx) {
				await ctx.sleep(500);
				await build(ctx, order, ctx.state.edges);
				await play(ctx);
				await ctx.sleep(1000);
			}
		};
	}

	const opened = (name, line) => `↗ Opened <b>${name}</b><span class="d-faint">:${line}</span>`;

	scene('kind-structure', kindScene({
		fileName: 'orderService.ts',
		kind: 'Structure',
		nodes: [
			classNode({ id: 'store', x: 40, y: 30, w: 240, tag: 'interface', title: 'OrderStore', rows: ['save(order)', 'find(id)', 'listFor(customer)'] }),
			classNode({ id: 'service', x: 40, y: 262, w: 240, title: 'OrderService', rows: ['store: OrderStore', { html: 'createOrder(cart)', d: 'row-start' }, 'cancel(id)'] }),
			classNode({ id: 'order', x: 440, y: 40, w: 260, title: 'Order', rows: ['status: OrderStatus', 'lines: OrderLine[]', 'total()', 'cancel()'] }),
			classNode({ id: 'line', x: 460, y: 290, w: 220, title: 'OrderLine', rows: ['product: Product', 'quantity: number'] })
		].join(''),
		edges: [
			['service', 'store', { label: 'saves with', dashed: true, sides: 'tb' }],
			['service', 'order', { label: 'creates' }],
			['order', 'line', { label: '1..*' }]
		],
		order: ['store', 'service', 'order', 'line'],
		play: async ctx => {
			await ctx.sleep(1200);
			await follow(ctx, ctx.$('row-start'), opened('orderService.ts', 42), 0.25);
		}
	}));

	scene('kind-sequence', {
		...kindScene({
			fileName: 'checkout.ts',
			kind: 'Sequence',
			nodes: sequence({
				actors: [
					{ id: 'browser', name: 'Browser', x: 140 },
					{ id: 'server', name: 'Server', x: 400 },
					{ id: 'bank', name: 'Card processor', x: 660 }
				],
				messages: [
					{ from: 'browser', to: 'server', label: 'POST /checkout' },
					{ from: 'server', to: 'bank', label: 'charge(card, total)', d: 'msg-charge' },
					{ from: 'bank', to: 'server', label: 'approved', ret: true },
					{ from: 'server', to: 'browser', label: 'orderId', ret: true },
					{ from: 'browser', to: 'server', label: 'GET /orders/:id' },
					{ from: 'server', to: 'browser', label: 'order details', ret: true }
				],
				start: 120,
				step: 52
			}),
			edges: [],
			order: [],
			play: async () => { }
		}),
		async play(ctx) {
			await ctx.sleep(500);
			await ctx.pop(ctx.$$('.d-msg'), 480);
			await ctx.sleep(1000);
			const query = ctx.$('msg-charge');
			await follow(ctx, query.firstElementChild, opened('checkout.ts', 57));
			await ctx.sleep(800);
		}
	});

	scene('kind-logic', kindScene({
		fileName: 'shipping.ts',
		kind: 'Logic',
		nodes: [
			box({ id: 'start', shape: 'start', x: 30, y: 216 }),
			box({ id: 'express', shape: 'diamond', x: 84, y: 165, w: 120, text: 'Express chosen?' }),
			box({ id: 'rate', x: 264, y: 50, w: 170, text: 'Use the express rate' }),
			box({ id: 'carriers', x: 264, y: 203, w: 170, text: 'Find carriers that deliver' }),
			box({ id: 'many', shape: 'diamond', x: 480, y: 165, w: 120, text: 'More than one?' }),
			box({ id: 'cheapest', x: 465, y: 356, w: 150, text: 'Pick the cheapest' }),
			box({ id: 'price', shape: 'round', x: 642, y: 203, w: 136, text: 'Show the price' })
		].join(''),
		edges: [
			['start', 'express'],
			['express', 'rate', { sides: 'tl', label: 'yes' }],
			['express', 'carriers', { label: 'no' }],
			['rate', 'price', { sides: 'rt' }],
			['carriers', 'many'],
			['many', 'price', { label: 'no' }],
			['many', 'cheapest', { sides: 'bt', label: 'yes' }],
			['cheapest', 'price', { sides: 'rb' }]
		],
		order: ['start', 'express', 'rate', 'carriers', 'many', 'cheapest', 'price'],
		play: async ctx => {
			await ctx.sleep(700);
			const path = ['start', 'express', 'carriers', 'many', 'cheapest', 'price'];
			for (let index = 0; index < path.length; index++) {
				node(ctx, path[index]).classList.add('is-lit');
				ctx.state.edges[`${path[index - 1]}>${path[index]}`]?.path.classList.add('is-lit');
				await ctx.sleep(420);
			}
			await ctx.sleep(600);
			await follow(ctx, node(ctx, 'many'), opened('shipping.ts', 73));
		}
	}));

	scene('kind-states', kindScene({
		fileName: 'order.ts',
		kind: 'States',
		nodes: [
			box({ id: 'start', shape: 'start', x: 30, y: 83 }),
			box({ id: 'placed', shape: 'round', x: 90, y: 70, w: 130, text: 'Placed' }),
			box({ id: 'paid', shape: 'round', x: 310, y: 70, w: 140, text: 'Paid' }),
			box({ id: 'shipped', shape: 'round', x: 540, y: 70, w: 140, text: 'Shipped' }),
			box({ id: 'cancelled', shape: 'round', x: 310, y: 280, w: 140, text: 'Cancelled' }),
			box({ id: 'delivered', shape: 'round', x: 610, y: 280, w: 140, text: 'Delivered' }),
			box({ id: 'end', shape: 'end', x: 671, y: 400 })
		].join(''),
		edges: [
			['start', 'placed'],
			['placed', 'paid', { label: 'pay()' }],
			['paid', 'shipped', { label: 'ship()' }],
			['shipped', 'delivered', { sides: 'rt', label: 'delivered' }],
			['paid', 'cancelled', { sides: 'bt', label: 'cancel()' }],
			['cancelled', 'end', { sides: 'rl' }],
			['delivered', 'end', { sides: 'bt' }]
		],
		order: ['start', 'placed', 'paid', 'shipped', 'cancelled', 'delivered', 'end'],
		play: async ctx => {
			await ctx.sleep(600);
			let previous;
			for (const id of ['placed', 'paid', 'shipped', 'delivered']) {
				previous?.classList.remove('is-current');
				previous = node(ctx, id);
				previous.classList.add('is-current');
				await ctx.sleep(900);
			}
			await ctx.sleep(900);
		}
	}));

	const field = (type, name, key) => `<span class="d-type">${type}</span> ${name}${key ? ` <em>${key}</em>` : ''}`;

	scene('kind-data', kindScene({
		fileName: 'schema.ts',
		kind: 'Data',
		nodes: [
			classNode({ id: 'customer', x: 30, y: 40, w: 200, tag: 'entity', title: 'CUSTOMER', rows: [field('string', 'id', 'PK'), field('string', 'email')] }),
			classNode({ id: 'order', x: 290, y: 150, w: 230, tag: 'entity', title: 'ORDER', rows: [field('string', 'id', 'PK'), field('string', 'customerId', 'FK'), { html: field('string', 'status'), d: 'row-status' }] }),
			classNode({ id: 'product', x: 590, y: 30, w: 180, tag: 'entity', title: 'PRODUCT', rows: [field('string', 'id', 'PK'), field('string', 'name'), field('number', 'price')] }),
			classNode({ id: 'line', x: 590, y: 280, w: 180, tag: 'entity', title: 'ORDER_LINE', rows: [field('string', 'orderId', 'FK'), field('string', 'productId', 'FK'), field('number', 'quantity')] })
		].join(''),
		edges: [
			['customer', 'order', { label: 'places  1 → *' }],
			['order', 'line', { label: 'has  1 → *' }],
			['line', 'product', { label: 'is a  * → 1', sides: 'tb' }]
		],
		order: ['customer', 'order', 'line', 'product'],
		play: async ctx => {
			await ctx.sleep(1200);
			await follow(ctx, ctx.$('row-status'), '<b>status</b> is Placed, Paid, Shipped, Delivered or Cancelled', 0.3);
		}
	}));

	/* ====================================================================
	 * Review: the agent finishes, the diagram shows how the design moved, check the hunks, accept.
	 * ==================================================================== */
	const reviewFiles = [
		['paymentService.ts', 'service', 'M', `${plus(24)} ${minus(4)}`],
		['paymentQueue.ts', 'queue', 'M', `${plus(6)} ${minus(2)}`],
		['retryPolicy.ts', 'retry', 'U', plus(41)],
		['order.ts', 'order', 'M', plus(5)],
		['config.ts', 'config', 'M', `${plus(3)} ${minus(1)}`],
		['retryPolicy.test.ts', 'test', 'U', plus(58)]
	];
	const reviewReply = 'Done. Failed payments retry with backoff, and the order keeps the last error so checkout can show it.';

	scene('review', {
		html: () => `
			${activity}
			<aside class="d-explorer">
				<div class="d-explorer-title">Explorer</div>
				${file('src', { folder: true })}
				${file('paymentService.ts', { d: 'service', active: true, badge: 'M' })}
				${file('paymentGateway.ts')}
				${file('order.ts', { d: 'order', badge: 'M' })}
				${file('config.ts', { d: 'config', badge: 'M' })}
				${file('paymentQueue.ts', { d: 'queue', badge: 'M' })}
				${file('retryPolicy.ts', { d: 'retry', badge: 'U', isNew: true })}
				${file('test', { folder: true })}
				${file('retryPolicy.test.ts', { d: 'test', badge: 'U', isNew: true })}
			</aside>
			${main({
				tabs: '<div class="d-tab">paymentService.ts</div>',
				viewNames: ['Raw', 'README', 'Structure'],
				viewOn: 'Structure',
				editor: `
					${canvas('structure', [
						classNode({ id: 'queue', x: 40, y: 34, w: 220, title: 'PaymentQueue', rows: ['enqueue(payment)', { html: 'drain()', d: 'row-drain' }] }),
						classNode({ id: 'order', x: 40, y: 220, w: 220, title: 'Order', rows: ['status: OrderStatus', { html: 'lastError?: Error', d: 'row-error', className: 'd-row-new' }] }),
						classNode({ id: 'service', x: 330, y: 100, w: 230, title: 'PaymentService', rows: ['queue: PaymentQueue', { html: 'retry: RetryPolicy', d: 'row-retry', className: 'd-row-new' }, { html: 'charge(payment)', d: 'row-send' }, 'refund(id)'] }),
						classNode({ id: 'gateway', x: 630, y: 34, w: 190, title: 'PaymentGateway', rows: ['charge(payment)', 'refund(id)'] }),
						classNode({ id: 'retry', x: 630, y: 220, w: 190, title: 'RetryPolicy', rows: ['maxAttempts = 3', 'shouldRetry(error)', 'delayFor(attempt)'] })
					].join(''), true)}
					<div class="d-view" data-panel="raw">${code([
						'export class PaymentService {',
						'+ \tprivate readonly retry = new RetryPolicy(config.retries);',
						'',
						'\tasync charge(payment: Payment): Promise<Receipt> {',
						'- \t\treturn this.gateway.charge(payment);',
						'+ \t\tfor (let attempt = 1; ; attempt++) {',
						'+ \t\t\ttry {',
						'+ \t\t\t\treturn await this.gateway.charge(payment);',
						'+ \t\t\t} catch (error) {',
						'+ \t\t\t\tif (!this.retry.shouldRetry(error, attempt)) {',
						'+ \t\t\t\t\tpayment.order.lastError = error;',
						'+ \t\t\t\t\tthrow error;',
						'+ \t\t\t\t}',
						'+ \t\t\t\tawait timeout(this.retry.delayFor(attempt));',
						'+ \t\t\t}',
						'+ \t\t}',
						'\t}'
					], 18)}</div>
					${pill('status', '<i class="d-spinner"></i>Updating diagrams…')}
					${pill('toast', '✓ Staged 6 files', true)}
					<div class="d-review" data-d="review">
						<span class="d-legend"><i class="is-added"></i>Added<i class="is-changed"></i>Changed</span>
						<span class="d-review-count">6 files changed</span>
						<span class="d-btn">Reject All</span>
						<span class="d-btn d-btn-primary" data-d="accept">Accept All</span>
					</div>`,
				terminal: 176
			})}`,

		reset(ctx) {
			ctx.$('term').replaceChildren();
			ctx.$('term').classList.add('is-tail');
			promptLine(ctx, 'retry failed payments with backoff and show the error at checkout');
			clear(ctx, 'is-in', 'is-added', 'is-changed');
			ctx.state.edges = drawEdges(ctx, 'structure', [
				['service', 'queue'],
				['service', 'order'],
				['service', 'gateway'],
				['service', 'retry', { tone: 'added' }]
			]);
			showAll(ctx, ['queue', 'order', 'service', 'gateway'], { a: ctx.state.edges['service>queue'], b: ctx.state.edges['service>order'], c: ctx.state.edges['service>gateway'] });
			showView(ctx, 'structure');
			ctx.place({ x: 760, y: 300 });
		},

		final(ctx) {
			reviewFiles.forEach(([name, d, badge, change]) => {
				addLine(ctx, tool(badge === 'U' ? 'Write' : 'Update', name, change));
				ctx.$(`file-${d}`).classList.add('is-in');
				ctx.$(`git-${d}`).classList.add('is-in');
			});
			addLine(ctx, reviewReply, 'd-reply');
			reviewChange(ctx, false);
			ctx.$('review').classList.add('is-in');
		},

		async play(ctx) {
			// The agent finishes its turn.
			const working = addLine(ctx, '✻ Working…', 'd-thinking');
			await ctx.sleep(900);
			working.remove();
			for (const [name, d, badge, change] of reviewFiles) {
				addLine(ctx, tool(badge === 'U' ? 'Write' : 'Update', name, change));
				ctx.$(`file-${d}`).classList.add('is-in');
				ctx.$(`git-${d}`).classList.add('is-in');
				await ctx.sleep(330);
			}
			await ctx.stream(addLine(ctx, '', 'd-reply'), reviewReply);

			// Dim redraws the touched diagrams and marks what moved.
			await flash(ctx, 'status', 1200);
			reviewChange(ctx, true);
			await ctx.sleep(600);
			ctx.$('review').classList.add('is-in');
			await ctx.sleep(1800);

			// Check the lines behind the change.
			await ctx.click(ctx.$$('[data-view="raw"]')[0]);
			showView(ctx, 'raw');
			await ctx.sleep(2800);
			await ctx.click(ctx.$$('[data-view="structure"]')[0]);
			showView(ctx, 'structure');
			await ctx.sleep(700);

			// One decision for the whole change.
			await ctx.click(ctx.$('accept'));
			ctx.$('review').classList.remove('is-in');
			clear(ctx, 'is-added', 'is-changed');
			ctx.$$('[data-d^="git-"]').forEach(badge => badge.classList.remove('is-in'));
			await flash(ctx, 'toast', 1600);
			await ctx.sleep(600);
		}
	});

	/* ====================================================================
	 * Feature 4: open a test file → its tests as a plain table → what is mocked → a change adds and edits tests.
	 * ==================================================================== */
	const cartTests = [
		{ name: 'adds a product', checks: 'A new product becomes one line', input: 'Empty cart, add a mug', expected: '1 item, total $12', mocks: '' },
		{ name: 'merges repeats', checks: 'The same product raises its quantity', input: 'Add a mug twice', expected: '1 item, quantity 2', mocks: '' },
		{ name: 'applies a coupon', checks: 'A coupon comes off the total', input: '$40 cart, 10% coupon', expected: 'Total $36', mocks: '', d: 'test-coupon' },
		{ name: 'prices in euros', checks: 'Totals use the shopper’s currency', input: '$40 cart, shopper in France', expected: 'Total €37', mocks: 'ExchangeRates' }
	];
	const addedTest = { name: 'rejects expired coupons', checks: 'An expired coupon is ignored', input: '$40 cart, expired coupon', expected: 'Total $40, error shown', mocks: 'Clock', d: 'test-new', isNew: true };

	function testRow({ name, checks, input, expected, mocks, d, isNew }) {
		const mocked = mocks ? `<code>${mocks}</code>` : '<span class="d-faint">None</span>';
		const badge = `<em class="d-test-badge">${isNew ? 'Added' : 'Changed'}</em>`;
		return `<tr class="${isNew ? 'd-test-new' : 'd-reveal'}"${d ? ` data-d="${d}"` : ''}>`
			+ `<td>${d ? badge : ''}<b>${name}</b></td><td>${checks}</td><td>${input}</td><td>${expected}</td><td>${mocked}</td></tr>`;
	}

	scene('tests', {
		width: 800,
		height: 590,
		html: () => `
			<aside class="d-explorer" style="width:168px">
				<div class="d-explorer-title">Explorer</div>
				${file('src', { folder: true })}
				${file('cart.ts')}
				${file('checkout.ts')}
				${file('test', { folder: true })}
				${file('cart.test.ts', { d: 'target', badge: 'M' })}
				${file('checkout.test.ts')}
			</aside>
			${main({
				tabs: '<div class="d-tab d-tab-new" data-d="tab">cart.test.ts</div>',
				viewNames: ['Raw', 'README', 'Structure'],
				viewOn: 'README',
				editor: `
					<div class="d-view d-empty is-shown" data-panel="empty"><span class="d-empty-mark">◐</span>Open a test file to see what it proves</div>
					<div class="d-view d-readme d-tests" data-panel="readme">
						<p><b>Checks that the cart adds products and works out the right total.</b></p>
						<h4 class="d-reveal">Tests</h4>
						<table class="d-reveal">
							<thead><tr><th>Test</th><th>What it checks</th><th>Input</th><th>Expected</th><th>Mocked</th></tr></thead>
							<tbody data-d="rows">${cartTests.map(testRow).join('')}${testRow(addedTest)}</tbody>
						</table>
						<h4 class="d-reveal">Validation</h4>
						<p class="d-reveal d-validation"><code>ExchangeRates</code> is mocked in 1 of <span data-d="count">4</span> tests<span class="d-mock-new" data-d="clock">, <code>Clock</code> in 1 of 5</span>. <span data-d="real">3 of 4 tests</span> run against the real code.</p>
					</div>
					<div class="d-review" data-d="review">
						<span class="d-legend"><i class="is-added"></i>Added<i class="is-changed"></i>Changed</span>
						<span class="d-btn">Reject All</span>
						<span class="d-btn d-btn-primary">Accept All</span>
					</div>`
			})}`,

		reset(ctx) {
			ctx.$('file-target').classList.remove('is-active');
			clear(ctx, 'is-in', 'is-added', 'is-changed');
			ctx.$('count').textContent = '4';
			ctx.$('real').textContent = '3 of 4 tests';
			showView(ctx, 'empty');
			ctx.place({ x: 470, y: 330 });
		},

		final(ctx) {
			ctx.$('file-target').classList.add('is-active');
			ctx.$('tab').classList.add('is-in');
			ctx.$$('.d-reveal').forEach(element => element.classList.add('is-in'));
			showView(ctx, 'readme');
			testsChange(ctx);
		},

		async play(ctx) {
			await ctx.sleep(700);
			await ctx.click(ctx.$('file-target'));
			ctx.$('file-target').classList.add('is-active');
			ctx.$('tab').classList.add('is-in');
			showView(ctx, 'readme');
			await ctx.pop(ctx.$$('.d-reveal'), 260);
			await ctx.sleep(2600);

			// A change to the tests waits for review, its rows marked.
			testsChange(ctx);
			await ctx.sleep(3200);
		}
	});

	/** Marks a change that edits one test and adds another, as the review shows it. */
	function testsChange(ctx) {
		ctx.$('test-coupon').classList.add('is-changed');
		ctx.$('test-new').classList.add('is-in', 'is-added');
		ctx.$('count').textContent = '5';
		ctx.$('clock').classList.add('is-in');
		ctx.$('real').textContent = '3 of 5 tests';
		ctx.$('review').classList.add('is-in');
	}

	function reviewChange(ctx, animate) {
		node(ctx, 'retry').classList.add('is-in', 'is-added');
		ctx.showEdge(ctx.state.edges['service>retry'], animate);
		['service', 'queue', 'order'].forEach(id => node(ctx, id).classList.add('is-changed'));
		ctx.$('row-retry').classList.add('is-in', 'is-added');
		ctx.$('row-error').classList.add('is-in', 'is-added');
		ctx.$('row-send').classList.add('is-changed');
		ctx.$('row-drain').classList.add('is-changed');
	}
})();

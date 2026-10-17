// Dim landing page: download label, theme toggle, sticky nav, diagram tabs, reveal on scroll.
// The live product demos are in demo.js and scenes.js.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Download button follows the visitor's OS ---------- */
function detectOs() {
	const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent;
	if (/mac/i.test(platform)) {
		return 'macOS';
	}
	if (/win/i.test(platform)) {
		return 'Windows';
	}
	if (/linux|x11/i.test(platform) && !/android/i.test(navigator.userAgent)) {
		return 'Linux';
	}
	return undefined;
}

// Asset names are fixed by the Dim Release workflow in lewibs/dim_code.
const downloadBase = 'https://github.com/lewibs/dim_code/releases/latest/download/';
const downloadFiles = {
	macOS: 'Dim-darwin-arm64.zip',
	Windows: 'Dim-win32-x64-setup.exe',
	Linux: 'Dim-linux-x64.tar.gz',
};

const os = detectOs();
if (os) {
	document.querySelectorAll('[data-download]').forEach(link => {
		link.href = downloadBase + downloadFiles[os];
	});
	document.querySelectorAll('[data-download-label]').forEach(label => {
		label.textContent = `Download for ${os}`;
	});
	const others = ['macOS', 'Windows', 'Linux'].filter(name => name !== os);
	document.querySelectorAll('[data-download-other]').forEach(note => {
		note.textContent = `Also available for ${others.join(' and ')}.`;
	});
}

/* ---------- Theme toggle ---------- */
const themeToggle = document.querySelector('[data-theme-toggle]');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function isDark() {
	const forced = document.documentElement.dataset.theme;
	return forced ? forced === 'dark' : systemDark.matches;
}

function syncThemeToggle() {
	const dark = isDark();
	document.documentElement.classList.toggle('is-dark', dark);
	themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

themeToggle.addEventListener('click', () => {
	const next = isDark() ? 'light' : 'dark';
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem('dim-theme', next);
	} catch { }
	syncThemeToggle();
});
systemDark.addEventListener('change', syncThemeToggle);
syncThemeToggle();

/* ---------- Nav border once the page scrolls ---------- */
const nav = document.querySelector('.nav');
const updateNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

/* ---------- Diagram kind tabs ---------- */
const kinds = {
	structure: {
		title: 'Structure',
		body: 'Classes, interfaces and functions, with the calls between them. Used for a service, a class hierarchy, or a module of helpers with no central class.',
		file: 'orderService.ts · Structure'
	},
	sequence: {
		title: 'Sequence',
		body: 'Who calls whom, in what order. Used for protocols, request handlers and anything that passes messages between parts.',
		file: 'checkout.ts · Sequence'
	},
	logic: {
		title: 'Logic',
		body: 'The branches and loops inside a function that makes decisions. Used when the interesting part is the control flow.',
		file: 'shipping.ts · Logic'
	},
	states: {
		title: 'States',
		body: 'The states something moves through and what moves it between them. Used for lifecycles, connections and long-running jobs.',
		file: 'order.ts · States'
	},
	data: {
		title: 'Data',
		body: 'Records and how they relate. Used for schemas, storage formats and the shapes that get serialized.',
		file: 'schema.ts · Data'
	}
};

const tabs = Array.from(document.querySelectorAll('.tabs [role="tab"]'));
const panel = document.querySelector('.kind-panel');
const kindDemo = panel.querySelector('[data-kind-demo]');

function selectKind(id, focus) {
	const kind = kinds[id];
	tabs.forEach(tab => {
		const selected = tab.dataset.kind === id;
		tab.setAttribute('aria-selected', String(selected));
		tab.tabIndex = selected ? 0 : -1;
		if (selected && focus) {
			tab.focus();
		}
	});

	panel.classList.add('is-switching');
	panel.querySelector('[data-kind-title]').textContent = kind.title;
	panel.querySelector('[data-kind-body]').textContent = kind.body;
	panel.querySelector('[data-kind-file]').textContent = kind.file;

	kindDemo.setAttribute('aria-label', `Demo: a ${kind.title.toLowerCase()} diagram of ${kind.file.split(' ')[0]} draws itself.`);
	window.dimDemo.mount(kindDemo, `kind-${id}`);

	requestAnimationFrame(() => panel.classList.remove('is-switching'));
}

tabs.forEach((tab, index) => {
	tab.addEventListener('click', () => selectKind(tab.dataset.kind, false));
	tab.addEventListener('keydown', event => {
		let next;
		if (event.key === 'ArrowRight') {
			next = tabs[(index + 1) % tabs.length];
		} else if (event.key === 'ArrowLeft') {
			next = tabs[(index - 1 + tabs.length) % tabs.length];
		}
		if (next) {
			event.preventDefault();
			selectKind(next.dataset.kind, true);
		}
	});
});

selectKind('structure', false);

/* ---------- Reveal on scroll ---------- */
const revealTargets = document.querySelectorAll('.feature, .section-head, .window-wide, .review-points > div, .card, .kind-panel, .faq-list');
if ('IntersectionObserver' in window && !reducedMotion) {
	const revealObserver = new IntersectionObserver(entries => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-visible');
				revealObserver.unobserve(entry.target);
			}
		}
	}, { threshold: 0.12 });
	revealTargets.forEach(target => {
		target.classList.add('reveal');
		revealObserver.observe(target);
	});
}

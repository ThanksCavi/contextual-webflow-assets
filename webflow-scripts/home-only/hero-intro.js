/**
 * Hero Lottie Intro
 * -----------------
 * Runs only for the marked Home hero: .hero-spotlight[data-hero-intro="home"].
 * Existing lottie-mask.js remains responsible for Lottie setup, image slots,
 * and viewport-triggered playback for every [data-lottie-mask] instance.
 */
(function heroLottieIntroInit() {
	'use strict';

	var HERO_SELECTOR = '.hero-spotlight[data-hero-intro="home"]';
	var LOTTIE_SELECTOR = '[data-lottie-mask]';
	var MOBILE_QUERY = '(max-width: 767px)';
	var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	var READY_TIMEOUT = 5500;
	var INTRO_HOLD_DURATION = 2200;
	var LOTTIE_MOVE_DURATION = 1250;
	var FIELD_REVEAL_DELAY = 2500;
	var CONTENT_DURATION = 1250;
	var CONTENT_START_DELAY = 2700;
	var CONTENT_STAGGER = 120;
	var MOVE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
	var REVEAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

	function onReady(fn) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', fn, { once: true });
		} else {
			fn();
		}
	}

	function prefersReducedMotion() {
		return window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches;
	}

	function isMobileViewport() {
		return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
	}

	function nextFrame() {
		return new Promise(function(resolve) {
			requestAnimationFrame(function() {
				requestAnimationFrame(resolve);
			});
		});
	}

	function wait(ms) {
		return new Promise(function(resolve) {
			window.setTimeout(resolve, ms);
		});
	}

	function isLottieReady(lottieEl) {
		var state = lottieEl.getAttribute('data-lottie-mask-ready');
		return state === 'playing' || state === 'static' || state === 'error' ||
			(!!lottieEl.querySelector('.lm-stage') && !!lottieEl.querySelector('.lm-visible'));
	}

	function waitForLottie(lottieEl) {
		if (isLottieReady(lottieEl)) return Promise.resolve(true);

		return new Promise(function(resolve) {
			var done = false;
			var observer = null;

			function finish(value) {
				if (done) return;
				done = true;
				if (observer) observer.disconnect();
				resolve(value);
			}

			observer = new MutationObserver(function() {
				if (isLottieReady(lottieEl)) finish(true);
			});

			observer.observe(lottieEl, {
				attributes: true,
				attributeFilter: ['data-lottie-mask-ready'],
				childList: true,
				subtree: true
			});

			window.setTimeout(function() {
				finish(isLottieReady(lottieEl));
			}, READY_TIMEOUT);
		});
	}

	function getRevealElements(hero) {
		var elements = [];
		var nav = document.querySelector('.navbar.w-nav');
		var markedItems = hero.querySelectorAll('[data-hero-intro-reveal]');

		if (nav) elements.push(nav);
		Array.prototype.forEach.call(markedItems, function(item) {
			elements.push(item);
		});

		return elements.filter(function(el, index, list) {
			return el && list.indexOf(el) === index;
		});
	}

	function setInitialStyles(lottieShell, revealElements) {
		lottieShell.style.opacity = '1';
		lottieShell.style.transformOrigin = '50% 50%';
		lottieShell.style.willChange = 'transform';

		revealElements.forEach(function(el) {
			el.style.opacity = '0';
			el.style.transform = 'translate3d(0, 24px, 0)';
			el.style.willChange = 'opacity, transform';
		});
	}

	function clearInlineStyles(lottieShell, revealElements) {
		lottieShell.style.opacity = '';
		lottieShell.style.transform = '';
		lottieShell.style.transformOrigin = '';
		lottieShell.style.willChange = '';

		revealElements.forEach(function(el) {
			el.style.opacity = '';
			el.style.transform = '';
			el.style.willChange = '';
		});
	}

	function revealStatic(hero, lottieShell, revealElements) {
		hero.classList.remove('is-hero-intro-running');
		hero.classList.add('is-hero-intro-static');
		hero.classList.add('is-hero-intro-field-visible');
		hero.setAttribute('data-hero-intro-ready', 'static');
		if (lottieShell) clearInlineStyles(lottieShell, revealElements || []);
	}

	function getIntroTransform(rect) {
		var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
		var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
		var rectCenterX = rect.left + rect.width / 2;
		var rectCenterY = rect.top + rect.height / 2;
		var introMaxSize = Math.min(viewportWidth * 0.34, viewportHeight * 0.46);
		var largestSide = Math.max(rect.width, rect.height);
		var scale = largestSide > 0 ? introMaxSize / largestSide : 1;

		scale = Math.max(0.56, Math.min(0.88, scale));

		return {
			x: viewportWidth / 2 - rectCenterX,
			y: viewportHeight / 2 - rectCenterY,
			scale: scale
		};
	}

	function animateElement(el, keyframes, options) {
		if (typeof el.animate === 'function') {
			var animation = el.animate(keyframes, options);
			el._heroIntroAnimation = animation;
			return wait((options.delay || 0) + (options.duration || 0));
		}

		var lastFrame = keyframes[keyframes.length - 1];
		Object.keys(lastFrame).forEach(function(prop) {
			el.style[prop] = lastFrame[prop];
		});
		return wait((options.delay || 0) + (options.duration || 0));
	}

	function runIntro(hero, lottieShell, revealElements) {
		var rect = lottieShell.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			revealStatic(hero, lottieShell, revealElements);
			return Promise.resolve();
		}

		var start = getIntroTransform(rect);
		var startTransform = 'translate3d(' + start.x.toFixed(2) + 'px, ' + start.y.toFixed(2) + 'px, 0) scale(' + start.scale.toFixed(3) + ')';

		hero.classList.add('is-hero-intro-running');
		setInitialStyles(lottieShell, revealElements);
		lottieShell.style.transform = startTransform;

		return nextFrame().then(function() {
			window.setTimeout(function() {
				hero.classList.add('is-hero-intro-field-visible');
			}, FIELD_REVEAL_DELAY);

			var animations = [
				animateElement(lottieShell, [
					{ transform: startTransform, opacity: 1 },
					{ transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
				], {
					duration: LOTTIE_MOVE_DURATION,
					delay: INTRO_HOLD_DURATION,
					easing: MOVE_EASE,
					fill: 'forwards'
				})
			];

			revealElements.forEach(function(el, index) {
				animations.push(animateElement(el, [
					{ opacity: 0, transform: 'translate3d(0, 24px, 0)' },
					{ opacity: 1, transform: 'translate3d(0, 0, 0)' }
				], {
					duration: CONTENT_DURATION,
					delay: CONTENT_START_DELAY + index * CONTENT_STAGGER,
					easing: REVEAL_EASE,
					fill: 'forwards'
				}));
			});

			return Promise.all(animations);
		}).then(function() {
			hero.classList.remove('is-hero-intro-running');
			hero.classList.add('is-hero-intro-complete');
			hero.setAttribute('data-hero-intro-ready', 'complete');
			clearInlineStyles(lottieShell, revealElements);
		});
	}

	function init() {
		var hero = document.querySelector(HERO_SELECTOR);
		if (!hero || hero.hasAttribute('data-hero-intro-ready')) return;

		hero.setAttribute('data-hero-intro-ready', 'pending');

		var lottieEl = hero.querySelector(LOTTIE_SELECTOR);
		var lottieShell = lottieEl && (lottieEl.closest('.lottie-component') || lottieEl);
		var revealElements = getRevealElements(hero);

		if (!lottieEl || !lottieShell || prefersReducedMotion() || isMobileViewport()) {
			revealStatic(hero, lottieShell, revealElements);
			return;
		}

		if (typeof window.lottie === 'undefined') {
			revealStatic(hero, lottieShell, revealElements);
			return;
		}

		waitForLottie(lottieEl).then(function(isReady) {
			if (!isReady) {
				revealStatic(hero, lottieShell, revealElements);
				return;
			}

			return nextFrame().then(function() {
				return runIntro(hero, lottieShell, revealElements);
			});
		}).catch(function(err) {
			revealStatic(hero, lottieShell, revealElements);
			if (window.console && typeof window.console.warn === 'function') {
				window.console.warn('[hero-intro] Intro skipped:', err);
			}
		});
	}

	onReady(init);
})();

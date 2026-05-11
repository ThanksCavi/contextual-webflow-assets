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
	var HERO_READY_EVENT = 'contextual:hero-ready';
	var READY_TIMEOUT = 5500;
	var INTRO_HOLD_DURATION = 2200;
	var LOTTIE_MOVE_DURATION = 1350;
	var FIELD_REVEAL_DELAY = 2460;
	var PRIMARY_REVEAL_DELAY = 2820;
	var SECONDARY_REVEAL_DELAY = 3260;
	var NAV_REVEAL_DELAY = 3220;
	var PRIMARY_REVEAL_DURATION = 1650;
	var SECONDARY_REVEAL_DURATION = 1500;
	var NAV_REVEAL_DURATION = 1350;
	var PRIMARY_STAGGER = 115;
	var SECONDARY_STAGGER = 105;
	var MOVE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
	var REVEAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
	var NAV_REVEAL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

	function getRevealGroups(hero) {
		var nav = document.querySelector('.navbar.w-nav');
		var markedItems = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-intro-reveal]'));
		var primary = [];
		var secondary = [];

		markedItems.forEach(function(item, index) {
			var role = (item.getAttribute('data-hero-intro-reveal') || '').trim().toLowerCase();

			if (role === 'secondary' || role === 'supporting' || role === 'brands' || role === 'logos') {
				secondary.push(item);
				return;
			}

			if (role === 'primary' || role === 'content') {
				primary.push(item);
				return;
			}

			if (index < 3) {
				primary.push(item);
			} else {
				secondary.push(item);
			}
		});

		return {
			nav: nav,
			primary: primary,
			secondary: secondary,
			all: uniqueElements((nav ? [nav] : []).concat(primary, secondary))
		};
	}

	function uniqueElements(elements) {
		return elements.filter(function(el, index, list) {
			return el && list.indexOf(el) === index;
		});
	}

	function setInitialStyles(lottieShell, revealGroups) {
		lottieShell.style.opacity = '1';
		lottieShell.style.transformOrigin = '50% 50%';
		lottieShell.style.willChange = 'transform';

		revealGroups.all.forEach(function(el) {
			el.style.opacity = '0';
			el.style.transform = el === revealGroups.nav ? 'translate3d(0, -22px, 0)' : 'translate3d(0, 34px, 0)';
			el.style.filter = 'blur(8px)';
			el.style.willChange = 'opacity, transform, filter';
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
			el.style.filter = '';
			el.style.willChange = '';
		});
	}

	function revealStatic(hero, lottieShell, revealElements) {
		hero.classList.remove('is-hero-intro-running');
		hero.classList.add('is-hero-intro-static');
		hero.classList.add('is-hero-intro-field-visible');
		hero.setAttribute('data-hero-intro-ready', 'static');
		if (lottieShell) clearInlineStyles(lottieShell, revealElements || []);
		dispatchHeroReady(hero, 'static');
	}

	function dispatchHeroReady(hero, mode) {
		window.dispatchEvent(new CustomEvent(HERO_READY_EVENT, {
			detail: {
				hero: hero,
				mode: mode
			}
		}));
		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.refreshAll === 'function') {
			window.ContextualHomeMotion.refreshAll();
		}
	}

	function shouldSkipIntroForPagePosition(hero) {
		var currentScroll = Math.max(window.scrollY || window.pageYOffset || 0, 0);
		if (currentScroll > 2) return true;

		var rect = hero.getBoundingClientRect();
		var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

		return rect.bottom <= 0 || rect.top >= viewportHeight;
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

	function addRevealAnimation(animations, el, options) {
		animations.push(animateElement(el, [
			{
				opacity: 0,
				transform: options.fromTransform,
				filter: 'blur(8px)'
			},
			{
				opacity: 0.86,
				transform: options.settleTransform,
				filter: 'blur(1px)',
				offset: 0.72
			},
			{
				opacity: 1,
				transform: 'translate3d(0, 0, 0)',
				filter: 'blur(0px)'
			}
		], {
			duration: options.duration,
			delay: options.delay,
			easing: options.easing,
			fill: 'forwards'
		}));
	}

	function runIntro(hero, lottieShell, revealGroups) {
		var rect = lottieShell.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			revealStatic(hero, lottieShell, revealGroups.all);
			return Promise.resolve();
		}

		var start = getIntroTransform(rect);
		var startTransform = 'translate3d(' + start.x.toFixed(2) + 'px, ' + start.y.toFixed(2) + 'px, 0) scale(' + start.scale.toFixed(3) + ')';

		hero.classList.add('is-hero-intro-running');
		setInitialStyles(lottieShell, revealGroups);
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

			revealGroups.primary.forEach(function(el, index) {
				addRevealAnimation(animations, el, {
					fromTransform: 'translate3d(0, 34px, 0)',
					settleTransform: 'translate3d(0, -3px, 0)',
					duration: PRIMARY_REVEAL_DURATION,
					delay: PRIMARY_REVEAL_DELAY + index * PRIMARY_STAGGER,
					easing: REVEAL_EASE
				});
			});

			revealGroups.secondary.forEach(function(el, index) {
				addRevealAnimation(animations, el, {
					fromTransform: 'translate3d(0, 30px, 0)',
					settleTransform: 'translate3d(0, -2px, 0)',
					duration: SECONDARY_REVEAL_DURATION,
					delay: SECONDARY_REVEAL_DELAY + index * SECONDARY_STAGGER,
					easing: REVEAL_EASE
				});
			});

			if (revealGroups.nav) {
				addRevealAnimation(animations, revealGroups.nav, {
					fromTransform: 'translate3d(0, -22px, 0)',
					settleTransform: 'translate3d(0, 2px, 0)',
					duration: NAV_REVEAL_DURATION,
					delay: NAV_REVEAL_DELAY,
					easing: NAV_REVEAL_EASE
				});
			}

			return Promise.all(animations);
		}).then(function() {
			hero.classList.remove('is-hero-intro-running');
			hero.classList.add('is-hero-intro-complete');
			hero.setAttribute('data-hero-intro-ready', 'complete');
			clearInlineStyles(lottieShell, revealGroups.all);
			dispatchHeroReady(hero, 'complete');
		});
	}

	function init() {
		var hero = document.querySelector(HERO_SELECTOR);
		if (!hero || hero.hasAttribute('data-hero-intro-ready')) return;

		hero.setAttribute('data-hero-intro-ready', 'pending');

		var lottieEl = hero.querySelector(LOTTIE_SELECTOR);
		var lottieShell = lottieEl && (lottieEl.closest('.lottie-component') || lottieEl);
		var revealGroups = getRevealGroups(hero);

		if (shouldSkipIntroForPagePosition(hero)) {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		if (!lottieEl || !lottieShell || prefersReducedMotion() || isMobileViewport()) {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		if (typeof window.lottie === 'undefined') {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		waitForLottie(lottieEl).then(function(isReady) {
			if (!isReady) {
				revealStatic(hero, lottieShell, revealGroups.all);
				return;
			}

			return nextFrame().then(function() {
				return runIntro(hero, lottieShell, revealGroups);
			});
		}).catch(function(err) {
			revealStatic(hero, lottieShell, revealGroups.all);
			if (window.console && typeof window.console.warn === 'function') {
				window.console.warn('[hero-intro] Intro skipped:', err);
			}
		});
	}

	onReady(init);
})();

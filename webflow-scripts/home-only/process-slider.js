// Process Slider
(() => {
  const ROOT_SELECTOR = '[data-steps-slider]';
  const PIN_SELECTOR = '[data-steps-pin]';
  const SLIDER_SELECTOR = '.steps-slider';
  const VIEWPORT_SELECTOR = '[data-steps-viewport]';
  const TRACK_SELECTOR = '[data-steps-track]';
  const ITEM_SELECTOR = '.steps-item';
  const CARD_SELECTOR = '[data-steps-card]';
  const TOGGLE_SELECTOR = '[data-steps-toggle]';
  const REVEAL_SELECTOR = '[data-steps-reveal]';

  const OPEN_CLASS = 'is-open';
  const DESKTOP_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const REVEAL_SCROLL_DELAY_MS = 380;
  const REVEAL_SCROLL_PADDING = 48;
  const RESIZE_REFRESH_DELAY_MS = 120;

  let resizeTimer = null;
  let state = null;

  window.ProcessSlider = {
    refresh: refreshProcessSlider,
  };

  onMotionReady(initProcessSlider);
  window.addEventListener('resize', queueRefresh);

  function onMotionReady(callback) {
    if (window.ContextualHomeMotion?.ready) {
      window.ContextualHomeMotion.ready.then(callback);
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function initProcessSlider() {
    if (state) return;

    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    const pinFrame = root.querySelector(PIN_SELECTOR);
    const slider = root.querySelector(SLIDER_SELECTOR);
    const viewport = root.querySelector(VIEWPORT_SELECTOR);
    const track = root.querySelector(TRACK_SELECTOR);
    const items = Array.from(root.querySelectorAll(ITEM_SELECTOR));
    const steps = collectSteps(root);

    if (!slider || !viewport || !track || items.length === 0 || steps.length === 0) return;

    state = {
      root,
      pinFrame,
      slider,
      viewport,
      track,
      items,
      steps,
      matchMedia: null,
      scrollTrigger: null,
    };

    prepareAccordion(state);
    setupHorizontalScroll(state);
  }

  function collectSteps(root) {
    return Array.from(root.querySelectorAll(CARD_SELECTOR))
      .map((card, index) => {
        const toggle = card.querySelector(TOGGLE_SELECTOR);
        const reveal = card.querySelector(REVEAL_SELECTOR);

        if (!toggle || !reveal) return null;

        return { card, toggle, reveal, index };
      })
      .filter(Boolean);
  }

  function prepareAccordion(state) {
    state.steps.forEach((step) => {
      prepareReveal(step);
      prepareToggle(step, state);
      closeStep(step);
    });
  }

  function prepareReveal(step) {
    if (!step.reveal.id) {
      step.reveal.id = `process-step-reveal-${step.index + 1}`;
    }
  }

  function prepareToggle(step, state) {
    step.toggle.type = 'button';
    step.toggle.setAttribute('aria-controls', step.reveal.id);
    step.toggle.addEventListener('click', (event) => handleToggleClick(event, step, state));
  }

  function handleToggleClick(event, step, state) {
    const shouldOpen = !step.card.classList.contains(OPEN_CLASS);

    closeOtherSteps(step, state);

    if (shouldOpen) {
      openStep(step);
      preserveKeyboardFocus(event, step);
      requestRevealVisibilityCheck(step, state);
    } else {
      closeStep(step);
    }
  }

  function openStep(step) {
    setStepOpen(step, true);
  }

  function closeStep(step) {
    setStepOpen(step, false);
  }

  function closeOtherSteps(activeStep, state) {
    state.steps.forEach((step) => {
      if (step !== activeStep) {
        closeStep(step);
      }
    });
  }

  function setStepOpen(step, isOpen) {
    step.card.classList.toggle(OPEN_CLASS, isOpen);
    step.toggle.classList.toggle(OPEN_CLASS, isOpen);
    step.toggle.setAttribute('aria-expanded', String(isOpen));
    step.toggle.toggleAttribute('hidden', isOpen);
    step.reveal.setAttribute('aria-hidden', String(!isOpen));
  }

  function preserveKeyboardFocus(event, step) {
    if (event.detail !== 0) return;

    step.reveal.tabIndex = -1;
    step.reveal.focus({ preventScroll: true });
  }

  function requestRevealVisibilityCheck(step, state) {
    window.setTimeout(() => ensureRevealVisible(step, state), REVEAL_SCROLL_DELAY_MS);
  }

  function ensureRevealVisible(step, state) {
    if (!step.card.classList.contains(OPEN_CLASS) || isHorizontalPinActive(state)) return;

    const revealRect = step.reveal.getBoundingClientRect();
    const bottomOverflow = revealRect.bottom + REVEAL_SCROLL_PADDING - window.innerHeight;
    const topOverflow = REVEAL_SCROLL_PADDING - revealRect.top;
    const scrollDelta = bottomOverflow > 0 ? bottomOverflow : -Math.max(topOverflow, 0);

    if (scrollDelta === 0) return;

    window.scrollBy({
      top: scrollDelta,
      left: 0,
      behavior: getScrollBehavior(),
    });
  }

  function getScrollBehavior() {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth';
  }

  function isHorizontalPinActive(state) {
    return Boolean(state.scrollTrigger && state.scrollTrigger.isActive);
  }

  function setupHorizontalScroll(state) {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    if (!gsap || !ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);

    if (state.matchMedia) {
      state.matchMedia.revert();
    }

    state.matchMedia = gsap.matchMedia();
    state.matchMedia.add(DESKTOP_QUERY, () => createHorizontalScroll(state, gsap));
  }

  function createHorizontalScroll(state, gsap) {
    const pinTarget = getPinTarget(state);

    if (getHorizontalDistance(state) <= 0) {
      gsap.set(state.track, { clearProps: 'transform' });
      return;
    }

    const tween = gsap.to(state.track, {
      x: () => -getHorizontalDistance(state),
      ease: 'none',
      scrollTrigger: {
        trigger: pinTarget,
        start: () => getPinStart(state, pinTarget),
        end: () => `+=${getHorizontalDistance(state)}`,
        scrub: true,
        pin: pinTarget,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    const scrollTrigger = tween.scrollTrigger;

    state.scrollTrigger = scrollTrigger;

    return () => {
      scrollTrigger.kill();
      tween.kill();
      gsap.set(state.track, { clearProps: 'transform' });

      if (state.scrollTrigger === scrollTrigger) {
        state.scrollTrigger = null;
      }
    };
  }

  function getHorizontalDistance(state) {
    const contentRight = getTrackContentRight(state);
    const visibleRight = state.viewport.clientWidth - getTrackGap(state);

    return Math.max(0, contentRight - visibleRight);
  }

  function getTrackContentRight(state) {
    const lastItem = state.items[state.items.length - 1];

    return lastItem.offsetLeft + lastItem.offsetWidth;
  }

  function getTrackGap(state) {
    return parseFloat(getComputedStyle(state.track).gap) || 0;
  }

  function getPinTarget(state) {
    if (state.pinFrame) {
      const pinFrameHeight = state.pinFrame.getBoundingClientRect().height;
      const pinFrameFitsViewport = pinFrameHeight <= window.innerHeight;

      return pinFrameFitsViewport ? state.pinFrame : state.slider;
    }

    const sectionHeight = state.root.getBoundingClientRect().height;
    const sectionFitsViewport = sectionHeight <= window.innerHeight;

    return sectionFitsViewport ? state.root : state.slider;
  }

  function getPinStart(state, pinTarget) {
    if (pinTarget === state.pinFrame) {
      return `top ${getRootTopOffset(state)}px`;
    }

    return 'top top';
  }

  function getRootTopOffset(state) {
    const paddingTop = parseFloat(getComputedStyle(state.root).paddingTop);

    return Number.isFinite(paddingTop) ? paddingTop : 0;
  }

  function refreshProcessSlider(options = {}) {
    initProcessSlider();

    if (state) {
      setupHorizontalScroll(state);
    }

    if (!options.skipGlobalRefresh && window.ScrollTrigger) {
      window.ScrollTrigger.refresh(true);
    }
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshProcessSlider, RESIZE_REFRESH_DELAY_MS);
  }
})();

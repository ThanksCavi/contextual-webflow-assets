/**
 * ScrollSmoother runtime
 * Loads GSAP ScrollSmoother and wraps page content without owning component
 * animation lifecycles.
 */
(() => {
  const PLUGIN_SRC = 'https://cdn.prod.website-files.com/gsap/3.15.0/ScrollSmoother.min.js';
  const WRAPPER_ID = 'smooth-wrapper';
  const CONTENT_ID = 'smooth-content';
  const NON_VISUAL_SELECTOR = 'script, style, noscript';
  const EXCLUDE_SELECTOR = '.navbar, [data-smooth-exclude]';
  const INIT_FLAG = '__contextualHomeScrollSmootherInit';
  const READY_EVENT = 'contextual:smoother-ready';
  const TOP_OFFSET_VAR = '--smooth-excluded-top';

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  const smoothElements = ensureSmoothStructure();
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  window.ContextualHomeMotion = window.ContextualHomeMotion || {};
  Object.assign(window.ContextualHomeMotion, {
    ready,
    ensureSmoothStructure,
    refreshAll,
  });

  loadScrollSmoother()
    .then(initScrollSmoother)
    .catch((error) => {
      console.warn('[home-scroll-smoother] Init failed.', error);
      markReady(null);
    });

  function loadScrollSmoother() {
    if (window.ScrollSmoother) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${PLUGIN_SRC}"]`);

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = PLUGIN_SRC;
      script.type = 'text/javascript';
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function initScrollSmoother() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const ScrollSmoother = window.ScrollSmoother;

    if (!gsap || !ScrollTrigger || !ScrollSmoother) {
      console.warn('[home-scroll-smoother] GSAP ScrollSmoother is not available.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    const elements = smoothElements || ensureSmoothStructure();
    if (!elements) {
      markReady(null);
      return;
    }

    let smoother = ScrollSmoother.get && ScrollSmoother.get();

    if (!smoother) {
      smoother = ScrollSmoother.create({
        wrapper: elements.wrapper,
        content: elements.content,
        smooth: 0.8,
        effects: false,
        smoothTouch: false,
      });
    }

    syncExcludedTopOffset(elements.content);
    markReady(smoother);

    window.addEventListener(
      'load',
      () => {
        scheduleSettledRefresh();
      },
      { once: true },
    );

    window.addEventListener('resize', () => {
      syncExcludedTopOffset(elements.content);
      scheduleSettledRefresh();
    });
  }

  function markReady(smoother) {
    window.ContextualHomeMotion.smoother = smoother;
    resolveReady(window.ContextualHomeMotion);
    window.dispatchEvent(new CustomEvent(READY_EVENT, {
      detail: {
        smoother,
      },
    }));
    scheduleSettledRefresh();
  }

  function scheduleSettledRefresh() {
    const fontReady = document.fonts?.ready || Promise.resolve();

    Promise.resolve(fontReady)
      .catch(() => null)
      .then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(refreshAll);
        });
      });
  }

  function refreshAll() {
    syncExcludedTopOffset(document.getElementById(CONTENT_ID));

    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }

  function ensureSmoothStructure() {
    const body = document.body;
    if (!body) return null;

    let wrapper = document.getElementById(WRAPPER_ID);
    let content = document.getElementById(CONTENT_ID);

    if (wrapper && content && wrapper.contains(content)) {
      keepExcludedElementsOutsideSmoothContent(body, wrapper);
      return { wrapper, content };
    }

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = WRAPPER_ID;
    }

    if (!content) {
      content = document.createElement('div');
      content.id = CONTENT_ID;
    }

    if (wrapper.parentElement !== body) {
      body.insertBefore(wrapper, getFirstBodyScriptOrStyle(body) || null);
    }

    if (content.parentElement !== wrapper) {
      wrapper.appendChild(content);
    }

    keepExcludedElementsOutsideSmoothContent(body, wrapper);

    const visualChildren = getVisualBodyChildren(body, wrapper);
    visualChildren.forEach((child) => content.appendChild(child));
    syncExcludedTopOffset(content);

    return { wrapper, content };
  }

  function getFirstBodyScriptOrStyle(body) {
    return Array.from(body.children).find((child) => child.matches(NON_VISUAL_SELECTOR));
  }

  function keepExcludedElementsOutsideSmoothContent(body, wrapper) {
    const content = document.getElementById(CONTENT_ID);
    if (!content) return;

    Array.from(content.children).forEach((child) => {
      if (shouldExcludeFromSmoothContent(child)) {
        body.insertBefore(child, wrapper);
      }
    });
  }

  function getVisualBodyChildren(body, wrapper) {
    return Array.from(body.children).filter((child) => (
      child !== wrapper &&
      !child.matches(NON_VISUAL_SELECTOR) &&
      !shouldExcludeFromSmoothContent(child)
    ));
  }

  function shouldExcludeFromSmoothContent(element) {
    return element.matches(EXCLUDE_SELECTOR);
  }

  function syncExcludedTopOffset(content) {
    if (!content) return;

    const topOffset = getExcludedTopOffset();
    content.style.setProperty(TOP_OFFSET_VAR, `${topOffset}px`);
    content.style.paddingTop = topOffset > 0 ? `var(${TOP_OFFSET_VAR})` : '';
  }

  function getExcludedTopOffset() {
    return Array.from(document.body.children).reduce((offset, child) => {
      if (!shouldExcludeFromSmoothContent(child) || !isNormalFlowTopElement(child)) return offset;

      const rect = child.getBoundingClientRect();
      return Math.max(offset, Math.round(rect.bottom));
    }, 0);
  }

  function isNormalFlowTopElement(element) {
    const styles = getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden') return false;
    if (styles.position === 'fixed' || styles.position === 'absolute') return false;

    const rect = element.getBoundingClientRect();
    return rect.top <= 1 && rect.bottom > 0;
  }
})();

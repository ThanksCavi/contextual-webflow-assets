/**
 * Home ScrollSmoother dev loader
 * Temporary local-server entrypoint for Webflow staging QA.
 */
(() => {
  const PLUGIN_SRC = 'https://cdn.prod.website-files.com/gsap/3.15.0/ScrollSmoother.min.js';
  const WRAPPER_ID = 'smooth-wrapper';
  const CONTENT_ID = 'smooth-content';
  const SCRIPT_STYLE_SELECTOR = 'script, style';
  const INIT_FLAG = '__contextualHomeScrollSmootherInit';

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  loadScrollSmoother()
    .then(initScrollSmoother)
    .catch((error) => {
      console.warn('[home-scroll-smoother] Init failed.', error);
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

    if (ScrollSmoother.get && ScrollSmoother.get()) {
      return;
    }

    const smoothElements = ensureSmoothStructure();
    if (!smoothElements) return;

    ScrollSmoother.create({
      wrapper: smoothElements.wrapper,
      content: smoothElements.content,
      smooth: 0.8,
      effects: false,
      smoothTouch: false,
    });

    window.addEventListener(
      'load',
      () => {
        ScrollTrigger.refresh(true);
      },
      { once: true },
    );
  }

  function ensureSmoothStructure() {
    const body = document.body;
    if (!body) return null;

    let wrapper = document.getElementById(WRAPPER_ID);
    let content = document.getElementById(CONTENT_ID);

    if (wrapper && content && wrapper.contains(content)) {
      return { wrapper, content };
    }

    const firstScriptOrStyle = Array.from(body.children).find((child) => child.matches(SCRIPT_STYLE_SELECTOR));

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = WRAPPER_ID;
    }

    if (!content) {
      content = document.createElement('div');
      content.id = CONTENT_ID;
    }

    if (wrapper.parentElement !== body) {
      body.insertBefore(wrapper, firstScriptOrStyle || body.firstChild);
    }

    if (content.parentElement !== wrapper) {
      wrapper.appendChild(content);
    }

    const visualChildren = getVisualBodyChildrenBefore(firstScriptOrStyle, wrapper);
    visualChildren.forEach((child) => content.appendChild(child));

    return { wrapper, content };
  }

  function getVisualBodyChildrenBefore(stopElement, wrapper) {
    const children = [];
    let child = document.body.firstElementChild;

    while (child && child !== stopElement) {
      const next = child.nextElementSibling;

      if (child !== wrapper && !child.matches(SCRIPT_STYLE_SELECTOR)) {
        children.push(child);
      }

      child = next;
    }

    return children;
  }
})();

// Solution Architecture
(() => {
  const ROOT_SELECTOR = '[data-sa-root]';
  const PIN_SELECTOR = '[data-sa-pin]';
  const STAGE_SELECTOR = '[data-sa-stage]';
  const STICKY_SELECTOR = '[data-sa-sticky]';
  const SCENE_SELECTOR = '[data-sa-scene]';
  const PANEL_SELECTOR = '[data-sa-panel]';
  const CARD_SELECTOR = '[data-sa-card]';
  const LINE_SELECTOR = '[data-sa-line]';
  const HEADING_SELECTOR = '.sa-heading';
  const OUTCOME_SELECTOR = '.sa-outcome, .outcome';
  const OUTCOME_CARD_SELECTOR = '.sa-outcome-card, .card';
  const END_ARROW_SELECTOR = '.sa-arrows-end';
  const INTRO_ARROW_EMBED_SELECTOR = '.sa-intro-arrow-embed';
  const INTRO_ARROW_SELECTOR = '.sa-intro-arrow';
  const FINAL_REVEAL_SELECTOR = '[data-sa-card-description]';
  const FOCUSABLE_SELECTOR = 'a, button, input, select, textarea, [tabindex]';

  const READY_CLASS = 'is-sa-ready';
  const STATIC_CLASS = 'is-sa-static';
  const INITIAL_CLASS = 'is-sa-initial';
  const TRANSITION_CLASS = 'is-sa-transition';
  const FINAL_CLASS = 'is-sa-final';
  const DISABLED_FOCUS_CLASS = 'is-sa-focus-disabled';
  const ORIGINAL_TABINDEX_ATTRIBUTE = 'data-sa-original-tabindex';
  const TARGET_OPACITY_ATTRIBUTE = 'data-sa-target-opacity';
  const INTRO_LINE_VALUE = 'intro-arrow';
  const FINAL_LINE_VALUE = 'final-arrow';

  const DESKTOP_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const MIN_SCENE_PIN_OFFSET = 24;
  const HEADING_CLEARANCE_GAP = 24;

  const LAYOUT = {
    width: 1280,
    height: 473,
    finalEnd: { left: 0, top: 0, width: 1280, height: 473 },
    stackedExitX: -1300,
  };

  const CARD_ROLE_ALIASES = {
    source: ['source', 'invoice'],
    top: ['top', 'cost'],
    bottom: ['bottom', 'fleet'],
    final: ['final', 'flywheel'],
  };

  const instances = [];
  let resizeTimer = null;

  window.addEventListener('resize', queueRefresh);

  window.SolutionArchitecture = {
    refresh: refreshAll,
  };

  onMotionReady(initAll);

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

  function initAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
  }

  function initRoot(root) {
    if (instances.some(instance => instance.root === root)) return;

    const stage = root.querySelector(STAGE_SELECTOR);
    const sticky = root.querySelector(STICKY_SELECTOR);
    const scene = root.querySelector(SCENE_SELECTOR);
    const panel = root.querySelector(PANEL_SELECTOR);
    const pinFrame = root.querySelector(PIN_SELECTOR);

    if (!stage || !sticky || !scene || !panel) return;

    const cards = collectCards(panel);

    if (!hasRequiredCards(cards)) return;

    const state = {
      root,
      stage,
      sticky,
      scene,
      pinFrame,
      pinLayout: sticky.querySelector('.sa-pin-layout') || sticky,
      heading: root.querySelector(HEADING_SELECTOR),
      panel,
      cards,
      outcome: root.querySelector(OUTCOME_SELECTOR),
      outcomeCard: null,
      endArrow: null,
      introArrow: root.querySelector(INTRO_ARROW_EMBED_SELECTOR) || root.querySelector(INTRO_ARROW_SELECTOR),
      outcomeParent: null,
      outcomeNextSibling: null,
      outcomeSpace: 0,
      lines: Array.from(root.querySelectorAll(LINE_SELECTOR)),
      focusables: collectFocusableCards(cards),
      matchMedia: null,
      timeline: null,
      lineTween: null,
      introLineTween: null,
      outcomeTween: null,
      headingOriginalMarginBottom: null,
      headingBaseMarginBottom: null,
      phase: '',
    };

    state.outcomeCard = state.outcome ? state.outcome.querySelector(OUTCOME_CARD_SELECTOR) : null;
    state.endArrow = state.outcome ? state.outcome.querySelector(END_ARROW_SELECTOR) : root.querySelector(END_ARROW_SELECTOR);
    state.outcomeParent = state.outcome ? state.outcome.parentElement : null;
    state.outcomeNextSibling = state.outcome ? state.outcome.nextElementSibling : null;

    instances.push(state);
    setStaticState(state);
    setupResponsiveAnimation(state);
  }

  function collectCards(panel) {
    const found = Array.from(panel.children).filter(card => card.matches(CARD_SELECTOR));

    return Object.keys(CARD_ROLE_ALIASES).reduce((cards, role) => {
      cards[role] = findCardByRole(found, role);
      return cards;
    }, {});
  }

  function findCardByRole(cards, role) {
    const aliases = CARD_ROLE_ALIASES[role] || [];

    return cards.find(card => aliases.includes(card.getAttribute('data-sa-card'))) || null;
  }

  function hasRequiredCards(cards) {
    return Boolean(cards.source && cards.top && cards.bottom && cards.final);
  }

  function collectFocusableCards(cards) {
    return Object.keys(cards).flatMap(cardName => (
      Array.from(cards[cardName].querySelectorAll(FOCUSABLE_SELECTOR)).map(element => ({
        cardName,
        element,
      }))
    ));
  }

  function setupResponsiveAnimation(state) {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    if (!gsap || !ScrollTrigger || !gsap.matchMedia) {
      setStaticState(state);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (state.matchMedia) {
      state.matchMedia.revert();
    }

    state.matchMedia = gsap.matchMedia();
    state.matchMedia.add(DESKTOP_QUERY, () => createDesktopAnimation(state, gsap));
  }

  function createDesktopAnimation(state, gsap) {
    const branchLines = getBranchLines(state);
    const finalReveal = Array.from(state.cards.final.querySelectorAll(FINAL_REVEAL_SELECTOR));

    setDesktopState(state);

    const pinTarget = getPinTarget(state);
    syncHeadingPinClearance(state, pinTarget);

    const triggerTarget = pinTarget === state.scene ? state.scene : state.stage;

    prepareLines(state, gsap);
    createLineReveal(branchLines, state, gsap);
    createIntroArrowReveal(state, gsap);
    createOutcomeReveal(state, gsap);

    const timeline = gsap.timeline({
      defaults: {
        ease: 'none',
      },
      scrollTrigger: {
        trigger: triggerTarget,
        start: () => getPinStart(state, pinTarget),
        end: () => `+=${getScrollDistance(state)}`,
        scrub: true,
        pin: pinTarget,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: self => updatePhaseFromProgress(state, self.progress),
        onRefresh: self => {
          updatePhaseFromProgress(state, self.progress);
        },
      },
    });

    state.timeline = timeline;

    timeline.set(state.cards.final, getFinalCardStartState(state), 0);
    timeline.set(finalReveal, {
      autoAlpha: 0,
    }, 0);
    timeline.set([state.cards.source, state.cards.top, state.cards.bottom], {
      autoAlpha: 1,
      x: 0,
      scale: 1,
    }, 0);
    timeline.set([state.cards.top, state.cards.bottom, state.cards.source], {
      '--sa-blue-overlay-opacity': 0,
    }, 0);

    timeline.to([state.cards.top, state.cards.bottom], {
      x: () => getScaledX(state, LAYOUT.stackedExitX),
      '--sa-blue-overlay-opacity': 0.3,
      duration: 0.42,
      ease: 'power1.inOut',
    }, 0.14);

    if (branchLines.length > 0) {
      timeline.to(branchLines, {
        autoAlpha: 0.42,
        duration: 0.16,
      }, 0.16);

      timeline.to(branchLines, {
        autoAlpha: 0,
        duration: 0.18,
      }, 0.62);
    }

    timeline.to(state.cards.final, {
      x: 0,
      duration: 0.50,
      ease: 'power1.inOut',
    }, 0.14);

    timeline.to(state.cards.source, {
      '--sa-blue-overlay-opacity': 0.3,
      duration: 0.25,
      ease: 'power1.inOut',
    }, 0.30);

    timeline.to(finalReveal, {
      autoAlpha: 1,
      duration: 0.24,
      ease: 'power2.out',
    }, 0.40);

    timeline.to({}, {
      duration: 0.08,
    }, 0.98);

    setPhase(state, 'initial');

    return () => {
      if (timeline.scrollTrigger) {
        timeline.scrollTrigger.kill();
      }

      timeline.kill();

      if (state.lineTween) {
        if (state.lineTween.scrollTrigger) {
          state.lineTween.scrollTrigger.kill();
        }

        state.lineTween.kill();
        state.lineTween = null;
      }

      if (state.introLineTween) {
        if (state.introLineTween.scrollTrigger) {
          state.introLineTween.scrollTrigger.kill();
        }

        state.introLineTween.kill();
        state.introLineTween = null;
      }

      if (state.outcomeTween) {
        if (state.outcomeTween.scrollTrigger) {
          state.outcomeTween.scrollTrigger.kill();
        }

        state.outcomeTween.kill();
        state.outcomeTween = null;
      }

      if (state.timeline === timeline) {
        state.timeline = null;
      }

      clearDesktopState(state, gsap);
    };
  }

  function getFinalCardStartState(state) {
    const layout = getFinalCardLayout(state);

    return {
      autoAlpha: 1,
      x: getScaledX(state, LAYOUT.width - LAYOUT.finalEnd.left + 10), // safety padding
      left: `${layout.end.left}px`,
      top: `${layout.end.top}px`,
      width: `${layout.end.width}px`,
      height: `${layout.end.height}px`,
      zIndex: 4,
    };
  }

  function getFinalCardLayout(state) {
    return {
      end: scaleBox(state, LAYOUT.finalEnd),
    };
  }

  function scaleBox(state, box) {
    const rect = state.panel.getBoundingClientRect();
    const scaleX = rect.width / LAYOUT.width;
    const scaleY = rect.height / LAYOUT.height;

    return {
      left: box.left * scaleX,
      top: box.top * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };
  }

  function getScaledX(state, value) {
    return value * (state.panel.getBoundingClientRect().width / LAYOUT.width);
  }

  function getScrollDistance(state) {
    const sceneWidth = state.panel.getBoundingClientRect().width || window.innerWidth;

    return Math.max(window.innerHeight * 2.25, sceneWidth * 1.35, 1400);
  }

  function getPinTarget(state) {
    if (state.pinFrame) {
      const pinFrameHeight = getCorePinFrameHeight(state, state.pinFrame);
      const pinFrameFitsViewport = pinFrameHeight <= window.innerHeight + 1;

      return pinFrameFitsViewport ? state.pinFrame : state.scene;
    }

    return state.scene;
  }

  function getCorePinFrameHeight(state, pinFrame) {
    const pinFrameRect = pinFrame.getBoundingClientRect();

    if (!state.outcome || !pinFrame.contains(state.outcome)) return pinFrameRect.height;

    const outcomeHeight = state.outcome.getBoundingClientRect().height;

    return Math.max(0, pinFrameRect.height - outcomeHeight);
  }

  function getPinStart(state, pinTarget) {
    if (pinTarget === state.pinFrame) {
      return `top ${getRootTopOffset(state)}px`;
    }

    if (pinTarget === state.scene) {
      return `top ${getScenePinOffset(state)}px`;
    }

    return 'top top';
  }

  function getScenePinOffset(state) {
    const sceneHeight = state.scene.getBoundingClientRect().height || state.panel.getBoundingClientRect().height;
    const centeredOffset = Math.round((window.innerHeight - sceneHeight) / 2);

    return Math.max(MIN_SCENE_PIN_OFFSET, centeredOffset);
  }

  function syncHeadingPinClearance(state, pinTarget) {
    if (!state.heading || pinTarget !== state.scene) {
      restoreHeadingMargin(state);
      return;
    }

    captureHeadingBaseMargin(state);

    const targetMargin = Math.max(
      state.headingBaseMarginBottom,
      getScenePinOffset(state) + HEADING_CLEARANCE_GAP,
    );

    state.heading.style.marginBottom = `${Math.ceil(targetMargin)}px`;
  }

  function captureHeadingBaseMargin(state) {
    if (!state.heading || state.headingBaseMarginBottom !== null) return;

    state.headingOriginalMarginBottom = state.heading.style.marginBottom;

    const marginBottom = parseFloat(getComputedStyle(state.heading).marginBottom);
    state.headingBaseMarginBottom = Number.isFinite(marginBottom) ? marginBottom : 0;
  }

  function restoreHeadingMargin(state) {
    if (!state.heading || state.headingBaseMarginBottom === null) return;

    state.heading.style.marginBottom = state.headingOriginalMarginBottom || '';
    state.headingOriginalMarginBottom = null;
    state.headingBaseMarginBottom = null;
  }

  function getRootTopOffset(state) {
    const paddingTop = parseFloat(getComputedStyle(state.root).paddingTop);

    return Number.isFinite(paddingTop) ? paddingTop : 0;
  }

  function prepareLines(state, gsap) {
    state.lines.forEach(line => {
      const length = getLineLength(line);
      const targetOpacity = storeTargetOpacity(line);
      const lineType = line.getAttribute('data-sa-line');
      const shouldStartHidden = lineType === FINAL_LINE_VALUE || lineType === INTRO_LINE_VALUE;

      line.setAttribute('aria-hidden', 'true');
      line.style.pointerEvents = 'none';

      if (length > 0) {
        gsap.set(line, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: shouldStartHidden ? 0 : targetOpacity,
          visibility: 'visible',
        });
      }
    });
  }

  function createLineReveal(lines, state, gsap) {
    if (lines.length === 0) return;

    const arrowheads = state.panel.querySelectorAll('.sa-arrowhead');
    if (arrowheads.length > 0) {
      gsap.set(arrowheads, { autoAlpha: 0 });
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: state.stage,
        start: 'top 70%',
        once: true,
      },
    });

    tl.to(lines, {
      strokeDashoffset: 0,
      duration: 1,
      stagger: 0.08,
      ease: 'power2.out',
    });

    if (arrowheads.length > 0) {
      tl.to(arrowheads, {
        autoAlpha: 1,
        duration: 0.3,
        stagger: 0.08,
      }, 0.7);
    }

    state.lineTween = tl;
  }

  function createIntroArrowReveal(state, gsap) {
    if (!state.introArrow) return;

    const lines = Array.from(state.introArrow.querySelectorAll(`[data-sa-line="${INTRO_LINE_VALUE}"]`));
    if (lines.length === 0) return;

    const arrowheads = Array.from(state.introArrow.querySelectorAll('.sa-arrowhead'));

    lines.forEach(line => {
      storeTargetOpacity(line);
      gsap.set(line, {
        opacity: 0,
        visibility: 'visible',
      });
    });

    arrowheads.forEach(arrowhead => {
      storeTargetOpacity(arrowhead);
      gsap.set(arrowhead, {
        opacity: 0,
        visibility: 'visible',
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: state.introArrow,
        start: 'top 86%',
        end: 'bottom 58%',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    tl.to(lines, {
      opacity: (_, target) => getStoredTargetOpacity(target),
      strokeDashoffset: 0,
      duration: 0.9,
      ease: 'power2.out',
    }, 0);

    if (arrowheads.length > 0) {
      tl.to(arrowheads, {
        opacity: (_, target) => getStoredTargetOpacity(target),
        duration: 0.2,
        ease: 'power2.out',
      }, 0.72);
    }

    state.introLineTween = tl;
  }

  function createOutcomeReveal(state, gsap) {
    if (!state.outcome && !state.endArrow && !state.outcomeCard) return;

    const drawLines = getFinalArrowLines(state);
    const arrowheads = state.endArrow ? Array.from(state.endArrow.querySelectorAll('.sa-arrowhead')) : [];
    const hasStrokeDraw = drawLines.length > 0;
    const endArrowOpacity = state.endArrow ? getElementOpacity(state.endArrow) : 1;

    if (state.outcome) {
      gsap.set(state.outcome, {
        autoAlpha: 1,
      });
    }

    if (state.outcomeCard) {
      gsap.set(state.outcomeCard, {
        autoAlpha: 0,
        y: 24,
      });
    }

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: state.outcome || state.endArrow,
        start: 'top 82%',
        end: 'bottom 58%',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    state.outcomeTween = timeline;

    if (hasStrokeDraw) {
      drawLines.forEach(line => {
        const length = getLineLength(line);
        storeTargetOpacity(line);

        line.setAttribute('aria-hidden', 'true');
        line.style.pointerEvents = 'none';

        if (length > 0) {
          gsap.set(line, {
            strokeDasharray: length,
            strokeDashoffset: length,
            opacity: 0,
            visibility: 'visible',
          });
        }
      });

      if (arrowheads.length > 0) {
        arrowheads.forEach(arrowhead => {
          storeTargetOpacity(arrowhead);
          gsap.set(arrowhead, {
            opacity: 0,
            visibility: 'visible',
          });
        });
      }

      timeline.set(drawLines, {
        visibility: 'visible',
      }, 0);

      timeline.to(drawLines, {
        opacity: (_, target) => getStoredTargetOpacity(target),
        strokeDashoffset: 0,
        duration: 0.60,
        ease: 'power2.out',
      }, 0);

      if (arrowheads.length > 0) {
        timeline.to(arrowheads, {
          opacity: (_, target) => getStoredTargetOpacity(target),
          duration: 0.14,
        }, 0.52);
      }
    } else if (state.endArrow) {
      gsap.set(state.endArrow, {
        opacity: 0,
        visibility: 'visible',
        clipPath: 'inset(0 0 100% 0)',
      });

      timeline.to(state.endArrow, {
        opacity: endArrowOpacity,
        clipPath: 'inset(0 0 0% 0)',
        duration: 0.60,
        ease: 'power2.out',
      }, 0);
    }

    if (state.outcomeCard) {
      timeline.to(state.outcomeCard, {
        autoAlpha: 1,
        y: 0,
        duration: 0.24,
        ease: 'power2.out',
      }, 0.70);
    }
  }

  function getLineLength(line) {
    try {
      return typeof line.getTotalLength === 'function' ? line.getTotalLength() : 0;
    } catch (error) {
      return 0;
    }
  }

  function getElementOpacity(element) {
    const opacity = parseFloat(window.getComputedStyle(element).opacity);

    return Number.isFinite(opacity) ? opacity : 1;
  }

  function storeTargetOpacity(element) {
    if (element.hasAttribute(TARGET_OPACITY_ATTRIBUTE)) {
      return getStoredTargetOpacity(element);
    }

    const targetOpacity = getElementOpacity(element);

    element.setAttribute(TARGET_OPACITY_ATTRIBUTE, String(targetOpacity));
    return targetOpacity;
  }

  function getStoredTargetOpacity(element) {
    const opacity = parseFloat(element.getAttribute(TARGET_OPACITY_ATTRIBUTE));

    return Number.isFinite(opacity) ? opacity : 1;
  }

  function updatePhaseFromProgress(state, progress) {
    if (progress >= 0.76) {
      setPhase(state, 'final');
      return;
    }

    if (progress >= 0.24) {
      setPhase(state, 'transition');
      return;
    }

    setPhase(state, 'initial');
  }

  function setPhase(state, phase) {
    if (state.phase === phase) return;

    state.phase = phase;
    state.root.classList.remove(INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS, STATIC_CLASS);

    if (phase === 'initial') {
      state.root.classList.add(INITIAL_CLASS);
      setVisibleCards(state, new Set(['source', 'top', 'bottom']));
      return;
    }

    if (phase === 'transition') {
      state.root.classList.add(TRANSITION_CLASS);
      setVisibleCards(state, new Set(['source', 'top', 'bottom', 'final']));
      return;
    }

    if (phase === 'final') {
      state.root.classList.add(FINAL_CLASS);
      setVisibleCards(state, new Set(['final']));
      return;
    }

    state.root.classList.add(STATIC_CLASS);
    setVisibleCards(state, null);
  }

  function setVisibleCards(state, visibleCards) {
    state.focusables.forEach(({ cardName, element }) => {
      const isVisible = !visibleCards || visibleCards.has(cardName);

      setElementFocusable(element, isVisible);
    });
  }

  function setElementFocusable(element, isFocusable) {
    if (isFocusable) {
      const originalTabindex = element.getAttribute(ORIGINAL_TABINDEX_ATTRIBUTE);

      element.classList.remove(DISABLED_FOCUS_CLASS);
      element.removeAttribute('aria-hidden');

      if (originalTabindex === null) return;

      if (originalTabindex === '') {
        element.removeAttribute('tabindex');
      } else {
        element.setAttribute('tabindex', originalTabindex);
      }

      return;
    }

    if (!element.hasAttribute(ORIGINAL_TABINDEX_ATTRIBUTE)) {
      element.setAttribute(ORIGINAL_TABINDEX_ATTRIBUTE, element.getAttribute('tabindex') || '');
    }

    element.classList.add(DISABLED_FOCUS_CLASS);
    element.setAttribute('tabindex', '-1');
    element.setAttribute('aria-hidden', 'true');
  }

  function setDesktopState(state) {
    state.root.classList.add(READY_CLASS);
    state.root.classList.remove(STATIC_CLASS);
    moveOutcomeToScene(state);
  }

  function moveOutcomeToScene(state) {
    if (!state.outcome || state.outcome.parentElement === state.scene) return;

    state.scene.appendChild(state.outcome);
    updateOutcomeSpace(state);
  }

  function updateOutcomeSpace(state) {
    if (!state.outcome) {
      state.pinLayout.style.removeProperty('--sa-outcome-space');
      return;
    }

    const outcomeHeight = state.outcome.getBoundingClientRect().height;
    const reserve = Math.ceil(outcomeHeight);

    state.outcomeSpace = reserve;
    state.pinLayout.style.setProperty('--sa-outcome-space', `${reserve}px`);
  }

  function restoreOutcomePosition(state) {
    if (!state.outcome || !state.outcomeParent || state.outcome.parentElement === state.outcomeParent) return;

    state.outcomeParent.insertBefore(state.outcome, state.outcomeNextSibling);
  }

  function getBranchLines(state) {
    return state.lines.filter(line => {
      const lineType = line.getAttribute('data-sa-line');

      return lineType !== FINAL_LINE_VALUE && lineType !== INTRO_LINE_VALUE;
    });
  }

  function getFinalArrowLines(state) {
    if (!state.endArrow) return [];

    return Array.from(state.endArrow.querySelectorAll(`[data-sa-line="${FINAL_LINE_VALUE}"]`));
  }

  function setStaticState(state) {
    state.root.classList.remove(READY_CLASS, INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS);
    state.phase = '';
    setPhase(state, 'static');
  }

  function clearDesktopState(state, gsap) {
    state.root.classList.remove(READY_CLASS, INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS);
    state.cards.top.style.removeProperty('--sa-blue-overlay-opacity');
    state.cards.bottom.style.removeProperty('--sa-blue-overlay-opacity');
    state.cards.source.style.removeProperty('--sa-blue-overlay-opacity');
    state.pinLayout.style.removeProperty('--sa-outcome-space');
    restoreHeadingMargin(state);
    state.lines.forEach(line => {
      line.style.pointerEvents = '';
    });

    gsap.set([
      state.cards.source,
      state.cards.top,
      state.cards.bottom,
      state.cards.final,
      state.scene,
      ...state.lines,
      ...(state.outcome ? [state.outcome] : []),
      ...(state.endArrow ? [state.endArrow] : []),
      ...(state.endArrow ? Array.from(state.endArrow.querySelectorAll('path')) : []),
      ...(state.introArrow ? [state.introArrow] : []),
      ...(state.introArrow ? Array.from(state.introArrow.querySelectorAll('path')) : []),
      ...(state.outcomeCard ? [state.outcomeCard] : []),
      ...state.cards.final.querySelectorAll(FINAL_REVEAL_SELECTOR),
    ], {
      clearProps: 'transform,opacity,visibility,clipPath,left,top,width,height,zIndex,strokeDasharray,strokeDashoffset',
    });

    state.lines.forEach(line => {
      line.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
    });

    if (state.endArrow) {
      state.endArrow.querySelectorAll('.sa-arrowhead').forEach(arrowhead => {
        arrowhead.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
      });
    }

    if (state.introArrow) {
      state.introArrow.querySelectorAll('.sa-arrowhead').forEach(arrowhead => {
        arrowhead.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
      });
    }

    restoreOutcomePosition(state);
    setStaticState(state);
  }

  function refreshAll(options = {}) {
    initAll();

    instances.forEach(state => {
      if (state.matchMedia) {
        state.matchMedia.revert();
        state.matchMedia = null;
      }

      setupResponsiveAnimation(state);
    });

    if (!options.skipGlobalRefresh && window.ScrollTrigger) {
      window.ScrollTrigger.refresh(true);
    }
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshAll, RESIZE_REFRESH_DELAY_MS);
  }
})();

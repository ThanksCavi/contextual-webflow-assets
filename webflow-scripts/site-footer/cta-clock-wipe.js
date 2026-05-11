// CTA Clock Wipe
(() => {
  const SECTION_SELECTOR = '[data-cta-wipe]';
  const STAGE_SELECTOR = '[data-cta-wipe-stage]';
  const BG_CLASS = 'cta-wipe__bg';
  const CANVAS_CLASS = 'cta-wipe__canvas';

  const TILE_ROWS = 4;
  const TILE_COLUMNS = 6;
  const DEFAULT_COLOR = '#ecf071';
  const DEFAULT_STAGE_EXTRA = '88vh';
  const MOBILE_QUERY = '(max-width: 767px)';

  const CONFIG = {
    columns: 6,
    cellMin: 180,
    cellMax: 240,
    heightMin: 680,
    heightMax: 840,
    heightRatio: 0.5833,
    anchorX: 0,
    anchorY: 0,
    key1: 0.24,
    key2: 0.57,
    key3: 0.81,
    expandStart: 0.8,
    expandEnd: 0.98,
    expandAmount: 1.36,
    expandWave: 0.18,
    solidStart: 0.985,
    solidEnd: 0.995,
    scrollStart: 0,
    scrollEnd: 0.12,
  };

  const PRIMARY_PATTERN = [
    [
      { from: 180, a1: 180, a2: 323 },
      { from: 270, a1: 180, a2: 324, dir: -1 },
      { from: 0, a1: 180, a2: 323 },
      { from: 90, a1: 180, a2: 270 },
      { from: 180, a1: 180, a2: 180 },
      { from: 270, a1: 180, a2: 270, dir: -1 },
    ],
    [
      { from: 270, a1: 180, a2: 321, dir: -1 },
      { from: 0, a1: 180, a2: 282 },
      { from: 90, a1: 180, a2: 313 },
      { from: 180, a1: 180, a2: 299 },
      { from: 270, a1: 180, a2: 313, dir: -1 },
      { from: 0, a1: 180, a2: 316 },
    ],
    [
      { from: 0, a1: 180, a2: 302 },
      { from: 90, a1: 180, a2: 294 },
      { from: 180, a1: 180, a2: 295, dir: -1 },
      { from: 270, a1: 180, a2: 303, dir: -1 },
      { from: 0, a1: 180, a2: 318 },
      { from: 90, a1: 180, a2: 302 },
    ],
    [
      { from: 90, a1: 180, a2: 300 },
      { from: 180, a1: 180, a2: 300 },
      { from: 270, a1: 180, a2: 270 },
      { from: 0, a1: 180, a2: 300 },
      { from: 90, a1: 180, a2: 300 },
      { from: 180, a1: 180, a2: 300 },
    ],
  ];
  const PATTERNS = {
    primary: PRIMARY_PATTERN,
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileViewport = window.matchMedia(MOBILE_QUERY);
  const instances = new Map();
  let ticking = false;

  injectStyles();
  onMotionReady(initAll);

  window.addEventListener('scroll', queueRender, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('load', handleResize, { once: true });
  prefersReducedMotion.addEventListener?.('change', handleResize);
  mobileViewport.addEventListener?.('change', handleResize);

  window.CTAWipe = {
    refresh(options = {}) {
      instances.forEach(instance => {
        instance.buildKey = '';
        render(instance);
        setupScrollTrigger(instance);
      });
      if (!options.skipGlobalRefresh) {
        refreshScrollTrigger();
      }
    },
  };

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
    document.querySelectorAll(SECTION_SELECTOR).forEach(section => {
      if (instances.has(section)) return;

      const stage = section.closest(STAGE_SELECTOR) || section.parentElement || section;
      if (stage.matches?.(STAGE_SELECTOR)) {
        stage.style.setProperty('--cta-stage-extra', stage.style.getPropertyValue('--cta-stage-extra') || DEFAULT_STAGE_EXTRA);
      }

      const bg = getOrCreateBackground(section);
      const canvas = bg.querySelector(`.${CANVAS_CLASS}`);
      const instance = {
        section,
        stage,
        bg,
        canvas,
        context: canvas.getContext('2d'),
        shapes: [],
        buildKey: '',
        scrollProgress: 0,
        scrollTrigger: null,
      };

      instances.set(section, instance);
      render(instance);
      setupScrollTrigger(instance);
      queueRender();
    });
  }

  function getOrCreateBackground(section) {
    const existing = Array.from(section.children).find(child => child.classList?.contains(BG_CLASS));
    if (existing) return existing;

    const bg = document.createElement('div');
    bg.className = BG_CLASS;
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = `<canvas class="${CANVAS_CLASS}"></canvas>`;
    section.insertBefore(bg, section.firstChild);
    return bg;
  }

  function handleResize() {
    instances.forEach(instance => {
      instance.buildKey = '';
      render(instance);
      setupScrollTrigger(instance);
    });
    refreshScrollTrigger();
  }

  function queueRender() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      instances.forEach(render);
    });
  }

  function render(instance, progressOverride) {
    const { section, stage, canvas, context } = instance;
    const color = getColor(section);

    stage.style.setProperty('--cta-wipe-yellow', color);

    if (shouldUseStaticFallback(section)) {
      destroyScrollTrigger(instance);
      stage.setAttribute('data-cta-wipe-static', 'true');
      section.style.setProperty('--cta-wipe-yellow', color);
      section.style.setProperty('--cta-wipe-title-scale', '1');
      section.style.setProperty('--cta-wipe-description-progress', '1');
      section.style.setProperty('--cta-wipe-description-y', '0px');
      section.style.setProperty('--cta-wipe-button-progress', '1');
      section.style.setProperty('--cta-wipe-button-y', '0px');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    stage.removeAttribute('data-cta-wipe-static');

    const config = getConfig(section);
    buildShapes(instance, config);

    const progress = getRenderProgress(instance, config, progressOverride);
    const visualProgress = lerp(config.key1, 1, progress);
    const solid = smooth(config.solidStart, config.solidEnd, visualProgress);
    const rect = section.getBoundingClientRect();
    const titleScale = lerp(1.18, 1, smooth(0.82, 0.98, progress));
    const description = section.querySelector('[data-cta-wipe-description]');
    const button = section.querySelector('[data-cta-wipe-button]');

    section.style.setProperty('--cta-wipe-yellow', color);
    section.style.setProperty('--cta-wipe-title-scale', titleScale.toFixed(4));
    const descriptionProgress = smooth(0.18, 0.42, progress);
    const buttonProgress = smooth(0.28, 0.52, progress);

    section.style.setProperty('--cta-wipe-description-progress', descriptionProgress.toFixed(4));
    section.style.setProperty('--cta-wipe-description-y', `${((1 - descriptionProgress) * 12).toFixed(2)}px`);
    section.style.setProperty('--cta-wipe-button-progress', buttonProgress.toFixed(4));
    section.style.setProperty('--cta-wipe-button-y', `${((1 - buttonProgress) * 14).toFixed(2)}px`);

    description?.style.setProperty('pointer-events', progress > 0.18 ? '' : 'none');
    button?.style.setProperty('pointer-events', progress > 0.28 ? '' : 'none');

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = color;
    context.globalAlpha = solid;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;

    if (solid >= 1) return;

    const dpr = window.devicePixelRatio || 1;

    context.save();
    context.scale(dpr, dpr);
    context.fillStyle = color;

    instance.shapes.forEach(shape => {
      const angle = getShapeAngle(shape, config, visualProgress);
      if (angle <= 0) return;

      const fromDeg = getShapeFrom(shape, angle);

      const dx = shape.x - rect.width / 2;
      const dy = shape.y - rect.height / 2;
      const distance = Math.hypot(dx, dy);
      const maxDistance = Math.hypot(rect.width / 2, rect.height / 2) || 1;
      const waveDelay = (distance / maxDistance) * config.expandWave;

      const scaleProgress = smooth(config.expandStart + waveDelay, config.expandEnd + waveDelay, visualProgress);
      const scale = lerp(1, config.expandAmount, scaleProgress);

      const radius = (shape.size / 2) * scale;

      if (angle >= 359.5) {
        context.beginPath();
        context.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
        context.fill();
        return;
      }

      const startAngleRad = (fromDeg - 90) * Math.PI / 180;
      const endAngleRad = (fromDeg + angle - 90) * Math.PI / 180;

      context.beginPath();
      context.moveTo(shape.x, shape.y);
      context.arc(shape.x, shape.y, radius, startAngleRad, endAngleRad);
      context.closePath();
      context.fill();
    });

    context.restore();
  }

  function buildShapes(instance, config) {
    const { section, stage, canvas, context } = instance;
    const rect = section.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const cell = Math.round(Math.max(config.cellMin, Math.min(config.cellMax, width / config.columns)));
    const targetHeight = Math.round(cell * 3.5);
    const designHeight = Math.round(Math.max(config.heightMin, Math.min(config.heightMax, width * config.heightRatio)));
    const sectionMinHeight = Math.max(targetHeight, designHeight);
    const patternName = section.dataset.wipePattern || 'primary';
    const tile = getPattern(section);

    section.style.setProperty('--cta-wipe-min-height', `${sectionMinHeight}px`);

    const height = Math.max(1, Math.round(section.getBoundingClientRect().height));
    stage.style.setProperty('--cta-stage-panel-height', `${height}px`);

    const dpr = window.devicePixelRatio || 1;
    const key = [width, height, cell, config.columns, config.cellMin, config.cellMax, config.heightMin, config.heightMax, config.heightRatio, config.anchorX, config.anchorY, patternName, dpr].join(':');

    if (key === instance.buildKey) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const tileWidth = TILE_COLUMNS * cell;
    const anchorX = width / 2 - tileWidth / 2 + config.anchorX;
    const anchorY = config.anchorY;
    const startCol = Math.floor((-cell - anchorX) / cell);
    const endCol = Math.ceil((width + cell - anchorX) / cell);
    const startRow = Math.floor((-cell - anchorY) / cell);
    const endRow = Math.ceil((height + cell - anchorY) / cell);
    const shapes = [];

    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startCol; column <= endCol; column += 1) {
        const source = tile[modulo(row, TILE_ROWS)][modulo(column, TILE_COLUMNS)];
        const x = anchorX + column * cell;
        const y = anchorY + row * cell;

        shapes.push({
          from: source.from,
          a1: source.a1,
          a2: source.a2,
          dir: source.dir || 1,
          x: x + cell / 2,
          y: y + cell / 2,
          size: cell
        });
      }
    }

    instance.shapes = shapes;
    instance.buildKey = key;
  }

  function getShapeAngle(shape, config, progress) {
    if (progress <= config.key1) {
      return lerp(0, shape.a1, smooth(0, config.key1, progress));
    }

    if (progress <= config.key2) {
      return lerp(shape.a1, shape.a2, smooth(config.key1, config.key2, progress));
    }

    if (progress <= config.key3) {
      return lerp(shape.a2, 360, smooth(config.key2, config.key3, progress));
    }

    return 360;
  }

  function getShapeFrom(shape, angle) {
    if (shape.dir !== -1) return shape.from;

    return shape.from + shape.a1 - angle;
  }

  function getScrollProgress(instance, config) {
    const stageRect = instance.stage.getBoundingClientRect();
    const sectionRect = instance.section.getBoundingClientRect();
    const pinDistance = Math.max(1, stageRect.height - sectionRect.height);
    const startOffset = pinDistance * clamp(config.scrollStart);
    const activeDistance = Math.max(1, pinDistance * (1 - clamp(config.scrollStart) - clamp(config.scrollEnd)));

    return clamp((-stageRect.top - startOffset) / activeDistance);
  }

  function getRenderProgress(instance, config, progressOverride) {
    if (Number.isFinite(progressOverride)) return clamp(progressOverride);
    if (instance.scrollTrigger) return clamp(instance.scrollProgress || 0);

    return getScrollProgress(instance, config);
  }

  function setupScrollTrigger(instance) {
    const ScrollTrigger = getScrollTrigger();
    if (!ScrollTrigger || shouldUseStaticFallback(instance.section)) {
      destroyScrollTrigger(instance);
      return;
    }

    instance.stage.classList.add('is-cta-wipe-scrolltrigger');
    instance.section.classList.add('is-cta-wipe-scrolltrigger');

    if (instance.scrollTrigger) {
      instance.scrollTrigger.refresh();
      return;
    }

    instance.scrollTrigger = ScrollTrigger.create({
      trigger: instance.stage,
      start: 'top top',
      end: () => `+=${getPinDistance(instance)}`,
      scrub: true,
      pin: instance.section,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: self => {
        instance.scrollProgress = self.progress;
        render(instance, self.progress);
      },
      onRefresh: self => {
        instance.buildKey = '';
        instance.scrollProgress = self.progress;
        render(instance, self.progress);
      },
    });
  }

  function destroyScrollTrigger(instance) {
    if (instance.scrollTrigger) {
      instance.scrollTrigger.kill();
      instance.scrollTrigger = null;
    }

    instance.scrollProgress = 0;
    instance.stage.classList.remove('is-cta-wipe-scrolltrigger');
    instance.section.classList.remove('is-cta-wipe-scrolltrigger');
  }

  function getPinDistance(instance) {
    return Math.max(1, Math.round(getStageExtraPixels(instance.stage)));
  }

  function getStageExtraPixels(stage) {
    const value = stage.style.getPropertyValue('--cta-stage-extra') || DEFAULT_STAGE_EXTRA;
    const trimmed = value.trim();

    if (trimmed.endsWith('vh')) {
      return (parseFloat(trimmed) / 100) * window.innerHeight;
    }

    if (trimmed.endsWith('vw')) {
      return (parseFloat(trimmed) / 100) * window.innerWidth;
    }

    if (trimmed.endsWith('px')) {
      return parseFloat(trimmed);
    }

    const numeric = parseFloat(trimmed);
    return Number.isFinite(numeric) ? numeric : window.innerHeight * 0.88;
  }

  function getScrollTrigger() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return null;

    gsap.registerPlugin(ScrollTrigger);
    return ScrollTrigger;
  }

  function refreshScrollTrigger() {
    if (window.ScrollTrigger) {
      window.ScrollTrigger.refresh(true);
    }
  }

  function getConfig(section) {
    return {
      columns: getNumber(section, 'wipeColumns', CONFIG.columns),
      cellMin: getNumber(section, 'wipeCellMin', CONFIG.cellMin),
      cellMax: getNumber(section, 'wipeCellMax', CONFIG.cellMax),
      heightMin: getNumber(section, 'wipeHeightMin', CONFIG.heightMin),
      heightMax: getNumber(section, 'wipeHeightMax', CONFIG.heightMax),
      heightRatio: getNumber(section, 'wipeHeightRatio', CONFIG.heightRatio),
      anchorX: getNumber(section, 'wipeAnchorX', CONFIG.anchorX),
      anchorY: getNumber(section, 'wipeAnchorY', CONFIG.anchorY),
      key1: getNumber(section, 'wipeKey1', CONFIG.key1),
      key2: getNumber(section, 'wipeKey2', CONFIG.key2),
      key3: getNumber(section, 'wipeKey3', CONFIG.key3),
      expandStart: getNumber(section, 'wipeExpandStart', CONFIG.expandStart),
      expandEnd: getNumber(section, 'wipeExpandEnd', CONFIG.expandEnd),
      expandAmount: getNumber(section, 'wipeExpandAmount', CONFIG.expandAmount),
      expandWave: getNumber(section, 'wipeExpandWave', CONFIG.expandWave),
      solidStart: getNumber(section, 'wipeSolidStart', CONFIG.solidStart),
      solidEnd: getNumber(section, 'wipeSolidEnd', CONFIG.solidEnd),
      scrollStart: getNumber(section, 'wipeStart', CONFIG.scrollStart),
      scrollEnd: getNumber(section, 'wipeEnd', CONFIG.scrollEnd),
    };
  }

  function getNumber(element, key, fallback) {
    const value = Number(element.dataset[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function getColor(section) {
    return section.dataset.wipeColor || DEFAULT_COLOR;
  }

  function getPattern(section) {
    return PATTERNS[section.dataset.wipePattern] || PATTERNS.primary;
  }

  function shouldUseStaticFallback(section) {
    return prefersReducedMotion.matches || (mobileViewport.matches && section.dataset.wipeMobile !== 'scrub');
  }

  function injectStyles() {
    if (document.getElementById('cta-clock-wipe-canvas-styles')) return;

    const style = document.createElement('style');
    style.id = 'cta-clock-wipe-canvas-styles';
    style.textContent = `
${STAGE_SELECTOR} {
  --cta-stage-panel-height: 100vh;
  --cta-wipe-yellow: ${DEFAULT_COLOR};
  position: relative;
  min-height: calc(var(--cta-stage-panel-height, 100vh) + var(--cta-stage-extra, ${DEFAULT_STAGE_EXTRA}));
  background: var(--cta-wipe-yellow);
}

${SECTION_SELECTOR} {
  --cta-wipe-yellow: ${DEFAULT_COLOR};
  --cta-wipe-title-scale: 1;
  --cta-wipe-description-progress: 1;
  --cta-wipe-description-y: 0px;
  --cta-wipe-button-progress: 1;
  --cta-wipe-button-y: 0px;
  --cta-wipe-min-height: 840px;
  position: sticky;
  top: 0;
  min-height: max(100vh, var(--cta-wipe-min-height));
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  background: #fff;
}

${SECTION_SELECTOR} > :not(.${BG_CLASS}) {
  position: relative;
  z-index: 2;
}

.${BG_CLASS} {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  contain: paint;
}

.${CANVAS_CLASS} {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

${SECTION_SELECTOR} [data-cta-wipe-title] {
  opacity: 1;
  transform: scale(var(--cta-wipe-title-scale));
  transform-origin: center;
  will-change: transform;
}

${SECTION_SELECTOR} [data-cta-wipe-description] {
  opacity: var(--cta-wipe-description-progress);
  transform: translate3d(0, var(--cta-wipe-description-y), 0);
  will-change: opacity, transform;
}

${SECTION_SELECTOR} [data-cta-wipe-button] {
  opacity: var(--cta-wipe-button-progress);
  transform: translate3d(0, var(--cta-wipe-button-y), 0);
  will-change: opacity, transform;
}

${STAGE_SELECTOR}[data-cta-wipe-static="true"] {
  min-height: auto;
}

${STAGE_SELECTOR}.is-cta-wipe-scrolltrigger {
  min-height: var(--cta-stage-panel-height, 100vh);
}

${STAGE_SELECTOR}.is-cta-wipe-scrolltrigger ${SECTION_SELECTOR} {
  position: relative;
  top: auto;
}

@media (prefers-reduced-motion: reduce) {
  ${SECTION_SELECTOR} {
    position: relative;
    background: var(--cta-wipe-yellow);
  }

  ${SECTION_SELECTOR} .${BG_CLASS} {
    display: none;
  }
}

@media ${MOBILE_QUERY} {
  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) {
    position: relative;
    background: var(--cta-wipe-yellow);
  }

  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) .${BG_CLASS} {
    display: none;
  }
}
`;
    document.head.appendChild(style);
  }

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function smooth(start, end, value) {
    if (start === end) return value >= end ? 1 : 0;
    const amount = clamp((value - start) / (end - start));
    return amount * amount * (3 - 2 * amount);
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }
})();

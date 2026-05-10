// Circle Canvas
(() => {
  // Public selector [data-circle].
  const FIELD_SELECTOR = '[data-circle]';
  const CANVAS_CLASS = 'circle-field-canvas';
  const INITIALIZED_CLASS = 'is-circle-field-ready';

  // Geometry.
  const MAX_DPR = 2;
  const GRID_SPACING = 24;
  const MOBILE_GRID_SPACING = 22;
  const SPOTLIGHT_RADIUS = 304;
  const MOBILE_SPOTLIGHT_RADIUS = 210;
  const MAX_FOCUS_WIDTH = 1968;

  // Motion.
  const CURSOR_ENTER_EASE = 0.085;
  const CURSOR_LEAVE_EASE = 0.04;
  const SETTLE_DISTANCE = 0.2;
  const STROKE_COLOR = '224, 222, 232';

  // Resting position.
  const DEFAULT_FIELD_X = '45%';
  const DEFAULT_FIELD_Y = '100px';

  // Visual tuning.
  const BASE_RADIUS = 0.8;
  const STATIC_RADIUS_BOOST = 9.6;
  const INTERACTIVE_RADIUS_BOOST = 0.35;
  const BASE_OPACITY = 0.045;
  const STATIC_OPACITY_BOOST = 0.6;
  const INTERACTIVE_OPACITY_BOOST = 0.03;
  const STROKE_WIDTH = 1;
  const SIZE_FALLOFF_EXPONENT = 1.52;
  const OPACITY_FALLOFF_EXPONENT = 0.9;
  const SPOTLIGHT_EDGE_FADE_START = 0.84;
  const SECTION_EDGE_FADE = 90;

  // Edge behavior.
  const FOCUS_SAFE_ZONE = 1;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const fields = new Map();

  const resizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(entries => entries.forEach(handleResizeEntry))
    : null;

  function initAll() {
    document.querySelectorAll(FIELD_SELECTOR).forEach(initField);
  }

  function initField(section) {
    if (fields.has(section)) return;

    const canvas = getOrCreateCanvas(section);
    const context = canvas.getContext('2d');
    if (!context) return;

    prepareSection(section);
    prepareCanvas(canvas);

    const state = {
      section,
      canvas,
      context,
      width: 0,
      height: 0,
      dpr: 1,
      points: [],
      field: null,
      cursorX: 0,
      cursorY: 0,
      targetX: 0,
      targetY: 0,
      pointerInside: false,
      rafId: null,
    };

    fields.set(section, state);
    section.classList.add(INITIALIZED_CLASS);

    bindPointerEvents(state);
    resizeField(state);

    if (resizeObserver) resizeObserver.observe(section);
  }

  function getOrCreateCanvas(section) {
    const existingCanvas = Array.from(section.children).find(child => (
      child.tagName === 'CANVAS' && child.classList.contains(CANVAS_CLASS)
    ));

    if (existingCanvas) return existingCanvas;

    const canvas = document.createElement('canvas');
    canvas.className = CANVAS_CLASS;
    section.insertBefore(canvas, section.firstChild);
    return canvas;
  }

  function prepareSection(section) {
    if (window.getComputedStyle(section).position === 'static') {
      section.style.position = 'relative';
    }
  }

  function prepareCanvas(canvas) {
    // Decorative, non-interactive layer.
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');

    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      zIndex: '0',
    });
  }

  function bindPointerEvents(state) {
    const enterEvent = 'PointerEvent' in window ? 'pointerenter' : 'mouseenter';
    const moveEvent = 'PointerEvent' in window ? 'pointermove' : 'mousemove';
    const leaveEvent = 'PointerEvent' in window ? 'pointerleave' : 'mouseleave';

    state.section.addEventListener(enterEvent, event => {
      if (!canAnimate()) return;

      state.pointerInside = true;
      updatePointerTarget(state, event);
      requestFrame(state);
    }, { passive: true });

    state.section.addEventListener(moveEvent, event => {
      if (!canAnimate()) return;

      state.pointerInside = true;
      updatePointerTarget(state, event);
      requestFrame(state);
    }, { passive: true });

    state.section.addEventListener(leaveEvent, () => {
      if (!canAnimate()) return;

      state.pointerInside = false;
      setTargetToFieldCenter(state);
      requestFrame(state);
    }, { passive: true });
  }

  function handleResizeEntry(entry) {
    const state = fields.get(entry.target);
    if (state) resizeField(state);
  }

  function resizeField(state) {
    const rect = state.section.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    if (state.width === width && state.height === height && state.dpr === dpr) {
      draw(state);
      return;
    }

    state.width = width;
    state.height = height;
    state.dpr = dpr;

    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.field = getAccentField(state.section, width, height);
    state.points = buildGridPoints(state);

    if (!state.pointerInside) {
      setTargetToFieldCenter(state);
      state.cursorX = state.targetX;
      state.cursorY = state.targetY;
    }

    draw(state);
  }

  function getAccentField(section, width, height) {
    const isNarrow = width < 768;
    const mobileRadius = Math.max(130, Math.min(Math.min(width, height) * 0.42, MOBILE_SPOTLIGHT_RADIUS));
    const radius = isNarrow ? mobileRadius : SPOTLIGHT_RADIUS;

    return {
      x: getFieldCoordinate(section.getAttribute('data-circle-x'), width, DEFAULT_FIELD_X),
      // Y is top offset; drawing uses center.
      y: getFieldCoordinate(section.getAttribute('data-circle-y'), height, DEFAULT_FIELD_Y) + radius,
      radiusX: radius,
      radiusY: radius,
      spacing: isNarrow ? MOBILE_GRID_SPACING : GRID_SPACING,
    };
  }

  function buildGridPoints(state) {
    const { field } = state;
    const startX = field.x % field.spacing;
    const startY = field.y % field.spacing;
    const points = [];

    for (let x = startX; x <= state.width; x += field.spacing) {
      for (let y = startY; y <= state.height; y += field.spacing) {
        points.push({ x, y });
      }
    }

    return points;
  }

  function updatePointerTarget(state, event) {
    const rect = state.section.getBoundingClientRect();
    const focus = getSafeFocus(state, event.clientX - rect.left, event.clientY - rect.top);

    state.targetX = focus.x;
    state.targetY = focus.y;
  }

  function setTargetToFieldCenter(state) {
    const center = getSafeFocusFromPoint(state, getFieldCenter(state));
    state.targetX = center.x;
    state.targetY = center.y;
  }

  function getFieldCenter(state) {
    if (!state.field) return { x: state.width / 2, y: state.height / 2 };

    return {
      x: state.field.x,
      y: state.field.y,
    };
  }

  function requestFrame(state) {
    if (state.rafId) return;

    state.rafId = requestAnimationFrame(() => tick(state));
  }

  function tick(state) {
    state.rafId = null;

    if (!canAnimate()) {
      setTargetToFieldCenter(state);
      state.cursorX = state.targetX;
      state.cursorY = state.targetY;
      draw(state);
      return;
    }

    const ease = state.pointerInside ? CURSOR_ENTER_EASE : CURSOR_LEAVE_EASE;
    state.cursorX += (state.targetX - state.cursorX) * ease;
    state.cursorY += (state.targetY - state.cursorY) * ease;

    draw(state);

    if (getCursorDistanceToTarget(state) > SETTLE_DISTANCE) {
      requestFrame(state);
    }
  }

  function draw(state) {
    const { context, width, height, points } = state;
    if (!width || !height || !state.field) return;

    context.clearRect(0, 0, width, height);
    context.lineWidth = STROKE_WIDTH;

    const isDynamic = canAnimate();
    const focus = isDynamic
      ? getSafeFocus(state, state.cursorX, state.cursorY)
      : getSafeFocusFromPoint(state, getFieldCenter(state));

    points.forEach(point => {
      const normalizedDistance = getNormalizedSpotlightDistance(state.field, point, focus.x, focus.y);
      if (normalizedDistance > 1) return;

      const falloff = 1 - smoothstep(0, 1, normalizedDistance);
      const sizeLift = Math.pow(falloff, SIZE_FALLOFF_EXPONENT);
      const opacityLift = Math.pow(falloff, OPACITY_FALLOFF_EXPONENT);
      const edgeFade = 1 - smoothstep(SPOTLIGHT_EDGE_FADE_START, 1, normalizedDistance);
      const influence = isDynamic ? falloff : 0;

      const radius = (
        BASE_RADIUS +
        sizeLift * STATIC_RADIUS_BOOST +
        influence * INTERACTIVE_RADIUS_BOOST
      );
      const sectionEdgeFade = getSectionEdgeFade(state, point, radius);

      const opacity = (
        BASE_OPACITY +
        opacityLift * STATIC_OPACITY_BOOST +
        influence * INTERACTIVE_OPACITY_BOOST
      ) * edgeFade * sectionEdgeFade;

      if (radius < 0.35 || opacity < 0.002) return;

      context.beginPath();
      context.strokeStyle = `rgba(${STROKE_COLOR}, ${opacity})`;
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
    });
  }

  function getNormalizedSpotlightDistance(field, point, focusX, focusY) {
    const dx = (point.x - focusX) / field.radiusX;
    const dy = (point.y - focusY) / field.radiusY;

    return Math.hypot(dx, dy);
  }

  function getFieldCoordinate(value, size, defaultValue) {
    // Supports %, px, and bare percentages.
    const coordinate = typeof value === 'string' && value.trim() ? value.trim() : defaultValue;
    const numericValue = parseFloat(coordinate);

    if (!Number.isFinite(numericValue)) {
      return size * 0.5;
    }

    if (coordinate.endsWith('px')) return numericValue;
    if (coordinate.endsWith('%')) return size * (numericValue / 100);

    return size * (numericValue / 100);
  }

  function getSafeFocusFromPoint(state, point) {
    return getSafeFocus(state, point.x, point.y);
  }

  function getSafeFocus(state, x, y) {
    if (!state.field || FOCUS_SAFE_ZONE <= 0) return { x, y };

    const insetX = state.field.radiusX * FOCUS_SAFE_ZONE;
    const insetY = state.field.radiusY * FOCUS_SAFE_ZONE;
    const boundsWidth = Math.min(state.width, MAX_FOCUS_WIDTH);
    const boundsLeft = (state.width - boundsWidth) / 2;
    const boundsRight = boundsLeft + boundsWidth;

    return {
      x: clamp(x, boundsLeft + insetX, boundsRight - insetX),
      y: clamp(y, insetY, state.height - insetY),
    };
  }

  function getSectionEdgeFade(state, point, radius) {
    // Avoid hard clipping at section edges.
    if (SECTION_EDGE_FADE <= 0) return 1;

    const edgeDistance = Math.min(
      point.x,
      point.y,
      state.width - point.x,
      state.height - point.y,
    );
    const visibleDistance = edgeDistance - radius;

    return smoothstep(0, SECTION_EDGE_FADE, visibleDistance);
  }

  function getCursorDistanceToTarget(state) {
    return Math.hypot(state.targetX - state.cursorX, state.targetY - state.cursorY);
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }

  function smoothstep(edge0, edge1, value) {
    const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

    return x * x * (3 - 2 * x);
  }

  function canAnimate() {
    // Static mode for touch and reduced motion.
    return finePointer.matches && !prefersReducedMotion.matches;
  }

  function refreshMotionMode() {
    fields.forEach(state => {
      stop(state);
      state.pointerInside = false;
      setTargetToFieldCenter(state);
      state.cursorX = state.targetX;
      state.cursorY = state.targetY;
      draw(state);
    });
  }

  function stop(state) {
    if (!state.rafId) return;

    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  function addMediaListener(query, handler) {
    if (query.addEventListener) {
      query.addEventListener('change', handler);
      return;
    }

    query.addListener(handler);
  }

  addMediaListener(prefersReducedMotion, refreshMotionMode);
  addMediaListener(finePointer, refreshMotionMode);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;

    fields.forEach(stop);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();

import {DrawRect, NodeID, Rect, Transform, TreeNode} from './types';
import {animated, useSpring, useSprings, config} from '@react-spring/web';
import {vec2} from 'gl-matrix';
import FPSCounter from './FPSCounter';

import React, {useEffect, useRef, useCallback, useMemo} from 'react';

const MIN_RECT_WIDTH = 2;
const RENDER_TEXT = true;
const MIN_TEXT_WIDTH = 8;

const NODE_GAP_SIZE = 2;

// converts a rect in unit space to a rect in viewport space by applying a pan and zoom transform
function applyPanZoomTransformToRect(rect: Rect, transform: Transform): Rect {
  const transformedPos = vec2.clone(rect.pos);
  const transformedSize = vec2.clone(rect.size);
  // offset pos by translation, then scale.
  // effectively, translating first changes the origin which scaling will happen around.
  // for example, zooming in on a point can be achieved by translating that point to the
  // origin then scaling.
  // this means that the translation is in unit (unzoomed) coordinates.
  vec2.add(transformedPos, transformedPos, transform.translate);
  vec2.multiply(transformedPos, transformedPos, transform.scale);
  // scale size
  vec2.multiply(transformedSize, transformedSize, transform.scale);

  return {pos: transformedPos, size: transformedSize};
}

// exponential decay interpolation
// https://www.youtube.com/watch?v=LSNQuFEDOyQ
// a = start value
// b = end value
// decay = decay constant
// dt = time delta in seconds
function expDecay(a: number, b: number, decay: number, dt: number) {
  return b + (a - b) * Math.exp(-decay * dt);
}

function expDecayVec2(a: vec2, b: vec2, decay: number, dt: number) {
  a[0] = expDecay(a[0], b[0], decay, dt);
  a[1] = expDecay(a[1], b[1], decay, dt);
}

function rectIntersectsRect(a: Rect, b: Rect): boolean {
  return (
    a.pos[0] < b.pos[0] + b.size[0] &&
    a.pos[0] + a.size[0] > b.pos[0] &&
    a.pos[1] < b.pos[1] + b.size[1] &&
    a.pos[1] + a.size[1] > b.pos[1]
  );
}

class VanillaDOMDrawRectsRenderer {
  private elements: Map<NodeID, HTMLElement> = new Map();

  // the currently rendered drawRects
  private drawRects: Map<NodeID, DrawRect> = new Map();
  // the current state of interpolation
  private currentRectStates: Map<NodeID, Rect> = new Map();
  // the target state of interpolation
  private targetRectStates: Map<NodeID, Rect> = new Map();
  private viewport: Rect = {pos: vec2.create(), size: vec2.create()};
  private running = false;
  private lastTime = 0;
  private decaySpeed = 16; // how quickly we converge on targetRectState values, range 0 to 25 (higher is faster)
  constructor(private root: HTMLElement) {}

  destroy() {
    this.running = false;
    this.elements.forEach((el) => el.remove());
  }

  transitionToNextState(
    drawRects: Array<DrawRect>,
    panAndZoomTransform: Transform,
    viewportSize: {width: number; height: number},
    decaySpeed: number
  ) {
    console.log('transitionToNextState', drawRects.length);
    vec2.set(this.viewport.size, viewportSize.width, viewportSize.height);
    this.decaySpeed = decaySpeed;

    //create set of ids for drawRects
    const ids = new Set(drawRects.map((drawRect) => drawRect.id));
    // create elements for new drawRects
    // don't worry about setting properties, we'll do that in the next step

    drawRects.forEach((drawRect) => {
      if (!ids.has(drawRect.id)) {
        // remove element
        const el = this.elements.get(drawRect.id);
        if (el != null) {
          el.remove();
          this.elements.delete(drawRect.id);
        }

        // clean up state and references related to this drawRect
        this.currentRectStates.delete(drawRect.id);
        this.targetRectStates.delete(drawRect.id);
        this.drawRects.delete(drawRect.id);
      }

      // calculate target rect state
      const transformedRect = applyPanZoomTransformToRect(
        drawRect,
        panAndZoomTransform
      );

      this.targetRectStates.set(drawRect.id, transformedRect);

      // if we don't have current rect, set it to the target rect
      if (!this.currentRectStates.has(drawRect.id)) {
        this.currentRectStates.set(drawRect.id, {
          pos: vec2.clone(transformedRect.pos),
          size: vec2.clone(transformedRect.size),
        });
      }

      // store drawRect so rendering can read properties not included in rect state

      this.drawRects.set(drawRect.id, drawRect);

      // setup interpolation between current and target rect

      const currentRectState = this.currentRectStates.get(drawRect.id);
      if (currentRectState == null) {
        throw new Error('Current rect state not found');
      }

      this.updateElementProperties(drawRect, currentRectState);
    });

    if (!this.running) {
      this.createRenderLoop();
    }
  }

  createRenderLoop() {
    this.running = true;

    this.lastTime = performance.now();
    const rafLoop = (time: number) => {
      if (!this.running) return;
      const deltaTime = (time - this.lastTime) / 1000;
      this.lastTime = time;
      FPSCounter.startFrame();
      this.updateInterpolation(deltaTime);
      FPSCounter.endFrame();
      FPSCounter.reportElementsCount(this.elements.size);
      requestAnimationFrame(rafLoop);
    };

    requestAnimationFrame(rafLoop);
  }

  updateInterpolation(
    deltaTime: number // time in seconds since last update
  ) {
    let maxError = 0; // max difference between current and target rect state for all rects

    this.currentRectStates.forEach((currentRectState, id) => {
      const targetRectState = this.targetRectStates.get(id);
      if (targetRectState == null) {
        throw new Error('Target rect not found');
      }

      // interpolate currentRectState toward targetRectState
      expDecayVec2(
        currentRectState.pos,
        targetRectState.pos,
        this.decaySpeed,
        deltaTime
      );
      expDecayVec2(
        currentRectState.size,
        targetRectState.size,
        this.decaySpeed,
        deltaTime
      );

      // calculate max error as the max difference between current and target
      // of each property for this rect
      let maxErrorForThisRect = Math.max(
        Math.abs(currentRectState.pos[0] - targetRectState.pos[0]),
        Math.abs(currentRectState.pos[1] - targetRectState.pos[1]),
        Math.abs(currentRectState.size[0] - targetRectState.size[0]),
        Math.abs(currentRectState.size[1] - targetRectState.size[1])
      );

      if (maxErrorForThisRect < 0.1) {
        // set current to target if we're close enough
        vec2.copy(currentRectState.pos, targetRectState.pos);
        vec2.copy(currentRectState.size, targetRectState.size);
      }
      // update global maxError
      maxError = Math.max(maxError, maxErrorForThisRect);

      const drawRect = this.drawRects.get(id);
      if (drawRect == null) {
        throw new Error('DrawRect not found');
      }

      // update DOM element properties with interpolated values
      this.updateElementProperties(drawRect, currentRectState);
    });

    // if maxError very small, stop running animation loop
    if (maxError < 0.001) {
      this.running = false;
    }
  }

  // create a DOM element for a drawRect when it is first added
  createElement(drawRect: DrawRect) {
    const el = document.createElement('div');
    el.className = 'Flamechart__rect';
    el.setAttribute('data-drawrect-id', String(drawRect.id));
    this.root.appendChild(el);
    this.elements.set(drawRect.id, el);

    // add text element
    if (RENDER_TEXT) {
      const textEl = document.createElement('div');
      textEl.className = 'Flamechart__text';
      textEl.textContent = drawRect.label ?? '[no label]';
      el.appendChild(textEl);
    }
  }

  // update DOM element properties with current values for an animation frame
  updateElementProperties(drawRect: DrawRect, transformedRect: Rect) {
    const inViewport = rectIntersectsRect(transformedRect, this.viewport);

    if (!inViewport || transformedRect.size[0] < MIN_RECT_WIDTH) {
      // delete element if it's out of view
      const el = this.elements.get(drawRect.id);
      if (el != null) {
        el.remove();
        this.elements.delete(drawRect.id);
      }
      return;
    }
    if (!this.elements.has(drawRect.id)) {
      this.createElement(drawRect);
    }
    const el = this.elements.get(drawRect.id);
    if (el == null) {
      throw new Error('Element not found for drawRect: ' + drawRect.id);
    }

    el.style.transform = `translate(${transformedRect.pos[0]}px, ${transformedRect.pos[1]}px)`;
    el.style.backgroundColor = drawRect.backgroundColor ?? 'transparent';
    el.style.width = `${Math.max(
      0,
      transformedRect.size[0] - NODE_GAP_SIZE
    )}px`;
    el.style.height = `${Math.max(
      0,
      transformedRect.size[1] - NODE_GAP_SIZE
    )}px`;

    if (transformedRect.size[0] >= MIN_TEXT_WIDTH) {
      (el.children[0] as HTMLDivElement).style.display = 'block';
    } else {
      (el.children[0] as HTMLDivElement).style.display = 'none';
    }
  }
}

function VanillaDOMDrawRects({
  drawRects,
  panAndZoomTransform,
  viewportSize,
  decaySpeed,
  rootRef,
  onClick,
}: {
  drawRects: Array<DrawRect>;
  panAndZoomTransform: Transform;
  viewportSize: {width: number; height: number};
  decaySpeed: number;
  rootRef: React.RefObject<HTMLDivElement>;
  onClick: (id: string) => void;
}) {
  const handleClick = useCallback((e: MouseEvent) => {
    let el = e.target as HTMLElement | null | undefined;

    // find closest element with Flamechart__rect class
    el = el?.closest('.Flamechart__rect');

    if (el == null) return;

    const id = el.getAttribute('data-drawrect-id');

    if (id == null) return;
    onClick(id);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (root == null) return;

    root.addEventListener('click', handleClick);

    return () => {
      root.removeEventListener('click', handleClick);
    };
  }, [rootRef, handleClick]);

  const rendererRef = useRef<VanillaDOMDrawRectsRenderer | null>(null);
  useEffect(() => {
    if (rendererRef.current == null) {
      const root = rootRef.current;
      if (root == null) {
        throw new Error('Root not provided');
      }
      rendererRef.current = new VanillaDOMDrawRectsRenderer(root);
    }

    return () => {
      if (rendererRef.current != null) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current == null) {
      throw new Error('Renderer not initialized');
    }
    rendererRef.current.transitionToNextState(
      drawRects,
      panAndZoomTransform,
      viewportSize,
      decaySpeed
    );
  }, [drawRects, panAndZoomTransform]);

  return null;
}

function CSSAnimatedDrawRects({
  drawRects,
  panAndZoomTransform,
  onClick,
}: {
  drawRects: Array<DrawRect>;
  panAndZoomTransform: Transform;
  onClick: (id: string) => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const id = e.currentTarget.getAttribute('data-drawrect-id');

    if (id == null) return;
    onClick(id);
  }, []);
  return (
    <>
      {drawRects.map((drawRect) => {
        const transformedRect = applyPanZoomTransformToRect(
          drawRect, // DrawRect conforms to the Rect interface
          panAndZoomTransform
        );

        return (
          <div
            key={drawRect.id}
            className="Flamechart__rect Flamechart__rectCSSAnim"
            data-drawrect-id={drawRect.id}
            style={{
              transform: `translate(${transformedRect.pos[0]}px, ${transformedRect.pos[1]}px)`,
              backgroundColor: drawRect.backgroundColor ?? 'transparent',
              width: transformedRect.size[0] - NODE_GAP_SIZE,
              height: transformedRect.size[1] - NODE_GAP_SIZE,
            }}
            onClick={handleClick}
          >
            {RENDER_TEXT && (
              <div className="Flamechart__text">
                {drawRect.label ?? '[no label]'}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function SpringAnimatedDrawRects({
  drawRects,
  panAndZoomTransform,
  onClick,
}: {
  drawRects: Array<DrawRect>;
  panAndZoomTransform: Transform;
  onClick: (id: string) => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const id = e.currentTarget.getAttribute('data-drawrect-id');

    if (id == null) return;
    onClick(id);
  }, []);

  const prevPanAndZoomTransform = useRef<Transform>(panAndZoomTransform);
  useEffect(() => {
    prevPanAndZoomTransform.current = panAndZoomTransform;
  }, [panAndZoomTransform]);

  const [springs, _api] = useSprings(
    drawRects.length,
    (idx: number) => {
      const drawRect = drawRects[idx];
      const transformedRect = applyPanZoomTransformToRect(
        drawRect, // DrawRect conforms to the Rect interface
        panAndZoomTransform
      );

      const prevTransformedRect = applyPanZoomTransformToRect(
        drawRect, // DrawRect conforms to the Rect interface
        prevPanAndZoomTransform.current
      );

      return {
        from: {
          x: prevTransformedRect.pos[0],
          y: prevTransformedRect.pos[1],
          width: prevTransformedRect.size[0] - NODE_GAP_SIZE,
          height: prevTransformedRect.size[1] - NODE_GAP_SIZE,
          opacity: prevTransformedRect.size[0] < MIN_RECT_WIDTH ? 0 : 1,
        },
        to: {
          config: config.gentle,
          x: transformedRect.pos[0],
          y: transformedRect.pos[1],
          width: transformedRect.size[0] - NODE_GAP_SIZE,
          height: transformedRect.size[1] - NODE_GAP_SIZE,
          opacity: transformedRect.size[0] < MIN_RECT_WIDTH ? 0 : 1,
        },
      };
    },
    [drawRects, panAndZoomTransform, prevPanAndZoomTransform]
  );

  return (
    <>
      {drawRects.map((drawRect, idx) => {
        const transformedRect = applyPanZoomTransformToRect(
          drawRect, // DrawRect conforms to the Rect interface
          panAndZoomTransform
        );

        const spring = springs[idx];

        return (
          <animated.div
            key={drawRect.id}
            className="Flamechart__rect"
            data-drawrect-id={drawRect.id}
            style={{
              backgroundColor: drawRect.backgroundColor ?? 'transparent',
              ...spring,
            }}
            onClick={handleClick}
          >
            {RENDER_TEXT && (
              <div className="Flamechart__text">
                {drawRect.label ?? '[no label]'}
              </div>
            )}
          </animated.div>
        );
      })}
    </>
  );
}
export function getMouseEventPos(
  event: {
    clientX: number;
    clientY: number;
  },
  viewport: HTMLDivElement
): vec2 {
  var rect = viewport.getBoundingClientRect();
  return vec2.fromValues(event.clientX - rect.left, event.clientY - rect.top);
}
export type Renderer = 'react-spring' | 'react-css-transition' | 'vanilla-dom';
export default function FlamechartViewport({
  drawRects,
  panAndZoomTransform,
  renderer,
  viewportSize,
  decaySpeed,
  setSelection,
  clearSelection,
  setPanAndZoom,
}: {
  drawRects: Array<DrawRect>;
  panAndZoomTransform: Transform;
  renderer: Renderer;
  viewportSize: {width: number; height: number};
  decaySpeed: number;
  setSelection: (selection: DrawRect | null) => void;
  clearSelection: () => void;
  setPanAndZoom: (panAndZoom: Transform) => void;
}): React.ReactElement {
  // id can be string or number but we store it in the dom as a string
  // so this lets us find the drawRect by an id from the dom
  const drawRectsByIDString = useMemo(() => {
    const byID: Map<string, DrawRect> = new Map();
    drawRects.forEach((r) => {
      byID.set(String(r.id), r);
    });
    return byID;
  }, [drawRects]);
  const handleDrawRectClick = useCallback(
    (idString: string) => {
      const selection = drawRectsByIDString.get(idString);

      if (selection != null) {
        setSelection(selection);
        // calculate pan and zoom for selected rect
        // offset of rect in unit(unzoomed) space
        // then ratio of viewport to rect
        const translate = vec2.clone(selection.pos);
        // flip sign as this represents the translation to move this rect
        // to the origin (which is the opposite of the position of this rect)
        vec2.scale(translate, translate, -1);

        // if we want to know how much to scale by for a rect's width
        // to be equal to the viewport width, we need to know the ratio
        // between the rect width and viewport width.
        // e.g if the rect's unit width takes up half the viewport, we'd need to
        // scale by 2x for it to fill the viewport. generalized:
        // scale factor = viewport width / rect width
        const scale = vec2.fromValues(
          viewportSize.width / selection.size[0],
          1 // no scaling
        );

        setPanAndZoom({
          translate,
          scale,
        });
      } else {
        clearSelection();
      }
    },
    [drawRectsByIDString, viewportSize]
  );

  const rootRef = useRef<HTMLDivElement>(null);

  let content: React.ReactElement;
  switch (renderer) {
    case 'react-spring':
      content = (
        <SpringAnimatedDrawRects
          drawRects={drawRects}
          panAndZoomTransform={panAndZoomTransform}
          onClick={handleDrawRectClick}
        />
      );
      break;
    case 'react-css-transition':
      content = (
        <CSSAnimatedDrawRects
          drawRects={drawRects}
          panAndZoomTransform={panAndZoomTransform}
          onClick={handleDrawRectClick}
        />
      );
      break;
    case 'vanilla-dom':
      content = (
        <VanillaDOMDrawRects
          drawRects={drawRects}
          panAndZoomTransform={panAndZoomTransform}
          viewportSize={viewportSize}
          decaySpeed={decaySpeed}
          onClick={handleDrawRectClick}
          rootRef={rootRef}
        />
      );
      break;
    default:
      throw new Error(`Unknown renderer: ${renderer}`);
  }

  return (
    <div
      style={{...viewportSize, border: 'solid 1px black'}}
      className="Flamechart__root"
      ref={rootRef}
    >
      {content}
    </div>
  );
}

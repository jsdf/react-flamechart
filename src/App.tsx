import "./styles.css";
import { buildTreeFromGraph, calcTreeInclusiveWeights } from "./buildTree";
import tree from "./examples/largedata";
import { DrawRect, Rect, Transform, TreeNode } from "./types";
import { animated, useSpring, useSprings, config } from '@react-spring/web'


import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Slider from "./Slider";
import { mat3, vec2 } from "gl-matrix";
import useWindowSize from "./useWindowSize";
import Checkbox from "./Checkbox";
import { treeToRects } from "./flamechartLayout";

const MIN_RECT_WIDTH = 4;
const RENDER_TEXT = true;

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

  return { pos: transformedPos, size: transformedSize };
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
    const id = e.currentTarget.getAttribute("data-drawrect-id");

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
              backgroundColor: drawRect.backgroundColor ?? "transparent",
              width: transformedRect.size[0] - NODE_GAP_SIZE,
              height: transformedRect.size[1] - NODE_GAP_SIZE,
            }}
            onClick={handleClick}
          >
            {RENDER_TEXT && <div className="Flamechart__text">
              {drawRect.label ?? "[no label]"}
            </div>}
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
    const id = e.currentTarget.getAttribute("data-drawrect-id");

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

      return ({
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
      })
    },
    [drawRects, panAndZoomTransform, prevPanAndZoomTransform]
  )

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
              backgroundColor: drawRect.backgroundColor ?? "transparent",
              ...spring,
            }}
            onClick={handleClick}
          >{
              RENDER_TEXT &&
              <div className="Flamechart__text">
                {drawRect.label ?? "[no label]"}
              </div>}
          </animated.div>
        );
      })}
    </>
  );
}

const DIMENSIONS = {
  x: 0,
  y: 1,
};

function initPanAndZoom(drawRects: Array<DrawRect>, viewportWidth: number): Transform {
  // initial scale to fit all rects in viewport
  const maxWidth = drawRects.reduce((acc, r) => Math.max(r.pos[0] + r.size[0], acc), 0);
  console.log({ maxWidth, viewportWidth });
  const scaleX = viewportWidth / maxWidth;

  // const scaleX = 1;

  return {
    translate: vec2.fromValues(0, 0),
    scale: vec2.fromValues(scaleX, 1)
  }
}

function FlamechartViewport({
  drawRects,
  panAndZoomTransform,
  springAnimation,
  viewportSize,
  onDrawRectClick,
}: {
  drawRects: Array<DrawRect>;
  panAndZoomTransform: Transform;
  springAnimation: boolean;
  viewportSize: { width: number, height: number };
  onDrawRectClick: (id: string) => void
}
): React.ReactElement {
  return (
    <div
      style={{ ...viewportSize, border: "solid 1px black" }}
      className="Flamechart__root"
    >
      {
        springAnimation ?
          <SpringAnimatedDrawRects
            drawRects={drawRects}
            panAndZoomTransform={panAndZoomTransform}
            onClick={onDrawRectClick}
          />
          :
          <CSSAnimatedDrawRects
            drawRects={drawRects}
            panAndZoomTransform={panAndZoomTransform}
            onClick={onDrawRectClick}
          />
      }
    </div>)
}

export default function App(): React.ReactElement {
  const drawRects = useMemo(() => {
    const drawRects: Array<DrawRect> = [];
    const startPos = vec2.create();

    calcTreeInclusiveWeights(tree); // mutates nodes to populate weightIncl field
    treeToRects(tree, startPos, tree.weightIncl, drawRects);

    return drawRects;
  }, []);

  // id can be string or number but we store it in the dom as a string
  // so this lets us find the drawRect by an id from the dom
  const drawRectsByIDString = useMemo(() => {
    const byID: Map<string, DrawRect> = new Map();
    drawRects.forEach((r) => {
      byID.set(String(r.id), r);
    });
    return byID;
  }, [drawRects]);

  const windowSize = useWindowSize()
  const viewportSize = useMemo(() => {
    return { width: windowSize.width, height: windowSize.height * 0.6 }
  }, [windowSize])

  const [selection, setSelection] = useState<DrawRect | null>(null);

  const [springAnimation, setSpringAnimation] = useState(true);

  const [panAndZoomTransform, setPanAndZoom] = useState<Transform>(() => initPanAndZoom(
    drawRects,
    viewportSize.width
  ));

  const clearSelection = useCallback(() => {
    setSelection(null);
    setPanAndZoom(initPanAndZoom(drawRects, viewportSize.width));
  }, [drawRects, viewportSize]);

  const handleDrawRectClick = useCallback((idString: string) => {
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
        1, // no scaling
      );

      setPanAndZoom({
        translate,
        scale
      });

    } else {
      clearSelection();
    }
  }, [drawRectsByIDString, viewportSize]);

  return (
    <div className="App">
      <div
        style={{
          zIndex: 10,
          position: "absolute",
          top: 0,
          right: 0,

          backgroundColor: `#0009`,
          padding: 8,
          color: "white"
        }}
      >
        <details
          open={true}
        >
          <summary>
            Controls
          </summary>
          <div>
            <Checkbox
              label="use spring animation"
              checked={springAnimation}
              onChange={setSpringAnimation}
            />
          </div>
          {Object.entries(DIMENSIONS).map(([dim, idx]) => (
            <Slider
              key={`pan ${dim}`}
              label={`pan ${dim}`}
              min={-100}
              max={100}
              step={1}
              value={panAndZoomTransform.translate[idx]}
              onChange={(val) =>
                setPanAndZoom((s) => {
                  const updated = vec2.clone(s.translate);
                  updated[idx] = val;
                  return { ...s, translate: updated };
                })
              }
            />
          ))}
          {Object.entries(DIMENSIONS).map(([dim, idx]) => (
            <Slider
              key={`zoom ${dim}`}
              label={`zoom ${dim}`}
              min={0.01}
              max={10}
              step={0.01}
              value={panAndZoomTransform.scale[idx]}
              onChange={(val) =>
                setPanAndZoom((s) => {
                  const updated = vec2.clone(s.scale);
                  updated[idx] = val;
                  return { ...s, scale: updated };
                })
              }
            />
          ))}
        </details>
        selection: {selection?.node.label ?? 'none'}{
          selection && <button onClick={() => {
            clearSelection();
          }}>x</button>
        }
      </div>
      <FlamechartViewport
        drawRects={drawRects}
        panAndZoomTransform={panAndZoomTransform}
        springAnimation={springAnimation}
        viewportSize={viewportSize}
        onDrawRectClick={handleDrawRectClick}
      />
      {false && <pre>{JSON.stringify(selection?.node, null, 2)}</pre>}
    </div>
  );
}

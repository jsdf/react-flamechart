import './styles.css';
import { calcTreeInclusiveWeights } from './buildTree';
import { generateTree } from './examples/largedata';
import { DrawRect, Transform } from './types';
import type { Renderer } from './FlamechartViewport';

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Slider from './Slider';
import { vec2 } from 'gl-matrix';
import useWindowSize from './useWindowSize';
import { treeToRects } from './flamechartLayout';
import NumberInput from './NumberInput';
import FlamechartViewport from './FlamechartViewport';
import Select from './Select';

const DIMENSIONS = {
  x: 0,
  y: 1,
};

function initPanAndZoom(
  drawRects: Array<DrawRect>,
  viewportWidth: number
): Transform {
  // initial scale to fit all rects in viewport
  const maxWidth = drawRects.reduce(
    (acc, r) => Math.max(r.pos[0] + r.size[0], acc),
    0
  );

  const scaleX = viewportWidth / maxWidth;

  return {
    translate: vec2.fromValues(0, 0),
    scale: vec2.fromValues(scaleX, 1),
  };
}

export default function App(): React.ReactElement {
  const [treeOpts, setTreeOpts] = useState({ maxDepth: 16, fanout: 3 });
  const tree = useMemo(() => generateTree(treeOpts), [treeOpts]);
  const drawRects = useMemo(() => {
    const drawRects: Array<DrawRect> = [];
    const startPos = vec2.create();

    calcTreeInclusiveWeights(tree); // mutates nodes to populate weightIncl field
    treeToRects(tree, startPos, tree.weightIncl, drawRects);

    return drawRects;
  }, [tree]);

  const windowSize = useWindowSize();
  const viewportSize = useMemo(() => {
    return { width: windowSize.width, height: windowSize.height * 0.6 };
  }, [windowSize]);

  const [selection, setSelection] = useState<DrawRect | null>(null);

  const [renderer, setRenderer] = useState<Renderer>('vanilla-dom');
  const [decaySpeed, setDecaySpeed] = useState(16);

  const [panAndZoomTransform, setPanAndZoom] = useState<Transform>(() =>
    initPanAndZoom(drawRects, viewportSize.width)
  );

  const prevDrawRects = useRef(drawRects);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setPanAndZoom(initPanAndZoom(drawRects, viewportSize.width));
  }, [drawRects, viewportSize]);

  useEffect(() => {
    if (prevDrawRects.current !== drawRects) {
      console.log('drawRects changed, clearing selection');
      clearSelection();
    }
  }, [prevDrawRects, drawRects, clearSelection]);

  useEffect(() => {
    prevDrawRects.current = drawRects;
  }, [drawRects]);

  return (
    <div className="App">
      <div
        style={{
          zIndex: 10,
          position: 'absolute',
          top: 0,
          right: 0,

          backgroundColor: `#0009`,
          padding: 8,
          color: 'white',
        }}
      >
        <details open={true}>
          <summary>Controls</summary>
          <div>
            <Select
              label="renderer"
              items={['react-css-transition', 'react-spring', 'vanilla-dom']}
              value={renderer.toString()}
              onChange={(val: string) => {
                switch (val) {
                  case 'react-css-transition':
                  case 'react-spring':
                  case 'vanilla-dom':
                    setRenderer(val as Renderer);
                    break;
                  default:
                    throw new Error('unknown renderer ' + val);
                }
              }}
            />
          </div>
          <NumberInput
            value={treeOpts.maxDepth}
            onChange={(val) => {
              setTreeOpts((s) => ({ ...s, maxDepth: val }));
            }}
            label="tree max depth"
          />
          <NumberInput
            value={treeOpts.fanout}
            onChange={(val) => {
              setTreeOpts((s) => ({ ...s, fanout: val }));
            }}
            label="tree fanout"
          />

          <Slider
            label="interpolation speed (decay)"
            min={0}
            max={25}
            step={0.1}
            value={decaySpeed}
            onChange={(val) => setDecaySpeed(val)}
          />
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
        selection: {selection?.node.label ?? 'none'}
        {selection && (
          <button
            onClick={() => {
              clearSelection();
            }}
          >
            x
          </button>
        )}
      </div>
      <FlamechartViewport
        key={tree.id}
        drawRects={drawRects}
        panAndZoomTransform={panAndZoomTransform}
        decaySpeed={decaySpeed}
        renderer={renderer}
        viewportSize={viewportSize}
        setSelection={setSelection}
        clearSelection={clearSelection}
        setPanAndZoom={setPanAndZoom}
      />
      {false && <pre>{JSON.stringify(selection?.node, null, 2)}</pre>}
    </div>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Stats from 'stats.js';

import FPSCounter from './FPSCounter';

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

var stats = new Stats();

stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
stats.dom.style.top = 'auto';
stats.dom.style.bottom = '0';

const elementsPanel = stats.addPanel(new Stats.Panel('elems', '#0ff', '#002'));
document.body.appendChild(stats.dom);

FPSCounter.startFrame = () => {
  stats.begin();
};

FPSCounter.endFrame = () => {
  stats.end();
};

let maxElements = 0;
FPSCounter.reportElementsCount = (count) => {
  maxElements = Math.max(maxElements, count);
  elementsPanel.update(count, maxElements);
};

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

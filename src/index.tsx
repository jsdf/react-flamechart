import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Stats from 'stats.js';

import FPSCounter from './FPSCounter';

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

var stats = new Stats();

stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

FPSCounter.startFrame = () => {
  stats.begin();
};

FPSCounter.endFrame = () => {
  stats.end();
};

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

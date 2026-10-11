import { parentPort, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = workerData.root;
const rulesUrl = pathToFileURL(path.join(root, 'js/rules.js')).href;
const diffUrl = pathToFileURL(path.join(root, 'js/difficulty.js')).href;

const { deal } = await import(rulesUrl);
const { rateState } = await import(diffUrl);

parentPort.on('message', (msg) => {
  if (msg.type === 'rate') {
    const state = deal(msg.dealNumber);
    const result = rateState(state, msg.opts);
    parentPort.postMessage({
      type: 'result',
      dealNumber: msg.dealNumber,
      result,
    });
  }
});

// -----------------------------------------------------------------------------
// Entry point: SDK wiring only. Every handler is registered BEFORE connect(),
// and delegates to the NordPoolApp (src/app.js).
//
// Environment variables provided by the Gladys supervisor, read by the SDK:
// GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { ACTION_TEST, NordPoolApp, WIDGET_KEY } from './src/app.js';
import { SCENE_ACTIONS } from './src/scenes.js';

const gladys = new GladysIntegration();
const app = new NordPoolApp({ gladys });

// --- Discovery: publish one device per configured area ------------------------
gladys.onScanRequest(() => app.publishDevices());

// --- Dashboard widget ----------------------------------------------------------
gladys.onWidgetGet(WIDGET_KEY, (request) => app.getWidget(request));

// --- Scene actions --------------------------------------------------------------
gladys.onSceneAction(SCENE_ACTIONS.GET_PRICE, (fields) => app.getPrice(fields));
gladys.onSceneAction(SCENE_ACTIONS.CHEAPEST_WINDOW, (fields) => app.getCheapestWindow(fields));

// --- Configuration screen button ----------------------------------------------
gladys.onAction(ACTION_TEST, () => app.testConnection());

// --- Configuration changed by the user ----------------------------------------
gladys.onConfigUpdated((config) => {
  logger.info('Configuration updated: restarting');
  return app.start(config);
});

// --- Connection lifecycle ------------------------------------------------------
// Messages sent while disconnected are lost: re-read the config every time.
gladys.on('connected', async () => {
  try {
    await app.start(await gladys.getConfig());
  } catch (err) {
    logger.error('Start failed', err);
  }
});

gladys.on('disconnected', () => {
  app.stop().catch((err) => logger.error('Stop failed', err));
});

gladys.handleShutdown(() => app.stop());

logger.info('Starting the Nord Pool integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});

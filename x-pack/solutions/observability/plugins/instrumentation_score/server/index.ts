

import type { PluginInitializerContext } from '@kbn/core/server';
import { configSchema, config } from './config';

const plugin = async (initializerContext: PluginInitializerContext) => {
  const { InstrumentationScorePlugin } = await import('./plugin');
  return new InstrumentationScorePlugin(initializerContext);
}

export type { InstScorePluginSetup, InstScorePluginStart } from './types';

export { configSchema, config, plugin };

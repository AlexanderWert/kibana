import { type TypeOf, schema } from '@kbn/config-schema';
import { PluginConfigDescriptor } from '@kbn/core/server';
import { isValidDuration } from './utils/duration';

/**
 * Schema for Instrumentation Score signal indices
 */
export const indicesSchema = schema.object({
  spans: schema.string({ defaultValue: '' }), // per default: fallback to APM indices,
  logs: schema.string({ defaultValue: '' }), // per default: fallback to APM indices,
  metrics: schema.string({ defaultValue: '' }), // per default: fallback to APM indices,
});

const validateDuration = (value: string, option: string): string | void => {
  return isValidDuration(value) ? undefined : `[xpack.instrumentation_score.${option}] must be a valid duration string (e.g. 1m, 2h, 30s)`;
}

/**
 * Schema for Instrumentation Score configuration
 */
export const configSchema = schema.object({
  enabled: schema.boolean({ defaultValue: false }),
  evaluation_interval: schema.string({
    defaultValue: '1m',
    validate: (value) => validateDuration(value, 'evaluation_interval')
  }),
  lookback_window: schema.string({
    defaultValue: '1h',
    validate: (value) => validateDuration(value, 'lookback_window')
  }),
  indices: indicesSchema
});


/**
 * Schema for Instrumentation Score Sources configuration
 */
export type InstScoreConfig = TypeOf<typeof configSchema>;

/**
 * Plugin configuration for the instrumentation_score.
 */
export const config: PluginConfigDescriptor<InstScoreConfig> = {
  deprecations: ({ renameFromRoot, deprecate }) => [],

  schema: configSchema,
};

/**
 * Schema for Signal indices
 */
export type InstScoreSignalIndices = InstScoreConfig['indices'];

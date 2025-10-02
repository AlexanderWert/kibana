import type {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '@kbn/core/server';

import type { InstScorePluginSetup, InstScorePluginStart, InstScorePluginSetupDependencies } from './types';
import { InstScoreCalculator } from './calculator';
import type { TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import { InstScoreConfig } from './config';

const TASK_TYPE = 'instrumentation-score:calc';
const TASK_ID = 'instrumentation-score-task';

export class InstrumentationScorePlugin
  implements Plugin<InstScorePluginSetup, InstScorePluginStart> {
  private readonly logger: Logger;
  private config: InstScoreConfig;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
    this.config = initializerContext.config.get<InstScoreConfig>();
  }

  public setup(core: CoreSetup, plugins: InstScorePluginSetupDependencies) {
    if (this.config.enabled) {
      const interval = this.config.evaluation_interval;
      const calculator = new InstScoreCalculator(this.logger, this.config, plugins.apmDataAccess.getApmIndices);

      plugins.taskManager.registerTaskDefinitions({
        [TASK_TYPE]: {
          title: 'Calculates instrumentation score',
          createTaskRunner: () => {
            return {
              run: async () => {
                this.logger.debug('Running instrumentation score calculation task');
                await calculator.init(core);
                await calculator.execute();
              },
              cancel: async () => { },
            };
          },
        },
      });

      core
        .getStartServices()
        .then(async ([_coreStart, pluginsStart]) => {
          const { taskManager: taskManagerStart } = pluginsStart as {
            taskManager: TaskManagerStartContract;
          };

          await taskManagerStart.ensureScheduled({
            id: TASK_ID,
            taskType: TASK_TYPE,
            schedule: {
              interval: interval,
            },
            scope: ['instrumentation-score'],
            params: {},
            state: {},
          });
        })
        .catch(() => { });


      this.logger.info('instrumentation-score plugin initialized');
    }

    return {};
  }

  public start(core: CoreStart) {
    return {};
  }

  public stop() { }
}

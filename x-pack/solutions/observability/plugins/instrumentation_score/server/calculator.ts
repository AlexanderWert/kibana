
import { type CoreSetup, type Logger, type SavedObjectsClientContract, ElasticsearchClient, SavedObjectsClient } from '@kbn/core/server';
import type { APMIndices } from '@kbn/apm-sources-access-plugin/server';
import { InstScoreResult, InstScoreRuleEvaluationResult, IMPACT_LEVELS, EvalResultValues, SignalType } from './types';
import { BulkRequest } from '@elastic/elasticsearch/lib/api/types';
import { DEST_INDEX_RULES_DEFINITIONS, DEST_INDEX_RULES_RESULTS, DEST_INDEX_SCORE, InstScoreESIndexInitializer } from './es_init';
import { InstScoreTargetIndices } from './es_indices';
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from './rules/abstract';
import { RULES } from './rules/all';
import { InstScoreConfig } from './config';
import { durationToSeconds } from './utils/duration';

export class InstScoreCalculator {
  es!: ElasticsearchClient;
  resolvedIndices!: string;
  logger: Logger;
  config: InstScoreConfig;
  lookbackSeconds: number;
  destIndex!: string;
  getApmIndices: (soClient: SavedObjectsClientContract) => Promise<APMIndices>;
  rules = new Map<string, InstScoreRule>();
  private initialized = false;
  private instScoreTargetIndices!: InstScoreTargetIndices;

  constructor(
    logger: Logger,
    config: InstScoreConfig,
    getApmIndices: (soClient: SavedObjectsClientContract) => Promise<APMIndices>
  ) {
    this.logger = logger;
    this.config = config;
    this.lookbackSeconds = durationToSeconds(config.lookback_window);
    this.getApmIndices = getApmIndices;
  }

  public async init(core: CoreSetup) {
    if (!this.initialized) {
      const [coreStart] = await core.getStartServices();
      this.es = coreStart.elasticsearch.client.asInternalUser;

      const es_initializer = new InstScoreESIndexInitializer(this.logger, this.es);
      await es_initializer.initialize();

      const savedObjectsClient = new SavedObjectsClient(coreStart.savedObjects.createInternalRepository());
      const apmIndices = await this.getApmIndices(savedObjectsClient);
      await this.initRules(apmIndices);
      this.initialized = true;
    }
  }

  private async initRules(apmIndices: APMIndices) {
    this.instScoreTargetIndices = new InstScoreTargetIndices(this.logger, this.es);
    await this.instScoreTargetIndices.init(this.config.indices, apmIndices);
    const ruleInput: InstScoreRuleInput = {
      es: this.es,
      logger: this.logger,
      instScoreTargetIndices: this.instScoreTargetIndices,
      lookbackSeconds: this.lookbackSeconds
    }

    const rulesList = RULES.map(C => new C(ruleInput))
    rulesList.forEach(r => this.rules.set(r.ruleDefinition.id, r));

    const rules_definitions_ops: BulkRequest['operations'] = [];
    rulesList.map(r => r.ruleDefinition).forEach(rDef => {
      rules_definitions_ops.push({ update: { "_id": rDef.id } });
      rules_definitions_ops.push({
        doc: {
          rule: {
            id: rDef.id,
            description: rDef.description,
            impact_level: {
              name: rDef.impactLevel.name,
              weight: rDef.impactLevel.weight
            },
            rationale: rDef.rationale.replace(/\s*\r?\n\s*/g, ' '),
            criteria: rDef.criteria,
            target: rDef.target,
          }
        },
        doc_as_upsert: true
      });
    });

    await this.es.bulk({
      index: DEST_INDEX_RULES_DEFINITIONS,
      operations: rules_definitions_ops
    });

    this.logger.debug(`Rules initialized: ${rulesList.map(r => r.ruleDefinition.id).join(', ')}`);
  }

  private calc_score(
    evalResultsPerRuleAndService: Map<string, Map<string, InstScoreRuleEvaluationResult>>,
    get_result: (map: Map<string, InstScoreRuleEvaluationResult>) => EvalResultValues
  ): number {
    const n = IMPACT_LEVELS.length;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      const level = IMPACT_LEVELS[i];
      let num_passed = 0;
      let num_total = 0;
      this.rules.values().map(r => r.ruleDefinition).forEach(rDef => {
        if (rDef.impactLevel === level) {
          const evalResult = get_result(evalResultsPerRuleAndService.get(rDef.id) || new Map());
          if (evalResult !== EvalResultValues.NOT_APPLICABLE) {
            num_total += 1;
            num_passed += (evalResult === EvalResultValues.PASSED) ? 1 : 0;
          }
        }
      });
      numerator += num_passed * level.weight;
      denominator += num_total * level.weight;
    }

    return denominator > 0 ? 100 * numerator / denominator : -1;
  }

  private calculate_instrumentation_score(
    evalResultsPerRuleAndService: Map<string, Map<string, InstScoreRuleEvaluationResult>>,
    allServices: string[]
  ): InstScoreResult {
    const overallScore = this.calc_score(
      evalResultsPerRuleAndService,
      (map: Map<string, InstScoreRuleEvaluationResult>) => {
        if (map.values().every(r => r.result === EvalResultValues.NOT_APPLICABLE)) {
          return EvalResultValues.NOT_APPLICABLE;
        }
        if (map.values().every(r => r.result !== EvalResultValues.FAILED)) {
          return EvalResultValues.PASSED;
        }
        return EvalResultValues.FAILED;
      }
    );

    const scorePerService = new Map<string, number>();
    allServices.forEach(service => {
      const serviceScore = this.calc_score(
        evalResultsPerRuleAndService,
        (map: Map<string, InstScoreRuleEvaluationResult>) => map?.get(service)?.result || EvalResultValues.NOT_APPLICABLE
      );
      scorePerService.set(service, serviceScore);
    });

    return {
      overallScore,
      scorePerService
    }
  }

  private get_rule_results_es_operations(ruleDef: InstScoreRuleDef, evalResult: InstScoreRuleEvaluationResult, service?: string) {
    const rule_part = {
      id: ruleDef.id,
      impact_level: {
        name: ruleDef.impactLevel.name,
        weight: ruleDef.impactLevel.weight
      }
    }
    return [
      { create: { _index: DEST_INDEX_RULES_RESULTS } },
      {
        "@timestamp": new Date().toISOString(),
        rule: rule_part,
        "service.name": service,
        result: evalResult.result,
        example: evalResult.example,
        extent: evalResult.extent,
      }
    ]
  }

  private async store_rule_results(results: Map<string, Map<string, InstScoreRuleEvaluationResult>>) {
    const operations: BulkRequest['operations'] = [];

    for (const [ruleId, result] of results.entries()) {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        continue;
      }

      let overall_result = EvalResultValues.NOT_APPLICABLE;
      let overall_example: { field: string, value: string } | undefined = undefined;
      let overall_extent: { count: number, total: number } | undefined = undefined;

      result.entries().forEach(([service, evalResult]) => {
        operations.push(...this.get_rule_results_es_operations(rule.ruleDefinition, evalResult, service));
        if (overall_result === EvalResultValues.NOT_APPLICABLE && evalResult.result === EvalResultValues.PASSED) {
          overall_result = EvalResultValues.PASSED;
        } else if (evalResult.result === EvalResultValues.FAILED) {
          overall_result = EvalResultValues.FAILED;
          if (!!evalResult.example && !overall_example) {
            overall_example = evalResult.example;
          }
          if (!!evalResult.extent) {
            if (overall_extent === undefined) {
              overall_extent = {
                count: evalResult.extent.count,
                total: evalResult.extent.total
              }
            } else {
              overall_extent.count += evalResult.extent.count;
              overall_extent.total += evalResult.extent.total;
            }
          }
        }
      });

      operations.push(...this.get_rule_results_es_operations(rule.ruleDefinition, {
        result: overall_result,
        example: overall_example,
        extent: overall_extent
      }));
    }

    this.es.bulk({
      index: DEST_INDEX_RULES_RESULTS,
      operations: operations
    });
  }

  private get_score_results_es_operations(score: number, service?: string) {
    return [
      { create: { _index: DEST_INDEX_SCORE } },
      {
        "@timestamp": new Date().toISOString(),
        "service.name": service,
        instrumentation_score: score
      }
    ]
  }

  private async store_score_results(score: InstScoreResult) {
    const operations: BulkRequest['operations'] = [];

    for (const [service, service_score] of score.scorePerService.entries()) {
      operations.push(...this.get_score_results_es_operations(service_score, service));
    }
    operations.push(...this.get_score_results_es_operations(score.overallScore));

    this.es.bulk({
      index: DEST_INDEX_SCORE,
      operations: operations
    });
  }

  async execute() {
    const allServicesQuery = `FROM ${this.instScoreTargetIndices.get(SignalType.RESOURCE)}
      | WHERE service.name IS NOT NULL AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | STATS services = VALUES(service.name)`;

    const allServicesResp = await this.es.esql.query({
      query: allServicesQuery,
      drop_null_columns: true,
      include_ccs_metadata: true,
    });

    const servicesColIdx = allServicesResp.columns.findIndex(col => col.name === "services")
    const row = allServicesResp.values?.[0]
    const val = (!!row && servicesColIdx >= 0) ? row[servicesColIdx] : undefined
    const allServices = !!val ? (typeof val === 'string') ? [val as string] : (val as unknown as string[] || []) : [];

    const evalResultsPerRuleAndService = new Map<string, Map<string, InstScoreRuleEvaluationResult>>();
    for (const rule of this.rules.values()) {
      try {
        const result = await rule.evaluate(allServices);
        evalResultsPerRuleAndService.set(rule.ruleDefinition.id, result);
      } catch (e) {
        this.logger.error(`Error evaluating rule ${rule.ruleDefinition.id}: ${e}`);
        this.logger.error(`ES|QL query: ${rule.getEvaluationQuery()}`);
      }
    }

    const scoreResult = this.calculate_instrumentation_score(evalResultsPerRuleAndService, allServices);

    await this.store_rule_results(evalResultsPerRuleAndService);
    await this.store_score_results(scoreResult);

    return { state: { lastRun: new Date().toISOString() } };
  }
}





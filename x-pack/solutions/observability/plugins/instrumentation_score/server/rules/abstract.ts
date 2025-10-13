import { ElasticsearchClient, type Logger } from "@kbn/core/server";
import { EvalResultValues, ImpactLevel, InstScoreRuleEvaluationResult, SignalType } from "../types";
import { InstScoreTargetIndices } from "../es_indices";
import { EsqlEsqlColumnInfo } from "@elastic/elasticsearch/lib/api/types";
import { FieldValue } from "@kbn/esql-composer/src/types";

export const UNKNOWN_SERVICE = '<<no_service>>';

export type RuleCtor = new (input: InstScoreRuleInput) => InstScoreRule;

export interface InstScoreRuleInput {
  es: ElasticsearchClient;
  logger: Logger;
  instScoreTargetIndices: InstScoreTargetIndices;
  lookbackSeconds: number;
}

export interface InstScoreRuleDef {
  id: string;
  description: string;
  impactLevel: ImpactLevel;
  target: SignalType;
  rationale: string;
  criteria: string;
}

export abstract class InstScoreRule {
  ruleDefinition: InstScoreRuleDef;
  es: ElasticsearchClient;
  logger: Logger;
  indices: string;
  lookbackSeconds: number;

  SERVICE_NAME = 'resource.attributes.service.name';
  PASSED = 'passed';
  EXAMPLE_VALUE = "example_value";
  REPR_COUNT = "repr_count";
  REPR_DENOMINATOR = "repr_denominator";

  constructor(input: InstScoreRuleInput, ruleDef: InstScoreRuleDef) {
    this.ruleDefinition = ruleDef;
    this.es = input.es;
    this.logger = input.logger;
    this.indices = input.instScoreTargetIndices.get(this.ruleDefinition.target);
    this.lookbackSeconds = input.lookbackSeconds;
  }

  abstract getEvaluationQuery(): string | undefined;
  abstract getExampleFieldName(): string | undefined;

  getExampleQuery = (serviceName: string, columns: EsqlEsqlColumnInfo[], row: FieldValue[]): string | undefined => undefined;
  isExampleInEvaluationQuery = (): boolean => false;

  async evaluate(allServices: string[]): Promise<Map<string, InstScoreRuleEvaluationResult>> {
    const query = this.getEvaluationQuery();
    if (!query) {
      throw new Error(`No evaluation query defined for rule ${this.ruleDefinition.id}`);
    }
    const resp = await this.es.esql.query({
      query: query,
      drop_null_columns: true,
      include_ccs_metadata: true,
    });

    const serviceNameColIdx = resp.columns.findIndex(col => col.name === this.SERVICE_NAME);
    const passedColIdx = resp.columns.findIndex(col => col.name === this.PASSED);
    const reprCountColIdx = resp.columns.findIndex(col => col.name === this.REPR_COUNT);
    const reprDenominatorColIdx = reprCountColIdx ? resp.columns.findIndex(col => col.name === this.REPR_DENOMINATOR) : -1;

    let exampleColIdx = -1;
    if (this.isExampleInEvaluationQuery()) {
      exampleColIdx = resp.columns.findIndex(col => col.name === this.EXAMPLE_VALUE)
    }

    const result = new Map<string, InstScoreRuleEvaluationResult>();
    const checkedServices: string[] = [];
    for (const row of resp.values || []) {
      const serviceName = serviceNameColIdx >= 0 ? (row[serviceNameColIdx] || UNKNOWN_SERVICE) as string : UNKNOWN_SERVICE;
      checkedServices.push(serviceName);
      const passed = row[passedColIdx] as boolean;
      const evalResult: InstScoreRuleEvaluationResult = {
        result: passed ? EvalResultValues.PASSED : EvalResultValues.FAILED,
        example: undefined,
        extent: undefined,
      };
      if (!passed) {
        if (reprCountColIdx >= 0 && reprDenominatorColIdx >= 0) {
          evalResult['extent'] = {
            count: row[reprCountColIdx] as number,
            total: row[reprDenominatorColIdx] as number
          };
        }

        if (this.isExampleInEvaluationQuery() && exampleColIdx >= 0) {
          evalResult['example'] = {
            field: this.getExampleFieldName() || "",
            value: row[exampleColIdx] as string
          };
        } else if (!this.isExampleInEvaluationQuery()) {
          const exampleQuery = this.getExampleQuery(serviceName, resp.columns, row);
          if (exampleQuery) {
            const respExample = await this.es.esql.query({
              query: exampleQuery,
              drop_null_columns: true,
              include_ccs_metadata: true,
            });
            const exampleFieldName = this.getExampleFieldName();
            if (exampleFieldName) {
              const exampleFieldIdx = respExample.columns.findIndex(col => col.name === this.EXAMPLE_VALUE)
              if (respExample.values && respExample.values.length > 0 && exampleFieldIdx >= 0) {
                evalResult['example'] = {
                  field: exampleFieldName,
                  value: respExample.values[0][exampleFieldIdx] as string
                };
              }
            }

            const extentCountColIdx = respExample.columns.findIndex(col => col.name === this.REPR_COUNT);
            const extentDenominatorColIdx = extentCountColIdx ? respExample.columns.findIndex(col => col.name === this.REPR_DENOMINATOR) : -1;
            if (respExample.values && respExample.values.length > 0 && extentCountColIdx >= 0 && extentDenominatorColIdx >= 0) {
              evalResult['extent'] = {
                count: respExample.values[0][extentCountColIdx] as number,
                total: respExample.values[0][extentDenominatorColIdx] as number
              };
            }
          }
        }
      }

      result.set(serviceName, evalResult);
    }

    allServices.filter(s => !checkedServices.includes(s)).forEach(s => result.set(s, { result: EvalResultValues.NOT_APPLICABLE, example: undefined, extent: undefined }))

    return result;
  }
}
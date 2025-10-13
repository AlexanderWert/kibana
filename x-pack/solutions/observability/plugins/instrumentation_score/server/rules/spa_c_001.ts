import { FieldValue } from "@kbn/esql-composer/src/types";
import { IL_CRITICAL, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";
import { EsqlEsqlColumnInfo } from "@elastic/elasticsearch/lib/api/types";

const NUM_LOOKBACK_WINDOWS = 5;

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-C-001',
  description: 'Spans that represent service transactions must have bound cardinality in their span names.',
  impactLevel: IL_CRITICAL,
  target: SignalType.SPANS,
  rationale: `Similar to rule SPA-003. However, high-cardinality transactions are even worse as transactions represent entry-points into services.
    With high-cardinality transaction names assets like overview transaction views and alerting rules become useless.`,
  criteria: `Over a reasonable amount of time the number of unique transaction names does not grow in any significant way.`
}

export class SpaC001Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" 
          AND @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
      | STATS num_txs_1 = COUNT_DISTINCT(transaction.name) WHERE @timestamp > NOW() - ${this.lookbackSeconds}s,
          num_txs_2 = COUNT_DISTINCT(transaction.name)
          BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = (num_txs_2 <= 50) OR (TO_DOUBLE(num_txs_2) < 1.05 * TO_DOUBLE(num_txs_1)) OR (num_txs_2 < num_txs_1 + 5)
      | KEEP ${this.SERVICE_NAME}, ${this.PASSED}`;

  getExampleQuery = (serviceName: string,
    columns: EsqlEsqlColumnInfo[],
    row: FieldValue[]) => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" 
          AND ${this.SERVICE_NAME}=="${serviceName}" 
          AND @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
      | STATS calls_per_txn_name = COUNT(transaction.id) BY transaction.name
      | STATS ${this.EXAMPLE_VALUE} = SAMPLE(transaction.name, 1) WHERE calls_per_txn_name == 1,
          ${this.REPR_COUNT} = COUNT(*) WHERE calls_per_txn_name == 1,
          ${this.REPR_DENOMINATOR} = COUNT(*)
      | KEEP ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  getExampleFieldName = () => "transaction.name";
}
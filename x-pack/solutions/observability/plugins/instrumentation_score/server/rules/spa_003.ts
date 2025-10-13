import { FieldValue } from "@kbn/esql-composer/src/types";
import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";
import { EsqlEsqlColumnInfo } from "@elastic/elasticsearch/lib/api/types";

const NUM_LOOKBACK_WINDOWS = 5;

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-003',
  description: 'Span names have bound cardinality.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.SPANS,
  rationale: `HTTP and Database span names, depending on the instrumentation,
    can be high cardinality due to literals embedded in database queries, or literal URL paths instead of HTTP routes.
    High-cardinality span names impact the usefulness of group-by mechanics,
    reduce the effectiveness of filtering mechanics, and can blow up indexes in tools that rely on them.`,
  criteria: 'Over a reasonable amount of time the ratio of unique span names per transaction name does not grow in any significant way.'
}

export class Spa003Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" AND @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
      | STATS num_txs_1 = COUNT_DISTINCT(transaction.name, 10000) WHERE @timestamp > NOW() - ${this.lookbackSeconds}s,
        num_span_names_1 = COUNT_DISTINCT(span.name, 10000) WHERE @timestamp > NOW() - ${this.lookbackSeconds}s AND (span.id != transaction.id OR transaction.id IS NULL),
        num_txs_2 = COUNT_DISTINCT(transaction.name, 10000) WHERE @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s,
        num_span_names_2 = COUNT_DISTINCT(span.name, 10000) WHERE @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s AND (span.id != transaction.id OR transaction.id IS NULL)
          BY ${this.SERVICE_NAME}
      | EVAL u_spans_per_txns_ratio_1 = TO_DOUBLE(num_span_names_1) / TO_DOUBLE(num_txs_1),
        u_spans_per_txns_ratio_2 = TO_DOUBLE(num_span_names_2) / TO_DOUBLE(num_txs_2)
      | EVAL ${this.PASSED} = u_spans_per_txns_ratio_2 <= 1.0 OR u_spans_per_txns_ratio_2 < 1.05 * u_spans_per_txns_ratio_1 OR num_span_names_2 < 100
      | KEEP ${this.SERVICE_NAME}, ${this.PASSED}`;

  getExampleQuery = (serviceName: string,
    columns: EsqlEsqlColumnInfo[],
    row: FieldValue[]) => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" 
        AND ${this.SERVICE_NAME}=="${serviceName}" 
        AND @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
      | STATS calls_per_span_name = COUNT(span.id) BY span.name
      | STATS ${this.EXAMPLE_VALUE} = SAMPLE(span.name, 1) WHERE calls_per_span_name == 1,
          ${this.REPR_COUNT} = COUNT(*) WHERE calls_per_span_name == 1,
          ${this.REPR_DENOMINATOR} = COUNT(*)
      | KEEP ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  getExampleFieldName = () => "span.name";
}
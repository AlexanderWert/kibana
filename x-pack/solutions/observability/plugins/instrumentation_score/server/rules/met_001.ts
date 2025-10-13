import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const NUM_LOOKBACK_WINDOWS = 5;
const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'MET-001',
  description: 'Metric attributes have bound cardinality.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.METRICS,
  rationale: `High cardinality metric attributes can significantly degrade performance and increase storage costs of observability systems.
  They lead to a large number of unique time series, making it difficult to aggregate, query, and analyze metrics effectively.
  This rule helps identify and address such attributes.`,
  criteria: `Cardinality of metrics must not grow significantly faster than corresponding resources (e.g. Pods / containers)`
}

export class Met001Rule extends InstScoreRule {
  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => {
    return `FROM ${this.indices} METADATA _tsid
      | WHERE data_stream.type == "metrics" AND 
          @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
      | STATS cnt_series_window_1 = count_distinct(_tsid) WHERE @timestamp > NOW() - ${this.lookbackSeconds}s,
          cnt_series_window_2 = count_distinct(_tsid) WHERE @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s,
          cnt_container_ids_1 = count_distinct(container.id) WHERE @timestamp > NOW() - ${this.lookbackSeconds}s,
          cnt_container_ids_2 = count_distinct(container.id) WHERE @timestamp > NOW() - ${this.lookbackSeconds * NUM_LOOKBACK_WINDOWS}s
            BY _metric_names_hash, ${this.SERVICE_NAME}
      | EVAL growth_container_id = CASE(cnt_container_ids_1 > 0, TO_DOUBLE(cnt_container_ids_2) / TO_DOUBLE(cnt_container_ids_1), 1.0),
          series_growth = CASE(cnt_series_window_2 > 0, TO_DOUBLE(cnt_series_window_2) / TO_DOUBLE(cnt_series_window_1), 1.0)
      | EVAL growth_ratio = series_growth / growth_container_id
      | EVAL high_card = TO_DOUBLE(cnt_series_window_2) > 1.05 * TO_DOUBLE(cnt_series_window_1) AND cnt_series_window_2 > 50 AND growth_ratio >= 1.05
      | STATS ${this.REPR_COUNT} = COUNT(*) WHERE high_card == true,
          ${this.EXAMPLE_VALUE} = SAMPLE(_metric_names_hash, 1) WHERE high_card == true,
          ${this.REPR_DENOMINATOR} = COUNT(*) BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = ${this.REPR_COUNT} == 0
      | KEEP ${this.SERVICE_NAME}, ${this.PASSED}, ${this.EXAMPLE_VALUE}, ${this.REPR_DENOMINATOR}, ${this.REPR_COUNT}`;
    }

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "_metric_names_hash";
}
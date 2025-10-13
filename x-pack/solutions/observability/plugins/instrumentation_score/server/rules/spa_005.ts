import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const DURATION_THRESHOLD_US = 5000;

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-005',
  description: 'Traces do not contain a high number of short duration spans.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.SPANS,
  rationale: `An excessive number of very short-duration internal spans (span.kind=INTERNAL) within a trace might indicate excessive internal calls,
    instrumentation overhead, or potentially inefficient code. Identifying such traces can help optimize application performance and reduce unnecessary overhead.`,
  criteria: 'No more than 20 spans within a single trace have a `duration` less than 5 milliseconds.'
}

export class Spa005Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
    | WHERE data_stream.type == "traces" AND @timestamp > NOW() - ${this.lookbackSeconds}s
    | STATS
        c_short_internal_spans = COUNT(span.id) WHERE
          kind == "Internal" AND span.duration.us < ${DURATION_THRESHOLD_US},
        c_spans = COUNT(*)
          BY trace.id, ${this.SERVICE_NAME}
    | STATS
        ${this.REPR_COUNT} = COUNT(*) WHERE c_short_internal_spans > 20,
        ${this.EXAMPLE_VALUE} = SAMPLE(trace.id, 1) WHERE c_short_internal_spans > 20,
        ${this.REPR_DENOMINATOR} = COUNT(*)
          BY ${this.SERVICE_NAME}
    | EVAL ${this.PASSED} = ${this.REPR_COUNT} == 0
    | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}, ${this.EXAMPLE_VALUE}`;

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "trace.id";
}
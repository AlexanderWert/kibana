import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'SPA-C-003',
  description: 'Exit spans must have the `span.destination.service.resource` field set.',
  impactLevel: IL_IMPORTANT,
  target: SignalType.SPANS,
  rationale: `Exit spans are the links between service calls and are used to generate the Service Map.
    Therefore, a reliable identifier for the called target-entity is required, which is the \`span.destination.service.resource\` field.
    For OpenTelemetry data this field is derived from corresponding semantic conventions attributes, such as HTTP URL, GRPC service, etc.
    If none of the valid semantic conventions attributes exist on an exit span, the  \`span.destination.service.resource\` field stays empty
    and the Service Map cannot be recostructed properly`,
  criteria: `Every span that is an exit span has the \`span.destination.service.resource\` field set.`
}

export class SpaC003Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
      | WHERE data_stream.type == "traces" AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | EVAL is_exit = kind IN ("Client", "Producer") AND span.type NOT IN ("unknown", "app")
      | STATS ${this.REPR_COUNT} = COUNT(*) WHERE is_exit AND span.destination.service.resource IS NULL,
          ${this.REPR_DENOMINATOR} = COUNT(*) WHERE is_exit,
          ${this.EXAMPLE_VALUE} = SAMPLE(span.id, 1) WHERE is_exit AND span.destination.service.resource IS NULL
            BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = ${this.REPR_COUNT} == 0
      | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "span.id";
}
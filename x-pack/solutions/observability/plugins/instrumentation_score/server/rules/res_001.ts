import { IL_NORMAL, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'RES-001',
  description: '`service.instance.id` is present.',
  impactLevel: IL_NORMAL,
  target: SignalType.RESOURCE,
  rationale: `The service.instance.id uniquely identifies a resource, and can be used as the process identifier without taking other resource attributes into account.`,
  criteria: 'On every document with the resource attribute `service.name` being present the `service.instance.id` resource attribute is present.'
}

export class Res001Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices} METADATA _id
      | WHERE ${this.SERVICE_NAME} IS NOT NULL
        AND resource.attributes.signaltometrics.service.name IS NULL
        AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | FORK
        (WHERE service.instance.id IS NULL)
        (WHERE service.instance.id IS NOT NULL)
      | STATS ${this.REPR_DENOMINATOR} = COUNT(*),
          ${this.REPR_COUNT} = COUNT(*) WHERE _fork == "fork1",
          ${this.EXAMPLE_VALUE} = SAMPLE(_id, 1) WHERE _fork == "fork1"
            BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = ${this.REPR_COUNT} == 0
      | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "_id";
}
import { IL_IMPORTANT, SignalType } from "../types";
import { InstScoreRule, InstScoreRuleDef, InstScoreRuleInput } from "./abstract";

const RULE_DEFINITION: InstScoreRuleDef = {
  id: 'RES-002',
  description: '`service.instance.id` is unique across logical resources within a given `service.name`',
  impactLevel: IL_IMPORTANT,
  target: SignalType.RESOURCE,
  rationale: `The service.instance.id uniquely identifies a resource, however, 
    it's being misused when another resource attribute is present indicating that two workloads are sharing the same \`service.instance.id.\``,
  criteria: 'The `service.instance.id` resource attribute is unique across logical resources, e.g., different Kubernetes pods.',
}

export class Res002Rule extends InstScoreRule {

  constructor(input: InstScoreRuleInput) {
    super(input, RULE_DEFINITION)
  }

  getEvaluationQuery = () => `FROM ${this.indices}
      | WHERE ${this.SERVICE_NAME} IS NOT NULL 
          AND service.instance.id IS NOT NULL
          AND @timestamp > NOW() - ${this.lookbackSeconds}s
      | STATS c_pods = COUNT_DISTINCT(resource.attributes.k8s.pod.uid, 100),
          c_host_names = COUNT_DISTINCT(resource.attributes.host.name, 100)
        BY ${this.SERVICE_NAME}, service.instance.id
      | STATS max_pods = MAX(c_pods),
          max_hosts = MAX(c_host_names),
          ${this.REPR_COUNT} = COUNT(*) WHERE c_pods > 1 OR c_host_names > 1,
          ${this.REPR_DENOMINATOR} = COUNT(*),
          ${this.EXAMPLE_VALUE} = SAMPLE(service.instance.id, 1) WHERE c_pods > 1 OR c_host_names > 1
            BY ${this.SERVICE_NAME}
      | EVAL ${this.PASSED} = max_pods <= 1 AND max_hosts <= 1
      | KEEP ${this.PASSED}, ${this.SERVICE_NAME}, ${this.EXAMPLE_VALUE}, ${this.REPR_COUNT}, ${this.REPR_DENOMINATOR}`;

  isExampleInEvaluationQuery = () => true;

  getExampleFieldName = () => "service.instance.id";

}
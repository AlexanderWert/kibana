import { RuleCtor } from "./abstract";
import { Log002Rule } from "./log_002";
import { Res001Rule } from "./res_001";
import { Res002Rule } from "./res_002";
import { Spa002Rule } from "./spa_002";
import { Spa003Rule } from "./spa_003";
import { SpaC001Rule } from "./spa_c_001";
import { SpaC002Rule } from "./spa_c_002";

export const RULES: RuleCtor[] = [
  Res001Rule,
  Res002Rule,
  Log002Rule,
  Spa002Rule,
  Spa003Rule,
  SpaC001Rule,
  SpaC002Rule
]
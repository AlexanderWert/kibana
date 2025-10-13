import { RuleCtor } from "./abstract";
import { Log001Rule } from "./log_001";
import { Log002Rule } from "./log_002";
import { Met001Rule } from "./met_001";
import { Res001Rule } from "./res_001";
import { Res002Rule } from "./res_002";
import { Spa002Rule } from "./spa_002";
import { Spa003Rule } from "./spa_003";
import { Spa005Rule } from "./spa_005";
import { SpaC001Rule } from "./spa_c_001";
import { SpaC002Rule } from "./spa_c_002";
import { SpaC003Rule } from "./spa_c_003";

export const RULES: RuleCtor[] = [
  Res001Rule,
  Res002Rule,
  Log001Rule,
  Log002Rule,
  Spa002Rule,
  Spa003Rule,
  Spa005Rule,
  SpaC001Rule,
  SpaC002Rule,
  SpaC003Rule,
  Met001Rule,
]
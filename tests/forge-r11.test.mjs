import {testAudit} from './forge-r11-audit.case.mjs';
import {testPlan} from './forge-r11-plan.case.mjs';
import {testHttp} from './forge-r11-http.case.mjs';
testAudit();testPlan();await testHttp();
console.log('FORGE_R11_TEST_OK: graph integrity, inverse links, ghost UI, MAS auth');

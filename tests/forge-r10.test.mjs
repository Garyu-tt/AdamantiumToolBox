import {testPlan} from './forge-r10-plan.case.mjs';
import {testAssess} from './forge-r10-assess.case.mjs';
import {testHttp} from './forge-r10-http.case.mjs';
testPlan();testAssess();await testHttp();
console.log('FORGE_R10_TEST_OK: safe candidates, bounded attempts, receipts, MAS auth');

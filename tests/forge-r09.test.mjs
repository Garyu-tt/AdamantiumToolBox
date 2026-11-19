import {testLease,leaseRequest} from './forge-r09-lease.case.mjs';
import {testRevoke,revokeRequest} from './forge-r09-revoke.case.mjs';
import {testHttp} from './forge-r09-http.case.mjs';
testLease();testRevoke();await testHttp({leaseRequest,revokeRequest});
console.log('FORGE_R09_TEST_OK: lease boundaries, scope, revoke receipts, independent HTTP');

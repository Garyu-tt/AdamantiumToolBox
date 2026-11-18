import {createAdapterServer} from '../shared/server.mjs';
import {CAPABILITY} from './authorize.mjs';
import {sandboxReady,runJavaScript} from './sandbox.mjs';
createAdapterServer({capability:CAPABILITY,language:'javascript',
 ready:sandboxReady,execute:runJavaScript})
 .listen(Number(process.env.FRANK_ADAPTER_PORT),'127.0.0.1');

import {createAdapterServer} from '../shared/server.mjs';
import {CAPABILITY} from './authorize.mjs';
import {sandboxReady,runPython} from './sandbox.mjs';
createAdapterServer({capability:CAPABILITY,language:'python',
 ready:sandboxReady,execute:runPython})
 .listen(Number(process.env.FRANK_ADAPTER_PORT),'127.0.0.1');

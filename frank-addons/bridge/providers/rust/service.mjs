import {createAdapterServer} from '../shared/server.mjs';
import {sandboxReady,runRust} from './sandbox.mjs';
createAdapterServer({capability:'frankenstein.adapter.rust',
 language:'rust',ready:sandboxReady,execute:runRust})
 .listen(Number(process.env.FRANK_ADAPTER_PORT),'127.0.0.1');

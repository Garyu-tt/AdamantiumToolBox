import {validateFunction,prepareInvocation} from './contract.mjs';
import {composeFunction,planPublication,prepareReconciliation,validateIncident} from './pipeline.mjs';
import {negotiateProviders} from './negotiation.mjs';
import {projectEvents} from './events.mjs';
import {prepareIntegration,assessVisibility} from './integration.mjs';
import {planComposite,planCompositeImpact} from './composite.mjs';
import {planDistribution,recoverDistribution} from './distribution.mjs';
import {planReactive,assessReactive} from './reactive.mjs';
import {planProjection,planReconnect} from './projection.mjs';
export function dispatch(spec,params,protocol){
 return spec.id==='forge.describe'?protocol:
  spec.id==='forge.validate'?validateFunction(params?.function):
  spec.id==='forge.prepare'?prepareInvocation(params):
  spec.id==='forge.compose'?composeFunction(params):
  spec.id==='forge.publication.plan'?planPublication(params):
  spec.id==='forge.reconcile.prepare'?prepareReconciliation(params):
  spec.id==='forge.incident.validate'?validateIncident(params):
  spec.id==='forge.providers.negotiate'?negotiateProviders(params):
  spec.id==='forge.events.project'?projectEvents(params):
  spec.id==='forge.integration.prepare'?prepareIntegration(params):
  spec.id==='forge.visibility.assess'?assessVisibility(params):
  spec.id==='forge.composite.plan'?planComposite(params):
  spec.id==='forge.composite.impact'?planCompositeImpact(params):
  spec.id==='forge.distribution.plan'?planDistribution(params):
  spec.id==='forge.distribution.recover'?recoverDistribution(params):
  spec.id==='forge.reactive.plan'?planReactive(params):
  spec.id==='forge.reactive.assess'?assessReactive(params):
  spec.id==='forge.projection.plan'?planProjection(params):planReconnect(params);
}

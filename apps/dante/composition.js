// Versioned capability contracts, never concrete MAS provider identities.
export const COMPOSITION_SCHEMA = 'dante.composition.v1';
export const STAGES = Object.freeze([
 {key:'world.observe',contract:'dante.world.observe.v1',title:'Мир: восприятие'},
 {key:'sensory.deliver',contract:'dante.sensory.deliver.v1',title:'Сенсорная шина'},
 {key:'genesis.apply',contract:'dante.genesis.apply.v1',title:'Genesis: когнитивная система'},
 {key:'motor.command',contract:'dante.motor.command.v1',title:'Моторика'},
 {key:'world.apply',contract:'dante.world.apply.v1',title:'Мир: применение действия'},
 {key:'state.checkpoint',contract:'dante.state.checkpoint.v1',title:'Атомарная память'},
 {key:'state.restore',contract:'dante.state.restore.v1',title:'Восстановление состояния'}
]);
const validNode=n=>n&&n.type==='action'&&typeof n.id==='string'&&
 /^[a-z][a-z0-9_-]{1,39}\.[a-z][a-z0-9_.-]{0,95}$/.test(n.id)&&
 typeof n.contract==='string'&&n.id!=='dante.status';
export function inspectComposition(graph){
 const nodes=Array.isArray(graph?.nodes)?graph.nodes.filter(validNode):[];
 const stages=STAGES.map(stage=>{
  const ids=[...new Set(nodes.filter(n=>n.contract===stage.contract).map(n=>n.id))].sort();
  return {...stage,providers:ids,status:ids.length===1?'discovered':ids.length?'ambiguous':'missing'};
 });
 const discovered=stages.every(stage=>stage.status==='discovered');
 return Object.freeze({schema:COMPOSITION_SCHEMA,stages,discovered,
  runnable:false, // No runtime attestation, signed release, or persistent Genesis proof.
  reason:discovered?'live_genesis_and_release_verification_required':'missing_or_ambiguous_contracts'});
}

import { SimulationSystemGroup, defineSystem } from '@ir-engine/ecs'

const execute = () => {}

const ItemSpawnSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponSystem',
  insert: { with: SimulationSystemGroup },
  execute
})

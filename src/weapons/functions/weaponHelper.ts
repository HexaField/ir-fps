import {
  ECSState,
  Entity,
  EntityUUID,
  InputSystemGroup,
  UUIDComponent,
  createEntity,
  defineSystem,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { getState } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { LineSegmentComponent } from '@ir-engine/spatial/src/renderer/components/LineSegmentComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/xrui/functions/ObjectFitFunctions'
import { BoxGeometry, BufferGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { HITSCAN_TRACKER_LIFESPAN, HITSCAN_TRACKER_MATERIAL } from '../constants/WeaponConstants'

export const createReticle = (viewerEntity) => {
  const entity = createEntity()
  setComponent(entity, NameComponent, 'Weapon Reticle')
  setComponent(entity, UUIDComponent, 'Weapon Reticle' as EntityUUID)
  setComponent(entity, VisibleComponent)
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).localFloorEntity })
  setComponent(entity, ComputedTransformComponent, {
    referenceEntities: [viewerEntity],
    computeFunction: () => {
      const camera = getComponent(viewerEntity, CameraComponent)
      const distance = camera.near * 1.1 // 10% in front of camera
      ObjectFitFunctions.attachObjectInFrontOfCamera(entity, 0.01, distance)
    }
  })
  setComponent(entity, TransformComponent, { position: new Vector3(0, 0, 0.1) })

  // create four rectangles for reticle
  const templateGeometry = new BufferGeometry()
    .setFromPoints([
      // a
      new Vector3(0.05, -0.1, 0),
      new Vector3(0.05, 0.1, 0),
      new Vector3(-0.05, 0.1, 0),
      // b
      new Vector3(0.05, -0.1, 0),
      new Vector3(-0.05, 0.1, 0),
      new Vector3(-0.05, -0.1, 0)
    ])
    .scale(0.5, 0.5, 0.5)
  const topGeometry = templateGeometry.clone().translate(0, 0.1, 0)
  const bottomGeometry = templateGeometry.clone().translate(0, -0.1, 0)
  const leftGeometry = templateGeometry
    .clone()
    .rotateZ(Math.PI / 2)
    .translate(-0.1, 0, 0)
  const rightGeometry = templateGeometry
    .clone()
    .rotateZ(Math.PI / 2)
    .translate(0.1, 0, 0)
  const reticleGeometry = mergeBufferGeometries([topGeometry, bottomGeometry, leftGeometry, rightGeometry])!
  const reticleMaterial = new MeshBasicMaterial({ color: 'grey' })
  setComponent(entity, MeshComponent, new Mesh(reticleGeometry, reticleMaterial))
  addObjectToGroup(entity, getComponent(entity, MeshComponent))
  return entity
}

export const creatDefaultWeaponModel = (entity) => {
  const geometry = mergeBufferGeometries([
    new BoxGeometry(0.05, 0.05, 0.25),
    new BoxGeometry(0.025, 0.125, 0.025).translate(0, -0.125 * 0.5, 0.125)
  ])!.translate(0, 0, 0.125)
  const weaponModel = new Mesh(geometry, new MeshBasicMaterial({ color: 'grey' }))
  setComponent(entity, MeshComponent, weaponModel)
  addObjectToGroup(entity, weaponModel)
  return entity
}

let hitScanEntityCounter = 0
export const hitscanEntites = [] as Array<[Entity, number]>

export const createHitscanDebugLine = (start: Vector3, end: Vector3, range?: number) => {
  // just avoiding recalculating the range
  hitScanEntityCounter++
  const finalDirection = end.clone().sub(start)
  const finalRange = range || finalDirection.length()
  const directionQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), finalDirection.normalize())
  const entity = createEntity()
  setComponent(entity, UUIDComponent, ('Hitscan Tracker ' + hitScanEntityCounter) as EntityUUID)
  setComponent(entity, VisibleComponent)
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })
  setComponent(entity, TransformComponent, {
    position: start,
    rotation: directionQuaternion
  })

  setComponent(entity, LineSegmentComponent, {
    name: 'Hitscan Tracker ' + hitScanEntityCounter,
    geometry: new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -finalRange)]),
    material: HITSCAN_TRACKER_MATERIAL
  })
  const now = getState(ECSState).simulationTime
  hitscanEntites.push([entity, now])
  return entity
}

const execute = () => {
  const now = getState(ECSState).simulationTime
  for (let i = hitscanEntites.length - 1; i >= 0; i--) {
    const [entity, time] = hitscanEntites[i]
    if (time + HITSCAN_TRACKER_LIFESPAN < now) {
      removeEntity(entity)
      hitscanEntites.splice(i, 1)
    }
  }
}

const WeaponDebugSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponDebugSystem',
  insert: { with: InputSystemGroup },
  execute
})

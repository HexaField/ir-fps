import {
  ECSState,
  Engine,
  Entity,
  EntityUUID,
  SimulationSystemGroup,
  UUIDComponent,
  createEntity,
  defineQuery,
  defineSystem,
  getComponent,
  getMutableComponent,
  removeEntity,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
import {
  UserID,
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  matches,
  none,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { WorldNetworkAction, matchesUserID } from '@ir-engine/network'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { FollowCameraComponent } from '@ir-engine/spatial/src/camera/components/FollowCameraComponent'
import { FollowCameraMode } from '@ir-engine/spatial/src/camera/types/FollowCameraMode'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { LineSegmentComponent } from '@ir-engine/spatial/src/renderer/components/LineSegmentComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ObjectLayers } from '@ir-engine/spatial/src/renderer/constants/ObjectLayers'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/xrui/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector3
} from 'three'

const WeaponActions = {
  changeWeapon: defineAction({
    type: 'hexafield.fps-game.WeaponActions.CHANGE_WEAPON',
    userID: matchesUserID,
    weapon: matches.literals('pistol', 'disc', 'grenade'),
    handedness: matches.literals('left', 'right')
  })
}

const WeaponState = defineState({
  name: 'hexafield.fps-game.WeaponState',
  initial: {} as Record<UserID, { weapon: 'pistol' | 'disc' | 'grenade'; handedness: 'left' | 'right' }>,

  receptors: {
    onChangeWeapon: WeaponActions.changeWeapon.receive((action) => {
      getMutableState(WeaponState)[action.userID].set({
        weapon: action.weapon,
        handedness: action.handedness
      })
    }),
    onUserLeave: WorldNetworkAction.destroyEntity.receive((action) => {
      getMutableState(WeaponState)[action.entityUUID].set(none)
    })
  },

  reactor: () => {
    const keys = useMutableState(WeaponState).keys
    return (
      <>
        {keys.map((userID: UserID) => (
          <UserWeaponReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const UserWeaponReactor = (props: { userID: UserID }) => {
  // const weaponState = useHookstate(WeaponState)[props.userID]

  const weaponModelEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, UUIDComponent, 'Weapon Model' as EntityUUID)
    setComponent(entity, VisibleComponent)
    /** @todo update based on FOV */
    setComponent(entity, TransformComponent, { position: new Vector3(0.15, -0.2, -0.5) })
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).viewerEntity })
    setComponent(entity, NameComponent, 'Weapon Model')
    // simple two boxes for weapon model
    const geometry = mergeBufferGeometries([
      new BoxGeometry(0.05, 0.05, 0.25),
      new BoxGeometry(0.025, 0.125, 0.025).translate(0, -0.125 * 0.5, 0.125)
    ])!.translate(0, 0, 0.125)
    const weaponModel = new Mesh(geometry, new MeshBasicMaterial({ color: 'grey' }))
    setComponent(entity, MeshComponent, weaponModel)
    addObjectToGroup(entity, weaponModel)
    return entity
  }).value

  useEffect(() => {
    return () => {
      removeEntity(weaponModelEntity)
    }
  }, [])

  return null
}

let hitscanEntityCounter = 0
const hitscanEntites = [] as Array<[Entity, number]>
const hitscanTrackerLifespan = 3 * 1000 // 3 seconds
const hitscanRange = 100 // 100 meters
const hitscanTrackerMaterial = new LineBasicMaterial({ color: 'red' })
const hitscanRaycaster = new Raycaster()
hitscanRaycaster.firstHitOnly = true
hitscanRaycaster.far = hitscanRange
hitscanRaycaster.layers.set(ObjectLayers.Camera)
hitscanRaycaster.layers.enable(ObjectLayers.Avatar)

const _targetCameraPosition = new Vector3()

const cameraLayerQuery = defineQuery([VisibleComponent, MeshComponent])

// create temporary hitscan entity
const onPrimaryClick = () => {
  const entity = createEntity()
  const viewerEntity = getState(EngineState).viewerEntity
  const cameraTransform = getComponent(viewerEntity, TransformComponent)
  hitscanRaycaster.set(cameraTransform.position, new Vector3(0, 0, -1).applyQuaternion(cameraTransform.rotation))

  const sceneObjects = cameraLayerQuery().flatMap((e) => getComponent(e, MeshComponent))

  const [cameraRaycastHit] = hitscanRaycaster.intersectObjects(sceneObjects, true)
  if (cameraRaycastHit) {
    _targetCameraPosition.copy(cameraRaycastHit.point)
  } else {
    _targetCameraPosition
      .copy(hitscanRaycaster.ray.direction)
      .multiplyScalar(hitscanRange)
      .add(hitscanRaycaster.ray.origin)
  }

  const weaponPosition = new Vector3(0.15, -0.2, -0.5)
    .applyQuaternion(cameraTransform.rotation)
    .add(cameraTransform.position.clone()) // add hand offset

  const direction = _targetCameraPosition.clone().sub(weaponPosition).normalize()
  const directionQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), direction)

  setComponent(entity, UUIDComponent, ('Hitscan Tracker ' + hitscanEntityCounter) as EntityUUID)
  setComponent(entity, VisibleComponent)
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).originEntity })

  setComponent(entity, TransformComponent, {
    position: weaponPosition,
    rotation: directionQuaternion
  })

  setComponent(entity, LineSegmentComponent, {
    name: 'Hitscan Tracker ' + hitscanEntityCounter,
    geometry: new BufferGeometry().setFromPoints([
      new Vector3(),
      new Vector3(0, 0, -(cameraRaycastHit ? cameraRaycastHit.distance : hitscanRange))
    ]),
    material: hitscanTrackerMaterial
  })

  hitscanEntites.push([entity, getState(ECSState).simulationTime])

  hitscanEntityCounter++
}

const execute = () => {
  const viewerEntity = getState(EngineState).viewerEntity

  const buttons = InputComponent.getMergedButtons(viewerEntity)
  if (buttons.SecondaryClick?.down) onPrimaryClick()

  const now = getState(ECSState).simulationTime

  for (let i = hitscanEntites.length - 1; i >= 0; i--) {
    const [entity, time] = hitscanEntites[i]
    if (time + hitscanTrackerLifespan < now) {
      removeEntity(entity)
      hitscanEntites.splice(i, 1)
    }
  }
}

const reactor = () => {
  const reticleEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, 'Weapon Reticle')
    setComponent(entity, UUIDComponent, 'Weapon Reticle' as EntityUUID)
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).localFloorEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [getState(EngineState).viewerEntity],
      computeFunction: () => {
        const camera = getComponent(getState(EngineState).viewerEntity, CameraComponent)
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
  }).value

  useEffect(() => {
    dispatchAction(
      WeaponActions.changeWeapon({
        userID: Engine.instance.store.userID,
        weapon: 'pistol',
        handedness: 'right'
      })
    )

    return () => {
      removeEntity(reticleEntity)
    }
  }, [])

  const followCameraQuery = useQuery([FollowCameraComponent])

  useEffect(() => {
    for (const entity of followCameraQuery) {
      getMutableComponent(entity, FollowCameraComponent).merge({
        mode: FollowCameraMode.FirstPerson,
        pointerLock: true
      })
    }
  }, [followCameraQuery])

  return null
}

const WeaponSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponSystem',
  insert: { with: SimulationSystemGroup },
  execute,
  reactor
})

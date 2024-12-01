import {
  ECSState,
  Engine,
  Entity,
  EntityUUID,
  InputSystemGroup,
  UUIDComponent,
  createEntity,
  defineSystem,
  getComponent,
  getMutableComponent,
  hasComponent,
  removeEntity,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
import { AvatarRigComponent } from '@ir-engine/engine/src/avatar/components/AvatarAnimationComponent'
import { AvatarComponent } from '@ir-engine/engine/src/avatar/components/AvatarComponent'
import {
  UserID,
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  matches,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { NetworkObjectComponent, NetworkTopics, matchesUserID } from '@ir-engine/network'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { FollowCameraComponent } from '@ir-engine/spatial/src/camera/components/FollowCameraComponent'
import { FollowCameraMode } from '@ir-engine/spatial/src/camera/types/FollowCameraMode'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { Physics, RaycastArgs } from '@ir-engine/spatial/src/physics/classes/Physics'
import { CollisionGroups, DefaultCollisionMask } from '@ir-engine/spatial/src/physics/enums/CollisionGroups'
import { getInteractionGroups } from '@ir-engine/spatial/src/physics/functions/getInteractionGroups'
import { SceneQueryType } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { LineSegmentComponent } from '@ir-engine/spatial/src/renderer/components/LineSegmentComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/xrui/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import {
  BufferGeometry,
  LineBasicMaterial,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3
} from 'three'
import { HealthActions } from '../HealthSystem'
import { HitscanWeaponComponent } from './components/HitScanWeaponComponent'

const WeaponActions = {
  changeWeapon: defineAction({
    type: 'hexafield.fps-game.WeaponActions.CHANGE_WEAPON',
    userID: matchesUserID,
    weapon: matches.literals('pistol', 'disc', 'grenade'),
    handedness: matches.literals('left', 'right'),
    $cache: true,
    $topic: NetworkTopics.world
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
  const weaponState = useHookstate(getMutableState(WeaponState)[props.userID])

  const isSelf = props.userID === Engine.instance.store.userID

  const weaponModelEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, UUIDComponent, ('Weapon ' + props.userID) as EntityUUID)
    setComponent(entity, VisibleComponent)
    /** @todo update based on FOV */
    if (isSelf) {
      setComponent(entity, TransformComponent, { position: new Vector3(0.15, -0.2, -0.5) })
      setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).viewerEntity })
    } else {
      const avatarEntity = AvatarComponent.getUserAvatarEntity(props.userID)
      setComponent(entity, TransformComponent, { position: new Vector3(0.15, -0.2, -0.5) })
      setComponent(entity, EntityTreeComponent, { parentEntity: avatarEntity })
    }
    setComponent(entity, NameComponent, 'Weapon ' + props.userID)
    // simple two boxes for weapon model
    setComponent(entity, HitscanWeaponComponent)
    return entity
  }).value

  useEffect(() => {
    setComponent(weaponModelEntity, TransformComponent, {
      position: new Vector3(weaponState.handedness.value === 'left' ? -0.15 : 0.15, -0.2, -0.5)
    })
  }, [weaponState.handedness])

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
let lastFiredTime = 0
const _targetCameraPosition = new Vector3()

const raycastComponentData = {
  type: SceneQueryType.Closest,
  origin: new Vector3(),
  direction: new Vector3(),
  maxDistance: hitscanRange,
  groups: getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask)
} as RaycastArgs

// create temporary hitscan entity
// interact with current weapon
const onPrimaryClick = () => {
  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()!
  const physicsWorld = Physics.getWorld(selfAvatarEntity)
  if (!physicsWorld) return

  const weaponEntity = UUIDComponent.getEntityByUUID(('Weapon ' + Engine.instance.store.userID) as EntityUUID)
  const weaponParams = getComponent(weaponEntity, HitscanWeaponComponent)

  if (weaponParams.currentAmmo <= 0) {
    console.log('Out of ammo! Reload required.')
    return
  }

  const now = getState(ECSState).simulationTime
  if (lastFiredTime + weaponParams.fireRate > now) {
    console.log('Weapon cooling down.')
    return
  }

  const entity = createEntity()
  const viewerEntity = getState(EngineState).viewerEntity
  const cameraTransform = getComponent(viewerEntity, TransformComponent)
  raycastComponentData.excludeRigidBody = selfAvatarEntity
  const worldEntity = UUIDComponent.getEntityByUUID(physicsWorld.id)
  const worldTransform = getComponent(worldEntity, TransformComponent)
  const matrix = new Matrix4()
    .copy(worldTransform.matrixWorld)
    .invert()
    .multiply(getComponent(viewerEntity, CameraComponent).matrixWorld)
  raycastComponentData.origin.setFromMatrixPosition(matrix)
  let direction = new Vector3(0, 0, 0.5)
    .unproject(getComponent(viewerEntity, CameraComponent))
    .sub(raycastComponentData.origin)
    .normalize()
  const spreadAngle = weaponParams.spread
  const spreadRadians = MathUtils.degToRad(spreadAngle)
  const spreadOffset = new Vector3((Math.random() - 0.5) * spreadRadians, (Math.random() - 0.5) * spreadRadians, 0)

  direction.add(spreadOffset).normalize()
  raycastComponentData.direction.copy(direction)
  raycastComponentData.excludeRigidBody = selfAvatarEntity
  raycastComponentData.maxDistance = weaponParams.range

  let cameraRaycastHit: any = null

  if (weaponParams.scanSize > 0) {
    console.log('Conical scan not implemented yet.')
  } else {
    ;[cameraRaycastHit] = Physics.castRay(physicsWorld, raycastComponentData)
  }

  if (cameraRaycastHit) {
    _targetCameraPosition.set(cameraRaycastHit.position.x, cameraRaycastHit.position.y, cameraRaycastHit.position.z)
    const hitEntity = cameraRaycastHit.entity
    const isAvatarEntity = hasComponent(hitEntity, AvatarRigComponent)
    if (isAvatarEntity) {
      dispatchAction(
        HealthActions.affectHealth({
          userID: getComponent(hitEntity, NetworkObjectComponent).ownerId,
          amount: -weaponParams.damage
        })
      )
    }
  } else {
    _targetCameraPosition.copy(direction).multiplyScalar(hitscanRange).add(raycastComponentData.origin)
  }

  const weaponPosition = getComponent(weaponEntity, TransformComponent)
    .position.clone()
    .applyQuaternion(cameraTransform.rotation)
    .add(cameraTransform.position.clone()) // Add hand offset

  const finalDirection = _targetCameraPosition.clone().sub(weaponPosition).normalize()
  const directionQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), finalDirection)

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
      new Vector3(0, 0, -(cameraRaycastHit ? cameraRaycastHit.distance : weaponParams.range))
    ]),
    material: hitscanTrackerMaterial
  })

  hitscanEntites.push([entity, now])

  // Update weapon state
  getMutableComponent(weaponEntity, HitscanWeaponComponent).currentAmmo.set((value) => value - 1)
  lastFiredTime = now

  // Handle reload if needed
  if (weaponParams.currentAmmo <= 0) reload()

  hitscanEntityCounter++
}

const swapHands = () => {
  const weaponState = getState(WeaponState)[Engine.instance.store.userID]
  dispatchAction(
    WeaponActions.changeWeapon({
      userID: Engine.instance.store.userID,
      weapon: weaponState.weapon,
      handedness: weaponState.handedness === 'left' ? 'right' : 'left'
    })
  )
}

const reload = () => {
  const weaponEntity = UUIDComponent.getEntityByUUID(('Weapon ' + Engine.instance.store.userID) as EntityUUID)
  const weaponParams = getMutableComponent(weaponEntity, HitscanWeaponComponent)

  console.log('Reloading...')
  setTimeout(() => {
    weaponParams.currentAmmo.set(weaponParams.clipSize.value)
    console.log('Reload complete.')
  }, weaponParams.reloadTime.value)
}

const execute = () => {
  const viewerEntity = getState(EngineState).viewerEntity

  const buttons = InputComponent.getMergedButtons(viewerEntity)
  if (buttons.PrimaryClick?.down) onPrimaryClick()
  if (buttons.KeyZ?.down) swapHands()
  if (buttons.KeyR?.down) reload()

  const now = getState(ECSState).simulationTime

  for (let i = hitscanEntites.length - 1; i >= 0; i--) {
    const [entity, time] = hitscanEntites[i]
    if (time + hitscanTrackerLifespan < now) {
      removeEntity(entity)
      hitscanEntites.splice(i, 1)
    }
  }
}

const WeaponReactor = (props: { viewerEntity: Entity }) => {
  const reticleEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, 'Weapon Reticle')
    setComponent(entity, UUIDComponent, 'Weapon Reticle' as EntityUUID)
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).localFloorEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [props.viewerEntity],
      computeFunction: () => {
        const camera = getComponent(props.viewerEntity, CameraComponent)
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
    dispatchAction(HealthActions.affectHealth({ userID: Engine.instance.store.userID, amount: 0 }))
    return () => {
      removeEntity(reticleEntity)
    }
  }, [])

  const followCameraQuery = useQuery([FollowCameraComponent])

  useEffect(() => {
    for (const entity of followCameraQuery) {
      getMutableComponent(entity, FollowCameraComponent).merge({
        mode: FollowCameraMode.FirstPerson,
        pointerLock: true,
        smoothLerp: false
      })
    }
  }, [followCameraQuery])

  return null
}

const WeaponSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponSystem',
  insert: { with: InputSystemGroup },
  execute,
  reactor: () => {
    const viewerEntity = useMutableState(EngineState).viewerEntity.value
    if (!viewerEntity) return null

    return <WeaponReactor viewerEntity={viewerEntity} />
  }
})

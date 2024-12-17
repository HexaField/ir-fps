import {
  Engine,
  Entity,
  EntityUUID,
  InputSystemGroup,
  UUIDComponent,
  createEntity,
  defineSystem,
  getMutableComponent,
  removeEntity,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
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
import { NetworkTopics, matchesUserID } from '@ir-engine/network'
import { TransformComponent } from '@ir-engine/spatial'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { FollowCameraComponent } from '@ir-engine/spatial/src/camera/components/FollowCameraComponent'
import { FollowCameraMode } from '@ir-engine/spatial/src/camera/types/FollowCameraMode'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { Vector3 } from 'three'
import { HealthActions } from '../HealthSystem'
import { HitscanWeaponComponent } from './components/HitScanWeaponComponent'
import { SingleFireTriggerComponent } from './components/trigger/SingleFireTriggerComponent'
import { createReticle } from './functions/weaponHelper'

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

  const isSelf = props.userID === Engine.instance.userID

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
    setComponent(entity, SingleFireTriggerComponent)
    //setComponent(entity, BurstFireTriggerComponent)
    //setComponent(entity, HoldFireTriggerComponent)

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

export const shoot = () => {
  const weaponEntity = UUIDComponent.getEntityByUUID(('Weapon ' + Engine.instance.userID) as EntityUUID)
  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()!
  HitscanWeaponComponent.shoot(selfAvatarEntity, weaponEntity)
}

const swapHands = () => {
  const weaponState = getState(WeaponState)[Engine.instance.userID]
  dispatchAction(
    WeaponActions.changeWeapon({
      userID: Engine.instance.userID,
      weapon: weaponState.weapon,
      handedness: weaponState.handedness === 'left' ? 'right' : 'left'
    })
  )
}

const execute = () => {
  const viewerEntity = getState(EngineState).viewerEntity
  const weaponEntity = UUIDComponent.getEntityByUUID(('Weapon ' + Engine.instance.userID) as EntityUUID)

  const buttons = InputComponent.getMergedButtons(viewerEntity)
  if (buttons.KeyZ?.down) swapHands()
  if (buttons.KeyR?.down) HitscanWeaponComponent.reload(weaponEntity)
}

const WeaponReactor = (props: { viewerEntity: Entity }) => {
  const reticleEntity = useHookstate(() => createReticle(props.viewerEntity)).value

  useEffect(() => {
    dispatchAction(
      WeaponActions.changeWeapon({
        userID: Engine.instance.userID,
        weapon: 'pistol',
        handedness: 'right'
      })
    )
    dispatchAction(HealthActions.affectHealth({ userID: Engine.instance.userID, amount: 0 }))
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

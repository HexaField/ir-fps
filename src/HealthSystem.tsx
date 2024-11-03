import {
  AnimationSystemGroup,
  Engine,
  Entity,
  EntityUUID,
  UUIDComponent,
  createEntity,
  defineSystem,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { AvatarRigComponent } from '@ir-engine/engine/src/avatar/components/AvatarAnimationComponent'
import { respawnAvatar } from '@ir-engine/engine/src/avatar/functions/respawnAvatar'
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
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Uniform, Vector3 } from 'three'

export const HealthActions = {
  affectHealth: defineAction({
    type: 'hexafield.fps-game.HealthActions.AFFECT_HEALTH',
    userID: matchesUserID,
    amount: matches.number,
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export const HealthState = defineState({
  name: 'hexafield.fps-game.HealthState',
  initial: {} as Record<UserID, { lives: number; health: number }>,

  receptors: {
    onAffectHealth: HealthActions.affectHealth.receive((action) => {
      if (!getState(HealthState)[action.userID]) {
        getMutableState(HealthState)[action.userID].set({
          health: 100,
          lives: 5
        })
      }
      getMutableState(HealthState)[action.userID].health.set((current) => current + action.amount)
    })
  },

  reactor: () => {
    const keys = useMutableState(HealthState).keys
    return (
      <>
        {keys.map((userID: UserID) => (
          <UserHealthReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const UserHealthReactor = (props: { userID: UserID }) => {
  const userHealthState = useMutableState(HealthState)[props.userID]
  const userEntity = NetworkObjectComponent.getOwnedNetworkObjectWithComponent(props.userID, AvatarRigComponent)

  useEffect(() => {
    if (!userEntity || props.userID !== Engine.instance.store.userID) return

    if (userHealthState.health.value <= 0) {
      dispatchAction(HealthActions.affectHealth({ userID: Engine.instance.store.userID, amount: 100 }))
      respawnAvatar(userEntity)
    }
  }, [userEntity, userHealthState.health.value])

  if (!userEntity || props.userID === Engine.instance.store.userID) return null

  return <UserHealthBarUI userID={props.userID} userEntity={userEntity} />
}

const vertexShader = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = `varying vec2 vUv;
uniform float fps_health;
void main() {
  float health = fps_health * 0.01;
  if (vUv.x > health) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = vec4(1.0 - vUv.x, vUv.x, 0.0, 1.0);
  }
}`

const healthbarEntities = new Set<Entity>()

const UserHealthBarUI = (props: { userID: UserID; userEntity: Entity }) => {
  const userHealthState = useMutableState(HealthState)[props.userID]

  const avatarHealthBarEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, getComponent(props.userEntity, NameComponent) + ' Health Bar')
    setComponent(entity, UUIDComponent, (props.userID + ' Health Bar') as EntityUUID)
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: props.userEntity })
    setComponent(entity, TransformComponent, { position: new Vector3(0, 2.5, 0), scale: new Vector3(1, 0.1, 1) })
    setComponent(
      entity,
      MeshComponent,
      new Mesh(
        new PlaneGeometry(1, 1),
        new ShaderMaterial({
          uniforms: {
            fps_health: new Uniform(100)
          },
          side: DoubleSide,
          vertexShader,
          fragmentShader
        })
      )
    )

    addObjectToGroup(entity, getComponent(entity, MeshComponent))
    healthbarEntities.add(entity)

    return entity
  }).value

  useEffect(() => {
    return () => {
      healthbarEntities.delete(avatarHealthBarEntity)
      removeEntity(avatarHealthBarEntity)
    }
  }, [])

  useEffect(() => {
    const material = getComponent(avatarHealthBarEntity, MeshComponent).material as ShaderMaterial
    material.uniforms.fps_health.value = userHealthState.health.value
  }, [userHealthState.health.value])

  return null
}

const execute = () => {
  const camera = getState(EngineState).viewerEntity
  for (const entity of healthbarEntities) {
    const transform = getComponent(entity, TransformComponent)
    const cameraTransform = getComponent(camera, TransformComponent)
    transform.rotation.copy(cameraTransform.rotation)
  }
}

export const HealthBarSystem = defineSystem({
  uuid: 'hexafield.fps-game.HealthBarSystem',
  insert: { with: AnimationSystemGroup },
  execute
})

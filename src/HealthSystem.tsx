import {
  Engine,
  Entity,
  EntityTreeComponent,
  EntityUUID,
  UUIDComponent,
  createEntity,
  entityExists,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { respawnAvatar } from '@ir-engine/engine/src/avatar/functions/respawnAvatar'
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
import { NetworkTopics, matchesUserID } from '@ir-engine/network'
import { ReferenceSpaceState, TransformComponent } from '@ir-engine/spatial'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { Vector3_Up, Vector3_Zero } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { addObjectToGroup } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import React, { useEffect } from 'react'
import { DoubleSide, Matrix4, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Uniform, Vector3 } from 'three'
import { PlayerActions } from './PlayerState'

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
    }),
    onPlayerLeave: PlayerActions.playerLeft.receive((action) => {
      if (getState(HealthState)[action.userID]) {
        getMutableState(HealthState)[action.userID].set(none)
      }
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
  const userEntity = UUIDComponent.useEntityByUUID((props.userID + '_avatar') as EntityUUID)

  useEffect(() => {
    if (!userEntity || props.userID !== Engine.instance.userID) return

    if (userHealthState.health.value <= 0) {
      dispatchAction(HealthActions.affectHealth({ userID: Engine.instance.userID, amount: 100 }))
      respawnAvatar(userEntity)
    }
  }, [userEntity, userHealthState.health.value])

  if (!userEntity || props.userID === Engine.instance.userID) return null

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
  if (1.0 - vUv.x < health) {
    gl_FragColor = vec4(vUv.x, 1.0 - vUv.x, 0.0, 1.0);
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}`

const healthbarEntities = new Set<Entity>()

const _srcPosition = new Vector3()
const _dstPosition = new Vector3()
const _direction = new Vector3()
const _lookMatrix = new Matrix4()
const _lookRotation = new Quaternion()
const _quat = new Quaternion()

const UserHealthBarUI = (props: { userID: UserID; userEntity: Entity }) => {
  const userHealthState = useMutableState(HealthState)[props.userID]

  const avatarHealthBarEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, getComponent(props.userEntity, NameComponent) + ' Health Bar')
    setComponent(entity, UUIDComponent, (props.userID + ' Health Bar') as EntityUUID)
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: props.userEntity })
    setComponent(entity, TransformComponent, { position: new Vector3(0, 2.5, 0), scale: new Vector3(1, 0.025, 1) })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [props.userEntity, getState(ReferenceSpaceState).viewerEntity],
      computeFunction: () => {
        if (!entityExists(props.userEntity)) return

        const camera = getState(ReferenceSpaceState).viewerEntity
        TransformComponent.getWorldPosition(entity, _srcPosition)
        TransformComponent.getWorldPosition(camera, _dstPosition)
        _direction.subVectors(_dstPosition, _srcPosition).normalize()
        _direction.y = 0
        _lookMatrix.lookAt(Vector3_Zero, _direction, Vector3_Up)
        _lookRotation.setFromRotationMatrix(_lookMatrix)
        const transform = getComponent(entity, TransformComponent)
        const parentEntity = props.userEntity
        transform.rotation
          .copy(_lookRotation)
          .premultiply(TransformComponent.getWorldRotation(parentEntity, _quat).invert())
      }
    })

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

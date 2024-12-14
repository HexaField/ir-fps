import {
  defineComponent,
  ECSState,
  getComponent,
  getMutableComponent,
  hasComponent,
  useComponent,
  useEntityContext,
  UUIDComponent
} from '@ir-engine/ecs'
import { S } from '@ir-engine/ecs/src/schemas/JSONSchemas'
import { AvatarRigComponent } from '@ir-engine/engine/src/avatar/components/AvatarAnimationComponent'
import { dispatchAction, getState } from '@ir-engine/hyperflux'
import { NetworkObjectComponent } from '@ir-engine/network'
import { TransformComponent } from '@ir-engine/spatial'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { EngineState } from '@ir-engine/spatial/src/EngineState'
import { Physics } from '@ir-engine/spatial/src/physics/classes/Physics'
import { removeGroupComponent } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { useEffect } from 'react'
import { MathUtils, Matrix4, Vector3 } from 'three'
import { HealthActions } from '../../HealthSystem'
import { HITSCAN_RANGE, raycastComponentData } from '../constants/WeaponConstants'
import { creatDefaultWeaponModel, createHitscanDebugLine } from '../functions/weaponHelper'

const _targetCameraPosition = new Vector3()

export const HitscanWeaponComponent = defineComponent({
  name: 'HitscanWeaponComponent',
  jsonID: 'EE_FPS_hitscanWeapon',

  schema: S.Object({
    weaponModel: S.String(''),
    lifespan: S.Number(1000), //ms unused for now
    reloadTime: S.Number(5000), // ms
    clipSize: S.Number(20),
    currentAmmo: S.Number(10),
    damage: S.Number(10),
    range: S.Number(100), // in meters
    spread: S.Number(5), // in degrees
    scanSize: S.Number(0) // in degrees upto 90 for conical area scan, 0 means straight line
  }),
  shoot: (playerEntity, weaponEntity) => {
    const physicsWorld = Physics.getWorld(playerEntity)

    if (!physicsWorld) return
    const weaponParams = getComponent(weaponEntity, HitscanWeaponComponent)

    if (weaponParams.currentAmmo <= 0) {
      console.log('Out of ammo! Reload required.')
      return
    }

    const now = getState(ECSState).simulationTime
    const viewerEntity = getState(EngineState).viewerEntity
    const cameraTransform = getComponent(viewerEntity, TransformComponent)
    raycastComponentData.excludeRigidBody = playerEntity
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
    raycastComponentData.excludeRigidBody = playerEntity
    raycastComponentData.maxDistance = weaponParams.range

    let cameraRaycastHit: any = null
    let finalRange = weaponParams.range
    if (weaponParams.scanSize > 0) {
      console.log('Conical scan not implemented yet.')
    } else {
      ;[cameraRaycastHit] = Physics.castRay(physicsWorld, raycastComponentData)
    }

    if (cameraRaycastHit) {
      _targetCameraPosition.set(cameraRaycastHit.position.x, cameraRaycastHit.position.y, cameraRaycastHit.position.z)
      const hitEntity = cameraRaycastHit.entity
      const isAvatarEntity = hasComponent(hitEntity, AvatarRigComponent)
      finalRange = cameraRaycastHit.distance
      if (isAvatarEntity) {
        dispatchAction(
          HealthActions.affectHealth({
            userID: getComponent(hitEntity, NetworkObjectComponent).ownerId,
            amount: -weaponParams.damage
          })
        )
      }
    } else {
      _targetCameraPosition.copy(direction).multiplyScalar(HITSCAN_RANGE).add(raycastComponentData.origin)
    }

    const weaponPosition = getComponent(weaponEntity, TransformComponent)
      .position.clone()
      .applyQuaternion(cameraTransform.rotation)
      .add(cameraTransform.position.clone()) // Add hand offset

    createHitscanDebugLine(weaponPosition, _targetCameraPosition, finalRange)

    //hitscanEntites.push([entity, now])
    getMutableComponent(weaponEntity, HitscanWeaponComponent).currentAmmo.set((value) => value - 1)

    // Update weapon state
    // Handle reload if needed
    if (weaponParams.currentAmmo <= 0) {
      HitscanWeaponComponent.reload(weaponEntity)
    }
  },

  reload: (weaponEntity) => {
    const weaponParams = getMutableComponent(weaponEntity, HitscanWeaponComponent)

    console.log('Reloading...')
    setTimeout(() => {
      weaponParams.currentAmmo.set(weaponParams.clipSize.value)
      console.log('Reload complete.')
    }, weaponParams.reloadTime.value)
    return null
  },
  reactor: () => {
    const entity = useEntityContext()
    const weapon = useComponent(entity, HitscanWeaponComponent)
    useEffect(() => {
      if (weapon.weaponModel.value === '') {
        creatDefaultWeaponModel(entity)
      } else {
        // load the appropiate weapon model
      }

      return () => {
        removeGroupComponent(entity)
      }
    }, [])

    return null
  }
})

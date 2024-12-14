import { RaycastArgs } from '@ir-engine/spatial/src/physics/classes/Physics'
import { CollisionGroups, DefaultCollisionMask } from '@ir-engine/spatial/src/physics/enums/CollisionGroups'
import { getInteractionGroups } from '@ir-engine/spatial/src/physics/functions/getInteractionGroups'
import { SceneQueryType } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { LineBasicMaterial, Vector3 } from 'three'

export const HITSCAN_TRACKER_LIFESPAN = 3 * 1000 // 3 seconds
export const HITSCAN_RANGE = 100 // 100 meters
export const HITSCAN_TRACKER_MATERIAL = new LineBasicMaterial({ color: 'red' })

export const raycastComponentData = {
  type: SceneQueryType.Closest,
  origin: new Vector3(),
  direction: new Vector3(),
  maxDistance: HITSCAN_RANGE,
  groups: getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask)
} as RaycastArgs

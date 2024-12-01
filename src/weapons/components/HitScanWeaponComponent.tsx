import { defineComponent, setComponent, useComponent, useEntityContext } from '@ir-engine/ecs'
import { S } from '@ir-engine/ecs/src/schemas/JSONSchemas'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { addObjectToGroup, removeGroupComponent } from '@ir-engine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { useEffect } from 'react'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'

export const HitscanWeaponComponent = defineComponent({
  name: 'HitscanWeaponComponent',
  jsonID: 'EE_FPS_hitscanWeapon',

  schema: S.Object({
    weaponModel: S.String(''),
    fireRate: S.Number(200), //ms
    lifespan: S.Number(1000), //ms unused for now
    reloadTime: S.Number(5000), // ms
    clipSize: S.Number(10),
    currentAmmo: S.Number(10),
    damage: S.Number(10),
    range: S.Number(100), // in meters
    spread: S.Number(5), // in degrees
    scanSize: S.Number(0) // in degrees upto 90 for conical area scan, 0 means straight line
  }),

  reactor: () => {
    const entity = useEntityContext()
    const weapon = useComponent(entity, HitscanWeaponComponent)
    useEffect(() => {
      if (weapon.weaponModel.value === '') {
        const geometry = mergeBufferGeometries([
          new BoxGeometry(0.05, 0.05, 0.25),
          new BoxGeometry(0.025, 0.125, 0.025).translate(0, -0.125 * 0.5, 0.125)
        ])!.translate(0, 0, 0.125)
        const weaponModel = new Mesh(geometry, new MeshBasicMaterial({ color: 'grey' }))
        setComponent(entity, MeshComponent, weaponModel)
        addObjectToGroup(entity, weaponModel)
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

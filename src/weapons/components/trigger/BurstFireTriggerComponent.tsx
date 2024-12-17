import { ECSState, S, defineComponent, useComponent, useEntityContext } from '@ir-engine/ecs'
import { getState } from '@ir-engine/hyperflux'
import { InputComponent, InputExecutionOrder } from '@ir-engine/spatial/src/input/components/InputComponent'
import { useEffect } from 'react'
import { shoot } from '../../WeaponSystem'

export const BurstFireTriggerComponent = defineComponent({
  name: 'BurstFireTriggerComponent',
  jsonID: 'EE_FPS_burstfiretrigger',

  schema: S.Object({
    triggerCooldown: S.Number(500), //(ms) firerate is moved here
    burstCount: S.Number(3),
    burstRate: S.Number(20), //(ms) time within bursts , 0 means simultaneous
    triggerEnabled: S.Bool(true),
    triggerState: S.Bool(false),
    lastTriggerTime: S.Number(0)
  }),

  reactor: () => {
    const entity = useEntityContext() // weapon entity
    const trigger = useComponent(entity, BurstFireTriggerComponent)

    useEffect(() => {}, [])

    InputComponent.useExecuteWithInput(
      () => {
        const buttons = InputComponent.getMergedButtons(entity)
        if (!trigger.triggerEnabled.value) return
        const now = getState(ECSState).simulationTime
        if (trigger.lastTriggerTime.value + trigger.triggerCooldown.value > now) {
          console.log('burst fire cooling down.')
          return
        }
        if (buttons.Interact?.down) {
          trigger.triggerState.set(true)
          const burstShoot = (shotTracker) => {
            if (shotTracker >= trigger.burstCount.value) return
            // fire the weapon
            console.log('firing weapon')
            shoot()
            setTimeout(() => {
              burstShoot(shotTracker + 1)
            }, trigger.burstRate.value)
          }

          // fire the the weapon as per burst count
          if (trigger.burstCount.value > 0) {
            burstShoot(0)
          } else {
            for (let i = 0; i < trigger.burstCount.value; i++) {
              // fire shots simultaneously
            }
          }
        } // we can also use callback here
        if (buttons.Interact?.up) {
          trigger.triggerState.set(false)
          trigger.lastTriggerTime.set(now)
        }
      },
      true,
      InputExecutionOrder.After
    )

    return null
  }
})

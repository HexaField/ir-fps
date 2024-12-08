import { ECSState, S, defineComponent, useComponent, useEntityContext } from '@ir-engine/ecs'
import { getState } from '@ir-engine/hyperflux'
import { InputComponent, InputExecutionOrder } from '@ir-engine/spatial/src/input/components/InputComponent'
import { useEffect } from 'react'
import { shoot } from '../../WeaponSystem'

export const HoldFireTriggerComponent = defineComponent({
  name: 'HoldFireTriggerComponent',
  jsonID: 'EE_FPS_holdfiretrigger',

  // no trigger cooldown for hold fire, only over heat
  schema: S.Object({
    overheatLimit: S.Number(2000), //(ms) for possible overheat mechanic
    overheatCooldown: S.Number(1000), //(ms) for possible overheat mechanic
    overheatState: S.Bool(false),
    triggerEnabled: S.Bool(true),
    triggerState: S.Bool(false),
    triggerColdown: S.Number(300), // (ms) firerate
    lastTriggerTime: S.Number(0),
    lastOverheatTime: S.Number(0)
  }),

  reactor: () => {
    const entity = useEntityContext() // weapon entity
    const trigger = useComponent(entity, HoldFireTriggerComponent)

    useEffect(() => {}, [])

    InputComponent.useExecuteWithInput(
      () => {
        const buttons = InputComponent.getMergedButtons(entity)
        const now = getState(ECSState).simulationTime

        if (!trigger.triggerEnabled.value) return
        if (buttons.Interact?.down) {
          trigger.lastOverheatTime.set(now)
          trigger.lastTriggerTime.set(now)
        }
        if (buttons.Interact?.pressed) {
          if (trigger.overheatState.value) {
            console.log('weapon cooling down')
            if (now - trigger.lastOverheatTime.value > trigger.overheatCooldown.value) {
              trigger.overheatState.set(false)
              console.log('weapon cooled down')
            }
            return
          }
          if (now - trigger.lastOverheatTime.value > trigger.overheatLimit.value) {
            trigger.overheatState.set(true)
            trigger.triggerState.set(false)
            console.log('weapon overheated, cooling down')
            trigger.lastOverheatTime.set(now)
            return
          }
          trigger.triggerState.set(true)
          // fire the weapon as per the trigger cooldown
          if (now - trigger.lastTriggerTime.value > trigger.triggerColdown.value) {
            console.log('firing weapon')
            shoot()
            trigger.lastTriggerTime.set(now)
          }
          if (buttons.Interact?.up) {
            trigger.triggerState.set(false)
          }
        }
      },
      true,
      InputExecutionOrder.After
    )

    return null
  }
})

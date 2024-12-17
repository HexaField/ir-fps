import { ECSState, S, defineComponent, useComponent, useEntityContext } from '@ir-engine/ecs'
import { getState } from '@ir-engine/hyperflux'
import { InputComponent, InputExecutionOrder } from '@ir-engine/spatial/src/input/components/InputComponent'
import { useEffect } from 'react'
import { shoot } from '../../WeaponSystem'

export const SingleFireTriggerComponent = defineComponent({
  name: 'SingleFireTriggerComponent',
  jsonID: 'EE_FPS_singlefiretrigger',

  schema: S.Object({
    triggerCooldown: S.Number(200), // (ms)
    triggerEnabled: S.Bool(true),
    triggerState: S.Bool(false),
    lastTriggerTime: S.Number(0)
  }),

  reactor: () => {
    const entity = useEntityContext() // weapon entity
    const trigger = useComponent(entity, SingleFireTriggerComponent)

    useEffect(() => {}, [])

    InputComponent.useExecuteWithInput(
      () => {
        const buttons = InputComponent.getMergedButtons(entity)
        if (!trigger.triggerEnabled.value) return
        const now = getState(ECSState).simulationTime
        if (trigger.lastTriggerTime.value + trigger.triggerCooldown.value > now) {
          console.log('single fire cooling down.')
          return
        }
        if (buttons.Interact?.down) {
          trigger.triggerState.set(true)
          // fire the weapon
          shoot()
          console.log('firing weapon')
        }
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

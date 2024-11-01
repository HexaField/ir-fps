import {
  UserID,
  defineAction,
  defineState,
  getMutableState,
  getState,
  matches,
  useMutableState
} from '@ir-engine/hyperflux'
import { matchesUserID } from '@ir-engine/network'
import React from 'react'

export const HealthActions = {
  affectHealth: defineAction({
    type: 'hexafield.fps-game.HealthActions.AFFECT_HEALTH',
    userID: matchesUserID,
    amount: matches.number
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
  return null
}

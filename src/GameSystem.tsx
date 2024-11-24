import { PresentationSystemGroup, defineSystem } from '@ir-engine/ecs'
import { UserID, dispatchAction, useMutableState } from '@ir-engine/hyperflux'
import { WorldUserState } from '@ir-engine/network/src/NetworkPeerState'
import React, { useEffect } from 'react'
import { PlayerActions } from './PlayerState'

export const GameSystem = defineSystem({
  uuid: 'hexafield.fps-game.GameSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    /** @todo this will be replaced with some lobby/game active logic */
    const users = useMutableState(WorldUserState).keys

    return (
      <>
        {users.map((userID: UserID) => (
          <ConnectedUserReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const ConnectedUserReactor = (props: { userID: UserID }) => {
  useEffect(() => {
    dispatchAction(
      PlayerActions.playerJoined({
        userID: props.userID
      })
    )
    return () => {
      dispatchAction(
        PlayerActions.playerLeft({
          userID: props.userID
        })
      )
    }
  }, [])

  return null
}

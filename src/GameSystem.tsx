import { PresentationSystemGroup, defineSystem } from '@ir-engine/ecs'
import { NetworkID, UserID, dispatchAction, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { NetworkState } from '@ir-engine/network'
import { NetworkPeerState } from '@ir-engine/network/src/NetworkPeerState'
import React, { useEffect } from 'react'
import { PlayerActions } from './PlayerState'

export const GameSystem = defineSystem({
  uuid: 'hexafield.fps-game.GameSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    const networkState = useHookstate(NetworkState.worldNetworkState)
    if (!networkState) return null

    return <GameNetworkReactor networkID={networkState.value.id} />
  }
})

const GameNetworkReactor = (props: { networkID: NetworkID }) => {
  const users = useMutableState(NetworkPeerState)[props.networkID].users.keys

  return (
    <>
      {users.map((userID: UserID) => (
        <ConnectedUserReactor key={userID} networkID={props.networkID} userID={userID} />
      ))}
    </>
  )
}

const ConnectedUserReactor = (props: { networkID: NetworkID; userID: UserID }) => {
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

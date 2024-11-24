import { defineAction } from '@ir-engine/hyperflux'
import { matchesUserID } from '@ir-engine/network'

export class PlayerActions {
  static playerJoined = defineAction({
    type: 'hexafield.fps-game.PlayerActions.PLAYER_JOINED',
    userID: matchesUserID
  })

  static playerLeft = defineAction({
    type: 'hexafield.fps-game.PlayerActions.PLAYER_LEFT',
    userID: matchesUserID
  })
}

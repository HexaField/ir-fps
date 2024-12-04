/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/ir-engine/ir-engine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Infinite Reality Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Infinite Reality Engine team.

All portions of the code written by the Infinite Reality Engine team are Copyright © 2021-2023 
Infinite Reality Engine. All Rights Reserved.
*/

import '@ir-engine/client/src/engine'

import React, { useRef } from 'react'

import '@ir-engine/client-core/src/world/LocationModule'
import './FPSGame'

import { useNetwork } from '@ir-engine/client-core/src/components/World/EngineHooks'
import { useLoadLocation } from '@ir-engine/client-core/src/components/World/LoadLocationScene'
import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'

import { useFind } from '@ir-engine/common'
import { locationPath } from '@ir-engine/common/src/schema.type.module'
import { useHookstate } from '@ir-engine/hyperflux'
import Button from '@ir-engine/ui/src/primitives/tailwind/Button'

const Selectedlocation = (props: { selectedLocation: string }) => {
  const ref = useRef<HTMLElement>(document.body)

  useSpatialEngine()
  useEngineCanvas(ref)
  useNetwork({ online: true })
  useLoadLocation({ locationName: props.selectedLocation })

  return <></>
}

// simple lobby, just list all locations
const GameRoute = () => {
  const selectedLocation = useHookstate('')

  const locations = useFind(locationPath)

  if (selectedLocation.value) return <Selectedlocation selectedLocation={selectedLocation.value} />

  return (
    <div className="pointer-events-auto flex flex-col space-y-4">
      <div className="text-center text-2xl font-bold">Select a location</div>
      <div className="mx-auto flex w-fit flex-col space-y-2">
        {locations.data.map((location) => (
          <Button key={location.id} onClick={() => selectedLocation.set(location.slugifiedName)}>
            {location.slugifiedName}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default GameRoute

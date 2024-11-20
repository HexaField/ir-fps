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

import React, { useEffect, useRef } from 'react'

import { useLoadLocation } from '@ir-engine/client-core/src/components/World/LoadLocationScene'
import { useMutableState } from '@ir-engine/hyperflux'

import '@ir-engine/client-core/src/util/GlobalStyle.css'

import '@ir-engine/client-core/src/world/LocationModule'

import { useLoadEngineWithScene, useNetwork } from '@ir-engine/client-core/src/components/World/EngineHooks'
import { useEngineCanvas } from '@ir-engine/client-core/src/hooks/useEngineCanvas'
import { LoadingUISystemState } from '@ir-engine/client-core/src/systems/LoadingUISystem'
import { destroySpatialEngine, initializeSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import LoadingView from '@ir-engine/ui/src/primitives/tailwind/LoadingView'
import { useTranslation } from 'react-i18next'

import './FPSGame'

const GameRoute = () => {
  const ref = useRef<HTMLElement>(document.body)

  useEffect(() => {
    initializeSpatialEngine()
    return () => {
      destroySpatialEngine()
    }
  }, [])

  useEngineCanvas(ref)

  const { t } = useTranslation()
  const ready = useMutableState(LoadingUISystemState).ready

  useNetwork({ online: true })
  useLoadLocation({ locationName: 'default' })
  useLoadEngineWithScene()

  return (
    <>
      {!ready.value && <LoadingView fullScreen className="block h-12 w-12" title={t('common:loader.loadingEngine')} />}
    </>
  )
}

export default GameRoute

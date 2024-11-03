import { ProjectEventHooks } from '@ir-engine/projects/ProjectConfigInterface'
import { Application } from '@ir-engine/server-core/declarations'
import manifestJson from '../manifest.json'

const config = {
  onInstall: async (app: Application) => {
    await app.service('route-activate').create({ project: manifestJson.name, route: '/fps', activate: true })
  }
} as ProjectEventHooks

export default config

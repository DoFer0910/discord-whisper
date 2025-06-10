import { InteractionManager } from 'discord-interaction-binder'

import { ModuleManager } from '@/utils/ModuleManager'

declare module 'discord.js' {
  interface Client {
    interactions: InteractionManager
    modules: ModuleManager
  }
}

declare module 'discord-interaction-binder' {
  interface BaseInteraction {
    client: Client
  }
}

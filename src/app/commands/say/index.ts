import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js'
import { ApplicationCommandData, createModalBuilder } from 'mopo-discordjs'

import SayCommandModal from '@/app/commands/say/components/SayCommandModal'

export default {
  name: 'say',
  description: 'パイモンで発言',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      type: ApplicationCommandOptionType.Attachment,
      name: 'file',
      description: '添付出来るのは1ファイルのみです。',
    },
  ],
  execute: async (interaction): Promise<void> => {
    await interaction.showModal(createModalBuilder(SayCommandModal))
  },
} as const satisfies ApplicationCommandData

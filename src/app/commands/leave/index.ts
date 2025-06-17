import { getVoiceConnection } from '@discordjs/voice'
import { PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { ApplicationCommandData } from 'mopo-discordjs'

import Transcription from '@/app/modules/transcription'

export default {
  name: 'leave',
  description: '動作テスト用',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  execute: async (
    interaction: ChatInputCommandInteraction,
    module,
  ): Promise<void> => {
    await interaction.deferReply({
      ephemeral: true,
    })
    if (!interaction.guild) {
      await interaction.editReply({
        content: 'このコマンドはサーバー内でのみ使用できます。',
      })
      return
    }

    if (module.getGuildInProgress(interaction.guild.id)) {
      await interaction.editReply({
        content: '現在、別の処理が実行中です。しばらくお待ちください。',
      })
      return
    }

    const member = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => undefined)
    if (!member) {
      await interaction.editReply({
        content: 'メンバー情報を取得できませんでした。',
      })
      return
    }

    if (!member.voice.channel) {
      await interaction.editReply({
        content: '貴方はボイスチャンネルに参加していません。',
      })
      return
    }

    const connection = getVoiceConnection(interaction.guild.id)
    if (!connection) {
      await interaction.editReply({
        content: 'ボイスチャンネルに接続していません。',
      })
      return
    }
    connection.destroy()
    await interaction.editReply({
      content: 'ボイスチャンネルから切断しました。',
    })
  },
} as const satisfies ApplicationCommandData<Transcription>

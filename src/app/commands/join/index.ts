import {
  DiscordGatewayAdapterCreator,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice'
import { PermissionFlagsBits } from 'discord.js'
import { ChatInputCommandInteraction } from 'discord.js'
import { ApplicationCommandData } from 'mopo-discordjs'

import Transcription from '@/app/modules/transcription'

export default {
  name: 'join',
  description: '動作テスト用',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  execute: async (
    interaction: ChatInputCommandInteraction,
    module,
  ): Promise<void> => {
    await interaction.deferReply({
      ephemeral: true,
    })
    if (module.inProgress) {
      await interaction.editReply({
        content: '現在、別の処理が実行中です。しばらくお待ちください。',
      })
      return
    }

    if (!interaction.guild) {
      await interaction.editReply({
        content: 'このコマンドはサーバー内でのみ使用できます。',
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

    if (getVoiceConnection(interaction.guild.id)) {
      await interaction.editReply({
        content: 'すでにボイスチャンネルに接続しています。',
      })
      return
    }

    if (!member.voice.channel) {
      await interaction.editReply({
        content: '貴方はボイスチャンネルに参加していません。',
      })
      return
    }

    const connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild
        .voiceAdapterCreator as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: true,
      debug: true,
    })
    module.start(connection, {
      sendRealtimeMessage: true,
      exportReport: true,
    })

    await interaction.editReply({
      content: `ボイスチャンネル<#${member.voice.channel.id}>に参加しました。`,
    })
  },
} as const satisfies ApplicationCommandData<Transcription>

import { TextInputStyle } from 'discord.js'
import { ComponentData, ComponentType } from 'mopo-discordjs'

import SayCommand from '@/app/commands/say'
import SayCommandModal from '@/app/commands/say/components/SayCommandModal'

export default {
  type: ComponentType.Modal,
  customId: 'command-sayCommandModal',
  title: 'SAYコマンド',
  components: [
    {
      customId: 'InputMessage',
      label: 'メッセージ内容',
      style: TextInputStyle.Paragraph,
      minLength: 1,
      placeholder: 'ここに入力された内容が発言されます。',
    },
  ],
  execute: async (interaction, parent): Promise<void> => {
    await interaction.deferReply({ ephemeral: true })
    if (!interaction.channel) return
    if (interaction.channel.isDMBased()) return
    if (!parent?.isChatInputCommand()) return

    const attachment = parent.options.getAttachment(SayCommand.options[0].name)
    const content = interaction.fields.getTextInputValue(
      SayCommandModal.components[0].customId,
    )
    await interaction.channel.send({
      content: content,
      files: attachment ? [attachment] : [],
    })
    await interaction.editReply({
      content: 'Success!!',
    })
  },
} as const satisfies ComponentData

import {
  AudioReceiveStream,
  EndBehaviorType,
  entersState,
  getVoiceConnection,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import crypto from 'crypto'
import { AttachmentBuilder, Channel, VoiceState, Webhook } from 'discord.js'
import fs from 'fs'
import { BaseModule } from 'mopo-discordjs'
import { IOptions, nodewhisper } from 'nodejs-whisper'
import path from 'path'
import prism from 'prism-media'
import shell from 'shelljs'
import { pipeline } from 'stream/promises'

import { ModelName } from '@/types/ModelName'
export interface TranscriptionOption {
  sendRealtimeMessage: boolean
  exportReport: boolean
  // exportAudio: boolean //TODO: Implemented in the future
}

export default class Transcription extends BaseModule {
  private static readonly TEMP_DIR = path.resolve(
    __dirname, // transcription
    '../', // modules
    '../', // app
    '../', // src
    '../', // project root
    'temp',
  )
  private static readonly whisperOptions: IOptions = {
    modelName: ModelName.LARGE_V3_TURBO,
    autoDownloadModelName: ModelName.LARGE_V3_TURBO,
    removeWavFileAfterTranscription: true,
    withCuda: true,
    logger: console,
    whisperOptions: {
      outputInCsv: false,
      outputInJson: false,
      outputInJsonFull: false,
      outputInLrc: false,
      outputInSrt: false,
      outputInText: false,
      outputInVtt: false,
      outputInWords: false,
      translateToEnglish: false,
      language: 'ja',
      wordTimestamps: false,
      timestamps_length: 0,
      splitOnWord: true,
    },
  }

  private queue: {
    uuid: string
    userId: string
    sendChannelId: string
  }[] = []
  private isQueueProcessing = false
  private nowOption: TranscriptionOption = {
    sendRealtimeMessage: true,
    exportReport: true,
  }

  private report = ''

  public get inProgress(): boolean {
    return this.isQueueProcessing || this.queue.length > 0
  }

  public init(): void {
    this.client.on(
      'voiceStateUpdate',
      (oldState: VoiceState, newState: VoiceState): void => {
        void (async (): Promise<void> => {
          const connection = getVoiceConnection(newState.guild.id)
          if (!connection?.joinConfig.channelId) return
          if (oldState.channelId !== connection.joinConfig.channelId) return

          const channel = await newState.guild.channels.fetch(
            connection.joinConfig.channelId,
          )
          if (!channel?.isVoiceBased()) return

          const unBotMembers = channel.members.filter(
            (member) => !member.user.bot,
          )
          if (unBotMembers.size === 0) {
            connection.destroy()
            return
          }
        })()
      },
    )
  }

  public start(connection: VoiceConnection, option: TranscriptionOption): void {
    this.nowOption = option
    connection.receiver.speaking.on('start', (userId) => {
      void (async (): Promise<void> => {
        if (!connection.joinConfig.channelId) {
          console.warn(
            '[discord-whisper]No channel ID found in connection join config',
          )
          return
        }
        console.log(`[discord-whisper]User ${userId} started speaking`)
        const uuid = crypto.randomUUID()

        const opusStream = connection.receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 100,
          },
        })

        await this.encodeOpusToPcm(uuid, opusStream)
        if (this.isValidVoiceData(uuid)) {
          this.queue.push({
            uuid: uuid,
            userId: userId,
            sendChannelId: connection.joinConfig.channelId,
          })
          await this.encodePcmToWav(uuid)
          if (!this.isQueueProcessing) await this.progressQueue()
        }
        fs.unlinkSync(path.join(Transcription.TEMP_DIR, `${uuid}.pcm`))

        opusStream.on('end', () => {
          console.log(`[discord-whisper]Stream from user ${userId} has ended`)
          opusStream.destroy()
        })
      })()
    })

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(
        '[discord-whisper]The connection has entered the Ready state - ready to play audio!',
      )
    })

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      void (async (): Promise<void> => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ])
        } catch {
          connection.destroy()
        }
      })()
    })

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log('[discord-whisper]The connection has been destroyed')
      const interval = setInterval(() => {
        void (async (): Promise<void> => {
          if (this.queue.length === 0) {
            clearInterval(interval)
            if (
              connection.joinConfig.channelId &&
              this.nowOption.exportReport
            ) {
              fs.writeFileSync(
                path.join(Transcription.TEMP_DIR, 'report.txt'),
                this.report,
              )
              const channel = await this.client.channels.fetch(
                connection.joinConfig.channelId,
              )
              const attachment = new AttachmentBuilder(
                path.join(Transcription.TEMP_DIR, 'report.txt'),
              )
              if (channel?.isVoiceBased()) {
                await channel.send({
                  content: '今回のレポート:',
                  files: [attachment],
                })
              }
            }
            console.log('[discord-whisper]Queue is empty, stopping interval')
            fs.readdir(Transcription.TEMP_DIR, (err, files) => {
              if (err) {
                console.error(
                  '[discord-whisper]Error reading temp directory:',
                  err,
                )
                return
              }
              files.forEach((file) => {
                if (
                  file.endsWith('.wav') ||
                  file.endsWith('.pcm') ||
                  file.endsWith('.txt')
                ) {
                  fs.unlinkSync(path.join(Transcription.TEMP_DIR, file))
                  console.log(`[discord-whisper]Deleted temp file: ${file}`)
                }
              })
            })
            this.report = ''
            return
          }
        })()
      }, 1000)
    })
  }

  private async encodeOpusToPcm(
    uuid: string,
    opusStream: AudioReceiveStream,
  ): Promise<void> {
    const opusDecoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    })

    const out = fs.createWriteStream(
      path.join(Transcription.TEMP_DIR, `${uuid}.pcm`),
    )
    await pipeline(
      opusStream as unknown as NodeJS.ReadableStream,
      opusDecoder as unknown as NodeJS.WritableStream,
      out as unknown as NodeJS.WritableStream,
    )
  }

  private async encodePcmToWav(uuid: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      console.log(`[discord-whisper]Encoding PCM to WAV for UUID: ${uuid}`)
      const pcmFilePath = path.join(Transcription.TEMP_DIR, `${uuid}.pcm`)
      const wavFilePath = path.join(Transcription.TEMP_DIR, `${uuid}.wav`)

      const command = `ffmpeg -f s16le -ar 48k -ac 2 -i "${pcmFilePath}" "${wavFilePath}"`
      const result = shell.exec(command)
      if (result.code !== 0)
        reject(new Error(`Failed to encode PCM to WAV: ${result.stderr}`))
      resolve()
    })
  }

  private async transcribeAudio(uuid: string): Promise<string | undefined> {
    console.log(`[discord-whisper]Transcribing audio for UUID: ${uuid}`)
    const wavFilePath = path.join(Transcription.TEMP_DIR, `${uuid}.wav`)
    if (!fs.existsSync(wavFilePath)) {
      console.error(`[discord-whisper]WAV file not found: ${wavFilePath}`)
      return
    }
    const context = await nodewhisper(
      wavFilePath,
      Transcription.whisperOptions,
    ).catch((error: unknown) => {
      console.error(
        `[discord-whisper]Error during transcription for UUID ${uuid}:`,
        error,
      )
      return ''
    })

    const cleanedContext = context.replace(/(?=\[).*?(?<=\])\s\s/g, '')

    if (!this.isValidJapaneseTranscription(cleanedContext)) {
      console.warn(
        `[discord-whisper]Transcription failed Japanese validation: "${cleanedContext}"`,
      )
      return undefined
    }

    return cleanedContext
  }

  private async fetchWebhook(channel: Channel): Promise<Webhook | undefined> {
    if (!channel.isVoiceBased()) return
    const webhooks = await channel.fetchWebhooks()
    return (
      webhooks.find((v) => v.token) ??
      (await channel.createWebhook({
        name: this.client.user?.username ?? 'Transcription Bot',
      }))
    )
  }

  private async sendWebhookMessage(
    webhook: Webhook,
    userId: string,
    message: string,
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId)
      const guild = await this.client.guilds.fetch(webhook.guildId)
      const member = await guild.members.fetch(userId).catch(() => undefined)

      const webhookOption = {
        username: member?.displayName ?? user.displayName,
        avatarURL: member?.displayAvatarURL() ?? user.displayAvatarURL(),
      }

      await webhook.send({
        ...webhookOption,
        content: message,
      })
      console.log('[discord-whisper]Webhook message sent successfully')
    } catch (error) {
      console.error('[discord-whisper]Error sending webhook message:', error)
    }
  }

  private async progressQueue(): Promise<void> {
    this.isQueueProcessing = true
    const completedItem = this.queue.shift()
    if (completedItem) {
      const context = await this.transcribeAudio(completedItem.uuid)
      if (context) {
        if (completedItem.sendChannelId && this.nowOption.sendRealtimeMessage) {
          const channel = await this.client.channels.fetch(
            completedItem.sendChannelId,
          )
          if (channel?.isVoiceBased()) {
            const webhook = await this.fetchWebhook(channel)
            if (webhook) {
              await this.sendWebhookMessage(
                webhook,
                completedItem.userId,
                context,
              )
            }
          }
        }
        if (this.nowOption.exportReport) {
          const user = await this.client.users.fetch(completedItem.userId)
          this.report += `User: ${user.displayName}(ID:${completedItem.userId})\n`
          this.report += `Transcription: ${context}\n\n`
        }
      }
    }
    if (this.queue.length > 0) void this.progressQueue()
    else this.isQueueProcessing = false
  }

  private isValidVoiceData(uuid: string): boolean {
    const pcmFilePath = path.join(Transcription.TEMP_DIR, `${uuid}.pcm`)
    if (!fs.existsSync(pcmFilePath)) {
      console.warn(`[discord-whisper]PCM file not found: ${pcmFilePath}`)
      return false
    }

    const stats = fs.statSync(pcmFilePath)
    const fileSizeInBytes = stats.size
    const durationInSeconds = fileSizeInBytes / (48000 * 2 * 2) // 48kHz, 2 channels, 2 bytes per sample

    if (durationInSeconds < 0.5) {
      console.warn(
        `[discord-whisper]PCM file too short: ${pcmFilePath} (${durationInSeconds.toString()}s)`,
      )
      return false
    }

    if (durationInSeconds > 30) {
      console.warn(
        `[discord-whisper]PCM file too long: ${pcmFilePath} (${durationInSeconds.toString()}s)`,
      )
      return false
    }

    if (!this.hasValidAudioLevel(pcmFilePath)) {
      console.warn(
        `[discord-whisper]PCM file has insufficient audio level: ${pcmFilePath}`,
      )
      return false
    }

    if (!this.detectVoiceActivity(pcmFilePath, durationInSeconds)) {
      console.warn(
        `[discord-whisper]No voice activity detected: ${pcmFilePath}`,
      )
      return false
    }

    console.log(
      `[discord-whisper]PCM file is valid: ${pcmFilePath} (${durationInSeconds.toString()}s)`,
    )
    return true
  }

  private hasValidAudioLevel(pcmFilePath: string): boolean {
    try {
      const pcmData = fs.readFileSync(pcmFilePath)
      let sumSquared = 0
      let maxAmplitude = 0
      const sampleCount = pcmData.length / 2 // 16-bit samples

      // Reads PCM data as 16-bit samples and calculates RMS
      for (let i = 0; i < pcmData.length; i += 2) {
        const sample = pcmData.readInt16LE(i)
        const amplitude = Math.abs(sample)
        sumSquared += sample * sample
        maxAmplitude = Math.max(maxAmplitude, amplitude)
      }

      const rms = Math.sqrt(sumSquared / sampleCount)
      const rmsDb = 20 * Math.log10(rms / 32767) // dB calculation based on 16-bit max

      // Volume threshold: above -40dB, max amplitude above 1000
      const hasValidRms = rmsDb > -40
      const hasValidPeak = maxAmplitude > 1000

      console.log(
        `[discord-whisper]Audio level check - RMS: ${rmsDb.toFixed(2)}dB, Peak: ${maxAmplitude.toString()}, Valid: ${String(hasValidRms && hasValidPeak)}`,
      )

      return hasValidRms && hasValidPeak
    } catch (error) {
      console.error('[discord-whisper]Error analyzing audio level:', error)
      return false
    }
  }

  private detectVoiceActivity(
    pcmFilePath: string,
    durationInSeconds: number,
  ): boolean {
    try {
      const pcmData = fs.readFileSync(pcmFilePath)
      const sampleRate = 48000
      const channels = 2
      const frameSize = Math.floor(sampleRate * 0.025) * channels * 2 // 25ms frames
      const frameCount = Math.floor(pcmData.length / frameSize)

      let voiceFrames = 0
      const energyThreshold = 1000000 // Energy threshold

      // Future expansion: dynamic threshold adjustment using durationInSeconds is possible
      // Currently using fixed threshold
      const adaptiveThreshold =
        durationInSeconds > 2 ? energyThreshold * 0.8 : energyThreshold

      for (let frame = 0; frame < frameCount; frame++) {
        const frameStart = frame * frameSize
        const frameEnd = Math.min(frameStart + frameSize, pcmData.length)
        let frameEnergy = 0

        for (let i = frameStart; i < frameEnd; i += 2) {
          const sample = pcmData.readInt16LE(i)
          frameEnergy += sample * sample
        }

        if (frameEnergy > adaptiveThreshold) voiceFrames++
      }

      const voiceRatio = voiceFrames / frameCount
      const minVoiceRatio = 0.1 // Audio must be detected in at least 10% of frames

      console.log(
        `[discord-whisper]VAD analysis - Voice frames: ${voiceFrames.toString()}/${frameCount.toString()} (${(voiceRatio * 100).toFixed(1)}%), Valid: ${String(voiceRatio >= minVoiceRatio)}`,
      )

      return voiceRatio >= minVoiceRatio
    } catch (error) {
      console.error(
        '[discord-whisper]Error in voice activity detection:',
        error,
      )
      return false
    }
  }

  private isValidJapaneseTranscription(text: string): boolean {
    if (!text || text.trim().length === 0) return false

    const trimmedText = text.trim()

    if (trimmedText.length < 2) return false

    if (trimmedText.length > 200) {
      console.warn(
        `[discord-whisper]Transcription too long (${trimmedText.length.toString()} chars)`,
      )
      return false
    }

    const commonFalsePositives = [
      'ありがとうございました',
      'お疲れ様でした',
      'そうですね',
      'はい',
      'いえ',
      'うん',
      'そう',
      '...',
      '。。。',
      'えーと',
      'あのー',
      'まあ',
      'ちょっと',
      'Thank you',
      'thank you',
    ]

    if (trimmedText.length <= 10) {
      const isCommonFalsePositive = commonFalsePositives.some((pattern) =>
        trimmedText.includes(pattern),
      )
      if (isCommonFalsePositive) {
        console.warn(
          `[discord-whisper]Filtered common false positive: "${trimmedText}"`,
        )
        return false
      }
    }

    const japaneseCharRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
    const hasJapaneseChars = japaneseCharRegex.test(trimmedText)

    const englishOnlyRegex = /^[a-zA-Z\s.,!?]+$/
    const isEnglishOnly = englishOnlyRegex.test(trimmedText)

    if (isEnglishOnly) {
      console.warn(
        `[discord-whisper]Filtered English-only transcription: "${trimmedText}"`,
      )
      return false
    }

    const symbolOnlyRegex = /^[.,!?。、！？\s\-_]+$/
    const isSymbolOnly = symbolOnlyRegex.test(trimmedText)

    if (isSymbolOnly) {
      console.warn(
        `[discord-whisper]Filtered symbol-only transcription: "${trimmedText}"`,
      )
      return false
    }

    if (!hasJapaneseChars) {
      console.warn(
        `[discord-whisper]No Japanese characters found: "${trimmedText}"`,
      )
      return false
    }

    console.log(
      `[discord-whisper]Valid Japanese transcription: "${trimmedText}"`,
    )
    return true
  }
}

## What is This?
OpenAI-WhisperをつかってDiscordの音声通話の文字起こしをするBot
> [!INFO]
> VADやノイズ除去の事前処理がまだ足りない節があります。

## How to Use?
#### Env
```
BOT_TOKEN=
GUILD_ID=
```

#### Install
```
npm install
npx nodejs-whisper download
```
> [!INFO]
> nodejs-whisperにWhisper部分の動作は依存しています。
> 該当ライブラリのインストール手順を参照ください。

#### Run
```
npm run start
```



## What is This?
OpenAI-WhisperをつかってDiscordの音声通話の文字起こしをするBot<br>
日本語のみに対応しています。
> [!NOTE]
> - ~~VADやノイズ除去の事前処理がまだ足りない節があります。~~
> - 環境変数からわかるように、現行では1サーバー1プロセスです。ちょっとイジれば複数対応はできます。

#### Features
- /join --- ボイスチャットに参加させるコマンド
- /leave --- ボイスチャットから退室させるコマンド
- ボイスチャットが0人になると自動退室する機能
- Teamsのように、誰がったかわかりやすい表示方法(WebHook)
  - 気が向いたらONOFFできるように
- 退室時のレポート機能
  - 気が向いたらONOFFできるように

## How to Use?
#### Env
```
BOT_TOKEN=your_discord_bot_token
```

#### Install

```bash
npm install
npx nodejs-whisper download
```

> [!NOTE]
> nodejs-whisperにWhisper部分の動作は依存しています。
> 該当ライブラリのインストール手順を参照ください。

#### Run

```bash
npm run start
```



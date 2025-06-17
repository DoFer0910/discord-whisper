## What is This?
OpenAI-WhisperをつかってDiscordの音声通話の文字起こしをするBot<br>
日本語のみに対応しています。
> [!NOTE]
> - ~~VADやノイズ除去の事前処理がまだ足りない節があります。~~
> - 環境変数からわかるように、現行では1サーバー1プロセスです。ちょっとイジれば複数対応はできます。

#### Features
- ボイスチャットが0人になると自動退室する機能
- Teamsのように、誰が話したかわかりやすい表示方法(WebHook)
- 退室時のレポート機能

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

#### Commands

- `/join [realtime:boolean] [report:boolean]`
  - ボイスチャンネルに参加して音声転写を開始
  - `realtime`: リアルタイムメッセージ送信を有効/無効 (デフォルト: true)
  - `report`: 退室時のレポート出力を有効/無効 (デフォルト: true)
- `/leave`
  - ボイスチャンネルから退室

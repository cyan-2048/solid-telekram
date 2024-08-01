# Telegram4KaiOS

Telegram client for KaiOS.

HELP!!! I need a better name for this client. (TeleKram is taken)

## Features

- [ ] Chats
  - [ ] Chat Info
  - [ ] User Info
  - [x] Private Chats
  - [x] Private Groups
  - [ ] Supergroup
    - [ ] migrated chats
    - [ ] Forum Topics
  - [x] Broadcast Channels
  - [ ] Bots
  - [ ] Gigagroups
- [ ] Messages
  - [ ] Push Notifications
  - [ ] Telegram System Messages (not complete)
  - [ ] Message Attachments
    - [ ] Uploading Files
    - [ ] Stickers
      - [ ] Sticker Picker
      - [x] webp
      - [x] webm
      - [ ] lottie
    - [ ] Emojis
      - [x] Emoji Picker
      - [x] Apple Emojis
      - [ ] Emoji history
    - [ ] Photos
    - [ ] Voice Messages
  - [x] Replying
  - [x] Editing
  - [x] Deleting
  - [ ] Forwarding
- [ ] Login
  - [ ] SMS Code
  - [x] Telegram Send Code
  - [x] 2FA
  - [ ] Email
- [ ] Telegram Stories

## Additional Info

- Currently Forum Groups will act as "View as Messages" as in the Telegram Web K client.
- pre-optimized stickers are stickers converted from lottie to apng so client side rendering is not an issue, those stickers can be found in [kaigram-assets](https://github.com/cyan-2048/kaigram-assets)
-

## Developing

Dev Mode:

```
bun run dev
```

Build:

```
bun run build
```

add the `:v3` prefix for KaiOS 3.0 (example: `bun run dev:v3`)

## Technical Info

- For KaiOS 2.5, the app utilizes _real_ asm.js on KaiOS 3.0 it uses WebAssembly like normal.
- mtcute is modified to use big-integer, this means it is BigInt can be used in KaiOS 2.5 and native BigInts are used for KaiOS 3.0.
- mtcute is also modified in order for asm.js to be used.
- there are 3 Web Workers
  - 1. mtcute web worker proxy
  - 2. heavy tasks worker for blocking operations
  - 3. (not yet implemented) rlottie

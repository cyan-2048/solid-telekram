<p>
  <img width="100%" src="https://assets.solidjs.com/banner?project=Telegram4KaiOS" alt="Solid Docs">
</p>

# Telegram4KaiOS

### HELP!!! I need a better name for this client. (TeleKram is taken)

Telegram client for KaiOS.

## Features

- [ ] Chats
  - [x] Pinned Chats
  - [ ] Archived Chats
  - [x] Unread/Muted/Sent/Received
  - [ ] Chat Folders
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
  - [ ] Telegram System Actions (not complete)
  - [ ] Message Attachments
    - [ ] Uploading Files
    - [ ] Stickers
      - [ ] Sticker Picker
      - [x] webp
      - [x] webm
      - [ ] lottie (partial support)
    - [ ] Emojis
      - [x] Emoji Picker
      - [x] Apple Emojis
      - [ ] Emoji history
    - [ ] Gifs
      - [ ] Gif Picker
    - [ ] Photos
    - [ ] Voice Messages
    - [ ] Music
    - [ ] Videos
    - [ ] Location
      - [ ] Live Location (o.map help me lmao)
  - [x] Replying
  - [x] Editing
  - [x] Deleting
  - [ ] Forwarding
  - [x] Markdown
- [ ] Login
  - [ ] SMS Code
  - [x] Telegram Send Code
  - [x] 2FA
  - [ ] Email
- [ ] Settings
- [ ] Contacts
- [ ] Telegram Stories

## Additional Info

- First launch of the app will take a while (idk why), the next app launches will not take so long.
- Currently Forum Groups will act as "View as Messages" as in the Telegram Web K client.
- pre-optimized lottie stickers are pre-converted apng images so client side rendering is not an issue, those stickers can be found in [kaigram-assets](https://github.com/cyan-2048/kaigram-assets)
- using this app on a 256MB RAM KaiOS device is kinda unstable.

## Developing

Please create a `.env.local` file and replace the values in `.env`

Dev Mode:

```
bun run dev
```

Build:

```
bun run build
```

add the `:v3` suffix for KaiOS 3.0 (example: `bun run dev:v3`)

## Technical Info

- For KaiOS 2.5, the app utilizes _real_ asm.js and on KaiOS 3.0 it uses WebAssembly like normal.
- mtcute is modified to use big-integer, this means BigInt can be used in KaiOS 2.5 and native BigInts are used for KaiOS 3.0.
- mtcute is also modified in order for asm.js to be used.
- there are 3 Web Workers
  - mtcute web worker proxy
  - heavy tasks worker for blocking operations (webp to png, md5, etc.)
  - (not yet implemented) rlottie
- ezgif is used for webp -> png conversion when libwebpjs (taken from whatsapp) fails to convert a webp image. (using ezgif as an unofficial api is not prohibited[^1])

[^1]: https://ezgif.com/help/ezgif-api

### Dependencies

- [mtcute](https://github.com/mtcute/mtcute) ([MIT License](https://github.com/mtcute/mtcute/blob/master/LICENSE))
- [fflate](https://github.com/101arrowz/fflate) ([MIT License](https://github.com/101arrowz/fflate/blob/master/LICENSE))
- [emoji-data](https://github.com/iamcal/emoji-data) ([MIT License](https://github.com/iamcal/emoji-data/blob/master/LICENSE))
- [rlottie](https://github.com/Samsung/rlottie) ([MIT License](https://github.com/Samsung/rlottie/blob/master/COPYING))
- [js-spatial-navigation](https://github.com/luke-chang/js-spatial-navigation) ([MPL-2.0 License](https://github.com/luke-chang/js-spatial-navigation/blob/master/LICENSE))
- [big-integer](https://github.com/peterolson/BigInteger.js) ([Unlicense License](https://github.com/peterolson/BigInteger.js/blob/master/LICENSE))
- libwebpjs

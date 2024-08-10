# Telegram4KaiOS

### HELP!!! I need a better name for this client. (TeleKram is taken)

Telegram client for KaiOS.

### Made with

- [mtcute](https://github.com/mtcute/mtcute) (amazing mtproto library)
- solid.js
- 👀🙌

The app is heavily inspired by Telegram Web K and the dead WhatsApp client for KaiOS.

## Screenshots

![Screenshot 1](/screenshots/1.png)
![Screenshot 2](/screenshots/2.png)
![Screenshot 3](/screenshots/3.png)
![Screenshot 4](/screenshots/4.png)
![Screenshot 5](/screenshots/5.png)
![Screenshot 6](/screenshots/6.png)
![Screenshot 7](/screenshots/7.png)
![Screenshot 8](/screenshots/8.png)
![Screenshot 9](/screenshots/9.png)
![Screenshot 10](/screenshots/10.png)
![Screenshot 11](/screenshots/11.png)
![Screenshot 12](/screenshots/12.png)
![Screenshot 13](/screenshots/13.png)
![Screenshot 14](/screenshots/14.png)

## Features

- [ ] Chats
  - [ ] Typing Indicator
    - [x] Self (others can see you type)
    - [ ] Others
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
      - [x] Uploading Voice Messages
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
      - [x] Gif previews
    - [ ] Photos
      - [x] Photo previews
    - [x] Voice Messages
    - [ ] Music
    - [ ] Videos
    - [ ] Location
      - [x] Location Previews
      - [ ] Live Location (o.map help me lmao)
  - [x] Replying
  - [x] Editing
  - [x] Deleting
  - [ ] Forwarding
  - [x] Markdown
- [ ] Login
  - [x] QR Code
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

Please create a `.env.local` file and add the values in `.env` replacing the APP_ID and APP_HASH with your own.

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
- SystemJS is used to simulate esm modules on KaiOS 2.5, it is also used to import asm.js files in order for it to preserve asm.js syntax.

## Dependencies

- [mtcute](https://github.com/mtcute/mtcute) ([MIT License](https://github.com/mtcute/mtcute/blob/master/LICENSE))
- [fflate](https://github.com/101arrowz/fflate) ([MIT License](https://github.com/101arrowz/fflate/blob/master/LICENSE))
- [emoji-data](https://github.com/iamcal/emoji-data) ([MIT License](https://github.com/iamcal/emoji-data/blob/master/LICENSE))
- [rlottie](https://github.com/Samsung/rlottie) ([MIT License](https://github.com/Samsung/rlottie/blob/master/COPYING))
- [js-spatial-navigation](https://github.com/luke-chang/js-spatial-navigation) ([MPL-2.0 License](https://github.com/luke-chang/js-spatial-navigation/blob/master/LICENSE))
- [big-integer](https://github.com/peterolson/BigInteger.js) ([Unlicense License](https://github.com/peterolson/BigInteger.js/blob/master/LICENSE))
- libwebpjs
- many more

## GIVE ME MONEY

All donations go to feeding my cats. (really need to spay my cats lmao)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H7LIPNW)

## Discord Server

for updates and to join the app testers.

[![Discord server](https://invidget.switchblade.xyz/W9DF2q3Vv2)](https://discord.gg/W9DF2q3Vv2)

testers will be able to install the app directly from the KaiStore.

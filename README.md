# Telegram4KaiOS

Unofficial Telegram client for KaiOS.

### Made with

- [mtcute](https://github.com/mtcute/mtcute) (amazing mtproto library)
- solid.js
- 👀🙌🤖

## Screenshots

![Screenshot 1](screenshots/1.png)
![Screenshot 2](screenshots/2.png)
![Screenshot 3](screenshots/3.png)
![Screenshot 4](screenshots/4.png)
![Screenshot 5](screenshots/5.png)
![Screenshot 6](screenshots/6.png)
![Screenshot 7](screenshots/7.png)
![Screenshot 8](screenshots/8.png)
![Screenshot 9](screenshots/9.png)
![Screenshot 10](screenshots/10.png)
![Screenshot 11](screenshots/11.png)
![Screenshot 12](screenshots/12.png)
![Screenshot 13](screenshots/13.png)
![Screenshot 14](screenshots/14.png)
![Screenshot 15](screenshots/15.png)
![Screenshot 16](screenshots/16.png)
![Screenshot 17](screenshots/17.png)
![Screenshot 18](screenshots/18.png)
![Screenshot 19](screenshots/19.png)
![Screenshot 20](screenshots/20.png)
![Screenshot 21](screenshots/21.png)
![Screenshot 22](screenshots/22.png)
![Screenshot 23](screenshots/23.png)
![Screenshot 24](screenshots/24.png)
![Screenshot 25](screenshots/25.png)
![Screenshot 26](screenshots/26.png)
![Screenshot 27](screenshots/27.png)
![Screenshot 28](screenshots/28.png)
![Screenshot 29](screenshots/29.png)
![Screenshot 30](screenshots/30.png)
![Screenshot 31](screenshots/31.png)
![Screenshot 32](screenshots/32.png)
![Screenshot 33](screenshots/33.png)
![Screenshot 34](screenshots/34.png)
![Screenshot 35](screenshots/35.png)

## Developing

### Prerequisites

Install the latest **LTS version of Node.js** and **Bun**:

- Node.js (Latest LTS)
- Bun: https://bun.sh/

### Environment Setup

Create a `.env.local` file and copy the contents of `.env` into it.

Replace the following values with your own Telegram API credentials:

```env
APP_ID=your_app_id
APP_HASH=your_app_hash
```

### Development

> [!NOTE]  
> **Bun is required.** npm, pnpm, and yarn are not supported.

#### KaiOS 2.5

```bash
bun run dev
```

#### KaiOS 3.0

```bash
bun run dev:v3
```

#### KaiOS 4.0

```bash
bun run dev:v4
```

### Building for Production

#### KaiOS 2.5

```bash
bun run build
```

#### KaiOS 3.0

```bash
bun run build:v3
```

#### KaiOS 4.0

```bash
bun run build:v4
```

#### CloudPhone

```bash
bun run build:cloudphhone
```

> [!NOTE]  
> CloudPhone support is highly experimental and only works on QVGA devices.
> `https://telekram.netlify.app/#cloudphone=1&api_id=<INSERT YOUR APP ID HERE>&api_hash=<INSERT YOUR APP HASH HERE>`

### Deployment

After the build completes, the generated files will be available in their respective directories:

- **KaiOS 2.5:** `dist`
- **KaiOS 3.0:** `dist-v3`
- **KaiOS 4.0:** `dist-v4`
- **CloudPhone:** `dist-v3`

## GIVE ME MONEY

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H7LIPNW)

mtcute developer: https://tei.su/donate

## Discord Server

for updates and to join the app testers.

[![Discord server](https://invidget.switchblade.xyz/W9DF2q3Vv2)](https://discord.gg/W9DF2q3Vv2)

testers will be able to install the app directly from the KaiStore.

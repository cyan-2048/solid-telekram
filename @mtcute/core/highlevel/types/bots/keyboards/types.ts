import type { tl } from '../../../../tl/index.js'

/**
 * Style of a bot keyboard button.
 *
 * Note that not every field is supported everywhere: {@link icon} is only
 * used in keyboards, and {@link link} is only used in rich messages.
 * Unsupported fields are silently dropped.
 */
export interface BotKeyboardButtonStyle {
  /** Render the button with the primary background color */
  bgPrimary?: boolean
  /** Render the button with the "danger" background color */
  bgDanger?: boolean
  /** Render the button with the "success" background color */
  bgSuccess?: boolean
  /** Custom emoji to be shown on the button (keyboards only) */
  icon?: tl.Long
  /** Render the button as a link (rich messages only) */
  link?: boolean
}

interface BotKeyboardButtonBase {
  /** Text of the button */
  text: string
  /** Style of the button */
  style?: BotKeyboardButtonStyle
}

/** A text-only button (reply keyboards only) */
export interface TextButton extends BotKeyboardButtonBase {
  readonly type: 'text'
}

/** A button requesting the user's phone number (reply keyboards only) */
export interface RequestContactButton extends BotKeyboardButtonBase {
  readonly type: 'request_contact'
}

/** A button requesting the user's geolocation (reply keyboards only) */
export interface RequestGeoButton extends BotKeyboardButtonBase {
  readonly type: 'request_geo'
}

/** A button requesting the user to create a poll (reply keyboards only) */
export interface RequestPollButton extends BotKeyboardButtonBase {
  readonly type: 'request_poll'
  /** If set, only quiz polls can be sent */
  quiz?: boolean
}

/** A button requesting the user to choose a peer (reply keyboards only) */
export interface RequestPeerButton extends BotKeyboardButtonBase {
  readonly type: 'request_peer'
  /** ID of the button, later passed to the service message */
  buttonId: number
  /** Peer type, along with filters */
  peerType: tl.TypeRequestPeerType
  /**
   * Maximum number of peers to be selected
   *
   * @default  1
   */
  count?: number
  /** Whether to request the name of the peer */
  nameRequested?: boolean
  /** Whether to request the username of the peer */
  usernameRequested?: boolean
  /** Whether to request the photo of the peer */
  photoRequested?: boolean
}

/** A button opening a webview. Usable in both inline and reply keyboards */
export interface WebViewButton extends BotKeyboardButtonBase {
  readonly type: 'webview'
  /** URL of the webview */
  url: string
}

/** A button opening a link */
export interface UrlButton extends BotKeyboardButtonBase {
  readonly type: 'url'
  /** URL to open */
  url: string
}

/** A button sending a callback query to the bot */
export interface CallbackButton extends BotKeyboardButtonBase {
  readonly type: 'callback'
  /** Callback data (1-64 bytes) */
  data: Uint8Array
  /** Whether the user should verify their identity by entering their 2FA password */
  requiresPassword?: boolean
}

/** A button prompting the user to switch to inline mode */
export interface SwitchInlineButton extends BotKeyboardButtonBase {
  readonly type: 'switch_inline'
  /** Inline query (can be empty) */
  query?: string
  /** Whether to insert the query in the current chat instead of prompting for one */
  currentChat?: boolean
  /** Types of the peers that can be chosen by the user */
  peerTypes?: tl.TypeInlineQueryPeerType[]
}

/** A button starting a game. Must be the first button in the first row */
export interface GameButton extends BotKeyboardButtonBase {
  readonly type: 'game'
}

/** A button paying for a product. Must be the first button in the first row */
export interface PayButton extends BotKeyboardButtonBase {
  readonly type: 'pay'
}

/** A button authorizing the user on a website */
export interface UrlAuthButton extends BotKeyboardButtonBase {
  readonly type: 'url_auth'
  /** Authorization URL */
  url: string
  /** Button label when forwarded */
  fwdText?: string
  /** Whether to request the permission for the bot to send messages to the user */
  requestWriteAccess?: boolean
  /**
   * Bot which will be used for user authorization.
   *
   * @default  current bot
   */
  bot?: tl.TypeInputUser
}

/** A button opening a user's profile */
export interface UserProfileButton extends BotKeyboardButtonBase {
  readonly type: 'user_profile'
  /** User whose profile should be opened */
  user: tl.TypeInputUser
}

/** A button copying text to the user's clipboard */
export interface CopyButton extends BotKeyboardButtonBase {
  readonly type: 'copy'
  /** Text to be copied (defaults to the button text) */
  copyText?: string
}

/** A button that does nothing when pressed */
export interface DisabledButton extends BotKeyboardButtonBase {
  readonly type: 'disabled'
}

/** A button usable in reply keyboards */
export type ReplyBotKeyboardButton
  = | TextButton
    | RequestContactButton
    | RequestGeoButton
    | RequestPollButton
    | RequestPeerButton
    | WebViewButton

/** A button usable in inline keyboards (and in rich messages) */
export type InlineBotKeyboardButton
  = | WebViewButton
    | UrlButton
    | CallbackButton
    | SwitchInlineButton
    | GameButton
    | PayButton
    | UrlAuthButton
    | UserProfileButton
    | CopyButton
    | DisabledButton

/** A bot keyboard button */
export type BotKeyboardButton = ReplyBotKeyboardButton | InlineBotKeyboardButton

/**
 * A button accepted by the reply keyboard factories.
 *
 * Raw TL objects are passed through as-is.
 */
export type InputReplyKeyboardButton = ReplyBotKeyboardButton | tl.TypeKeyboardButton

/**
 * A button accepted by the inline keyboard and rich message factories.
 *
 * Raw TL objects are passed through as-is.
 */
export type InputInlineKeyboardButton = InlineBotKeyboardButton | tl.TypeKeyboardInlineButton

/** A button accepted by any of the keyboard factories */
export type InputBotKeyboardButton = InputReplyKeyboardButton | InputInlineKeyboardButton

/**
 * Reply keyboard markup
 */
export interface ReplyKeyboardMarkup<Button = InputReplyKeyboardButton>
  extends Omit<tl.RawReplyKeyboardMarkup, '_' | 'rows'> {
  readonly type: 'reply'

  /**
   * Two-dimensional array of buttons
   */
  readonly buttons: Button[][]
}

/**
 * Hide previously sent bot keyboard
 */
export interface ReplyKeyboardHide extends Omit<tl.RawReplyKeyboardHide, '_'> {
  readonly type: 'reply_hide'
}

/**
 * Force the user to send a reply
 */
export interface ReplyKeyboardForceReply extends Omit<tl.RawReplyKeyboardForceReply, '_'> {
  readonly type: 'force_reply'
}

/**
 * Inline keyboard markup
 */
export interface InlineKeyboardMarkup<Button = InputInlineKeyboardButton>
  extends Omit<tl.RawReplyInlineMarkup, '_' | 'rows'> {
  readonly type: 'inline'

  /**
   * Two-dimensional array of buttons
   */
  readonly buttons: Button[][]
}

export type ReplyMarkup
  = | ReplyKeyboardMarkup
    | ReplyKeyboardHide
    | ReplyKeyboardForceReply
    | InlineKeyboardMarkup
    | tl.TypeReplyMarkup

/** Reply markup as parsed from an existing message */
export type ParsedReplyMarkup
  = | ReplyKeyboardMarkup<tl.TypeKeyboardButton>
    | ReplyKeyboardHide
    | ReplyKeyboardForceReply
    | InlineKeyboardMarkup<tl.TypeKeyboardInlineButton>

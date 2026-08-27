import type { tl } from '../../../../tl/index.js'

import type {
  InlineKeyboardMarkup,
  InputBotKeyboardButton,
  InputInlineKeyboardButton,
  InputReplyKeyboardButton,
  ReplyKeyboardMarkup,
} from './types.js'

export type ButtonLike<Button extends InputBotKeyboardButton = InputBotKeyboardButton>
  = Button | false | null | undefined | void

/**
 * Builder for bot keyboards
 */
export class BotKeyboardBuilder<Button extends InputBotKeyboardButton = InputInlineKeyboardButton> {
  private _buttons: Button[][] = []

  constructor(readonly maxRowWidth: number | null = 3) {}

  /**
   * Add buttons, wrapping them once {@link maxRowWidth} is reached
   *
   * @param buttons  Buttons to add
   */
  push(...buttons: (ButtonLike<Button> | (() => ButtonLike<Button>))[]): this {
    if (!buttons.length) return this

    let row: Button[] = []
    buttons.forEach((btn) => {
      if (typeof btn === 'function') btn = btn()
      if (!btn) return

      row.push(btn)

      if (row.length === this.maxRowWidth) {
        this._buttons.push(row)
        row = []
      }
    })

    if (row.length) {
      this._buttons.push(row)
    }

    return this
  }

  /**
   * Add a row of buttons. Will not be wrapped.
   *
   * @param row  Row or a function that will populate it
   */
  row(row: ButtonLike<Button>[] | ((arr: ButtonLike<Button>[]) => void)): this {
    if (typeof row === 'function') {
      const fn = row
      row = []
      fn(row)
    }

    const normal = row.filter(Boolean) as Button[]
    if (normal.length) this._buttons.push(normal)

    return this
  }

  /**
   * Append a button to the last row, wrapping if needed.
   *
   * @param btn  Button to add
   * @param force  Whether to forcefully add the button (i.e. do not wrap)
   */
  append(btn: ButtonLike<Button> | (() => ButtonLike<Button>), force = false): this {
    if (typeof btn === 'function') btn = btn()
    if (!btn) return this

    if (
      this._buttons.length
      && (this.maxRowWidth === null || force || this._buttons[this._buttons.length - 1].length < this.maxRowWidth)
    ) {
      this._buttons[this._buttons.length - 1].push(btn)
    } else {
      this._buttons.push([btn])
    }

    return this
  }

  /**
   * Return contents of this builder as an inline keyboard
   */
  asInline(
    this: BotKeyboardBuilder<InputInlineKeyboardButton>,
    params: Omit<InlineKeyboardMarkup, 'type' | 'buttons'> = {},
  ): InlineKeyboardMarkup {
    const ret = params as tl.Mutable<InlineKeyboardMarkup>
    ret.type = 'inline'
    ret.buttons = this._buttons

    return ret
  }

  /**
   * Return contents of this builder as a reply keyboard
   */
  asReply(
    this: BotKeyboardBuilder<InputReplyKeyboardButton>,
    params: Omit<ReplyKeyboardMarkup, 'type' | 'buttons'> = {},
  ): ReplyKeyboardMarkup {
    const ret = params as tl.Mutable<ReplyKeyboardMarkup>
    ret.type = 'reply'
    ret.buttons = this._buttons

    return ret
  }
}

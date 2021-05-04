/*
Night Theme Switcher Gnome Shell extension

Copyright (C) 2020 Romain Vigier

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <http s ://www.gnu.org/licenses/>.

*****
Based on code extracted from the

  Night Theme Switcher Gnome Shell extension
  Copyright (C) 2020 Romain Vigier

*/

const { Gdk, GLib, Gtk } = imports.gi;
const { extensionUtils } = imports.misc;

const Me = extensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Utils = Me.imports.utils;

var KeyboardShortcutDialog = class KeyboardShortcutDialog {
  constructor(callback) {
    this._builder = new Gtk.Builder();
    let kb_shortcuts_dialog_ui = Utils.isGnome3x() ? 'kb_shortcuts_dialog3x.ui' : 'kb_shortcuts_dialog40.ui';
    this._builder.add_from_file(GLib.build_filenamev([Me.path, 'ui', kb_shortcuts_dialog_ui]));

    this.widget = this._builder.get_object('dialog');

    this._callback = callback;
    if (Utils.isGnome3x()) {
      this.setup_keyPressEvent();
      let cancelButton = this._builder.get_object('cancel_button');
      cancelButton.connect('clicked', () => {
        this._callback({});
        this.widget.close();
      });
    } else {
      this.setup_eventController();
    }

    return this.widget;
  }

  setup_eventController() {
    const eventController = this._builder.get_object('event-controller');
    eventController.connect('key-pressed', (_widget, keyval, keycode, state) => {
      let mask = state & Gtk.accelerator_get_default_mod_mask();
      mask &= ~Gdk.ModifierType.LOCK_MASK;

      if (mask === 0 && keyval === Gdk.KEY_Escape) {
          this.widget.visible = false;
          return Gdk.EVENT_STOP;
      }

      return this.process_event({mask, keycode, keyval});
    });
  }

  setup_keyPressEvent() {
    this.widget.connect('key-press-event', (_widget, event) => {
      const state = event.get_state()[1];
      const keycode = event.get_keycode()[1];
      const eventKeyval = event.get_keyval()[1];
      let keyval = Gdk.keyval_to_lower(eventKeyval);

      let mask = state & Gtk.accelerator_get_default_mod_mask();
      mask &= ~Gdk.ModifierType.LOCK_MASK;

      if (mask === 0 && keyval === Gdk.KEY_Escape) {
        this.widget.visible = false;
        return Gdk.EVENT_STOP;
      }

      if (keyval === Gdk.KEY_ISO_Left_Tab) {
        keyval = Gdk.KEY_Tab;
      }

      if (keyval !== eventKeyval) {
        mask |= Gdk.ModifierType.SHIFT_MASK;
      }

      if (keyval === Gdk.KEY_Sys_Req && (mask & Gdk.ModifierType.MOD1_MASK) !== 0) {
        keyval = Gdk.KEY_Print;
      }

      return this.process_event({mask, keycode, keyval});
    });
  }

  process_event( {mask, keycode, keyval}) {
    if (!this.isBindingValid({ mask, keycode, keyval }) ||
      !this.isAccelValid({ mask, keyval })) {
      return Gdk.EVENT_STOP;
    }

    let binding = Gtk.accelerator_name_with_keycode(
      null,
      keyval,
      keycode,
      mask
    );

    this._callback({binding, mask, keycode, keyval});
    this.widget.close();
    return Gdk.EVENT_STOP;
  }

  /**
   * Check if the given key combo is a valid binding
   *
   * @param {{mask: number, keycode: number, keyval:number}} combo An object
   * representing the key combo.
   * @returns {boolean} `true` if the key combo is a valid binding.
   */
  isBindingValid({ mask, keycode, keyval }) {
    if ((mask === 0 || mask === Gdk.SHIFT_MASK) && keycode !== 0) {
      if (
        (keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
        (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
        (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
        (keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound) ||
        (keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun) ||
        (keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN) ||
        (keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega) ||
        (keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf) ||
        (keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao) ||
        (keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh) ||
        (keyval === Gdk.KEY_space && mask === 0) ||
        this.isKeyvalForbidden(keyval)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if the given keyval is forbidden.
   *
   * @param {number} keyval The keyval number.
   * @returns {boolean} `true` if the keyval is forbidden.
   */
  isKeyvalForbidden(keyval) {
    const forbiddenKeyvals = [
      Gdk.KEY_Home,
      Gdk.KEY_Left,
      Gdk.KEY_Up,
      Gdk.KEY_Right,
      Gdk.KEY_Down,
      Gdk.KEY_Page_Up,
      Gdk.KEY_Page_Down,
      Gdk.KEY_End,
      Gdk.KEY_Tab,
      Gdk.KEY_KP_Enter,
      Gdk.KEY_Return,
      Gdk.KEY_Mode_switch,
    ];
    return forbiddenKeyvals.includes(keyval);
  }

  /**
   * Check if the given key combo is a valid accelerator.
   *
   * @param {{mask: number, keyval:number}} combo An object representing the key
   * combo.
   * @returns {boolean} `true` if the key combo is a valid accelerator.
   */
  isAccelValid({ mask, keyval }) {
    return Gtk.accelerator_valid(keyval, mask) || (keyval === Gdk.KEY_Tab && mask !== 0);
  }
};


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
*/

const { Gdk, GLib, Gtk } = imports.gi;
const { extensionUtils } = imports.misc;

const Me = extensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const utils = Me.imports.utils;

var KeyboardShortcutDialog = class KeyboardShortcutDialog {
  constructor(callback) {
    this._builder = new Gtk.Builder();
    this._builder.add_from_file(GLib.build_filenamev([Me.path, 'kb_shortcuts_dialog3x.ui']));

    this.widget = this._builder.get_object('dialog');

    this.get_shortcut(callback);

    return this.widget;
  }

  get_shortcut(callback) {
    this._callback = callback;

    this.widget.connect('key-press-event', (_widget, event) => {
      const state = event.get_state()[1];
      let mask = state & Gtk.accelerator_get_default_mod_mask();
      mask &= ~Gdk.ModifierType.LOCK_MASK;
      const keycode = event.get_keycode()[1];
      const eventKeyval = event.get_keyval()[1];
      let keyval = Gdk.keyval_to_lower(eventKeyval);

      if (mask === 0 && keyval === Gdk.KEY_Escape) {
        this.widget.visible = false;
        return Gdk.EVENT_STOP;
      }

      if (keyval === Gdk.KEY_ISO_Left_Tab)
        keyval = Gdk.KEY_Tab;

      if (keyval !== eventKeyval)
        mask |= Gdk.ModifierType.SHIFT_MASK;

      if (keyval === Gdk.KEY_Sys_Req && (mask & Gdk.ModifierType.MOD1_MASK) !== 0)
        keyval = Gdk.KEY_Print;

      // if (
      //     !utils.isBindingValid({ mask, keycode, keyval }) ||
      //     !utils.isAccelValid({ mask, keyval })
      // )
      //     return Gdk.EVENT_STOP;

      const binding = Gtk.accelerator_name_with_keycode(
        null,
        keyval,
        keycode,
        mask
      );

      this._callback(binding, mask, keycode, keyval);

      //this.widget.close();
      return Gdk.EVENT_STOP;
    });

    const cancelButton = this._builder.get_object('cancel_button');
    cancelButton.connect('clicked', () => {
      this.widget.close();
    });
  }
};


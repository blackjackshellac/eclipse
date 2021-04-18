/*
 * Clippie: Gnome Shell gaste-client extension
 * Copyright (C) 2021 Steeve McCauley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const { GObject, St, Clutter, Gio } = imports.gi;

const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var LockItemModalDialog = GObject.registerClass({
}, class LockItemModalDialog extends ModalDialog.ModalDialog {

  _init(clip) {
    super._init({ styleClass: 'extension-dialog' });

    this._clip = clip;

    this.setButtons([
      { label: _("Ok"),
        action: Lang.bind(this, this._onOk),
        //key:    Clutter.Escape
      },
      {
        label: _("Cancel"),
        action: Lang.bind(this, this._onCancel)
      }
    ]);

    let box = new St.BoxLayout({ vertical: true});
    this.contentLayout.add(box);

    let gicon = Gio.icon_new_for_string('dialog-password-symbolic');
    let icon = new St.Icon({
      gicon: gicon,
      icon_size: 20
    });
    //box.add(icon);

    this._entry = new St.Entry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'clippie-search-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      primary_icon: icon,
      hint_text: _("Password label"),
    });

    box.add(new St.Label({
      text: _("Enter a name for the password"),
      x_align: Clutter.ActorAlign.CENTER
    }))
    box.add(this._entry);

    // box.add(new St.Label({ text: "AboutDialogTest Version " + Me.metadata.version, x_align: Clutter.ActorAlign.CENTER, style_class: "title-label" }));
    // box.add(new St.Label({ text: "GNOME Shell extension to display an About Dialog.", x_align: Clutter.ActorAlign.CENTER }));
    // box.add(new St.Label({ text: "This program comes with absolutely no warranty.", x_align: Clutter.ActorAlign.CENTER, style_class: "warn-label" }));
    // box.add(new St.Label({ text: "Copyright © 2017-2018 BlahBlahBlah", x_align: Clutter.ActorAlign.CENTER, style_class: "copyright-label" }));
  }

  _onOk(button, event) {
    this.close(global.get_current_time());
  }

  _onCancel(button, event) {
    this.close(global.get_current_time());
  }
});

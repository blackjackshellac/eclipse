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

const Clip = Me.imports.clippie.Clip;

var LockItemModalDialog = GObject.registerClass({
}, class LockItemModalDialog extends ModalDialog.ModalDialog {

  _init(clip) {
    super._init({
      styleClass: 'extension-dialog'
    });

    this._clip = clip;

    this.setButtons([
      { label: _("Ok"),
        action: Lang.bind(this, this._onOk)
      },
      {
        label: _("Cancel"),
        action: Lang.bind(this, this._onCancel),
        key:    Clutter.Escape // doesn't work
      }
    ]);

    let box = new St.BoxLayout({
      x_expand: true,
      y_expand: true,
      vertical: true,
      style_class: 'clippie-password-box'
    });
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
      style_class: 'clippie-password-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      primary_icon: icon,
      hint_text: _("Password label"),
      reactive: true
    });

    this._entry.set_hover(true);

    let etext = this._entry.get_clutter_text();

    etext.set_activatable(true);
    etext.set_editable(true);

    let label_text=_("Enter name for the password entry");
    if (clip.isPassword()) {
      let label = clip.password_name;
      this._entry.set_text(label);
      label_text =_("Enter new name for the password entry");
    }

    box.add(new St.Label({
      text: label_text,
      x_align: Clutter.ActorAlign.CENTER,
      style_class: 'clippie-password-text'
    }))
    box.add(this._entry);

    this.connect('opened', (dialog) => {
      global.stage.set_key_focus(this._entry);
    });

    this.connect('closed', (dialog) => {
      global.stage.set_key_focus(null);
    });

    etext.connect('activate', (etext) => {
      this.submit();
    });

    // etext.connect('text-changed', (etext) => {
    //   log('text='+etext+getText());
    // });
  }

  submit() {
    let label = this._entry.get_text();
    let ok = this.clip.set_password(label);
    if (ok) {
      this.close(global.get_current_time());
    }
  }
  _onOk(button, event) {
    this.submit();
  }

  _onCancel(button, event) {
    this.close(global.get_current_time());
  }

  get clip() {
    return this._clip;
  }
});

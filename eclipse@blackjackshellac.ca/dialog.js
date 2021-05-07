/*
 * eclipse GPaste interface with encryption
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

const ModalDialog = imports.ui.modalDialog;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Clip = Me.imports.clippie.Clip;

var DecryptModalDialog = GObject.registerClass({
}, class DecryptModalDialog extends ModalDialog.ModalDialog {

  _init(clip) {
    super._init({
      styleClass: 'extension-dialog'
    });

    this._clip = clip;

    this.setButtons([
      { label: _("Decrypt"),
        action: this._onOk.bind(this)
      },
      {
        label: _("Cancel"),
        action: this._onCancel.bind(this),
        key:    Clutter.Escape // doesn't work
      }
    ]);

    let box = new St.BoxLayout({
      x_expand: true,
      y_expand: true,
      vertical: true,
      style_class: 'eclipse-password-box'
    });
    this.contentLayout.add(box);

    let gkey = Gio.icon_new_for_string('dialog-password-symbolic');
    let gclear = Gio.icon_new_for_string('edit-clear-symbolic');

    this._password_entry = new St.PasswordEntry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      show_peek_icon: true,
      style_class: 'eclipse-decrypt-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      primary_icon: new St.Icon({ gicon: gkey, icon_size: 20 }),
      //secondary_icon: new St.Icon({ gicon: gclear, icon_size: 20 }),
      hint_text: _("Passphrase"),
      reactive: true
    });

    this._password_entry.set_hover(true);
    let ptext = this._password_entry.get_clutter_text();
    ptext.set_activatable(true);
    ptext.set_editable(true);

    this._password_entry.connect('primary-icon-clicked', (entry) => {
      if (this.clip.clippie.cached_pass !== undefined) {
        let cur_text = entry.get_text();
        if (cur_text.length > 0 && cur_text === this.clip.clippie.cached_pass) {
          // if the value in the entry equals the value of the cached pass, clear it
          this.set_msg(_("Cached password cleared"))
          this.clip.clippie.cached_pass = "";
        }
        entry.set_text(this.clip.clippie.cached_pass);
      }
    });

    // this._password_entry.connect('secondary-icon-clicked', (entry) => {
    //     this.clip.clippie.cached_pass = '';
    //     this._password_entry.set_text("");
    // });

    this._msg = new St.Label({
      text: _("Enter the decryption passphrase"),
      x_align: Clutter.ActorAlign.CENTER,
      style_class: 'eclipse-msg-text'
    });

    this._label = new St.Label({
      text: clip.content,
      x_align: Clutter.ActorAlign.CENTER,
      style_class: 'eclipse-label-text'
    });

    box.add(this._label);
    box.add(this._password_entry);
    box.add(this._msg);

    this.connect('opened', (dialog) => {
      global.stage.set_key_focus(this._password_entry);
    });

    this.connect('closed', (dialog) => {
      global.stage.set_key_focus(null);
    });

    ptext.connect('activate', (ctext) => {
      if (this.confirm()) {
        this.submit();
      }
    });

    ptext.grab_key_focus();

    this.connect('key-press-event', (dialog, event) => {
      this.clip.logger.debug('key pressed %s', event);
      let symbol = event.get_key_symbol();
      // https://lazka.github.io/pgi-docs/Clutter-1.0/constants.html
      if (symbol === Clutter.KEY_Escape) {
        this.close(global.get_current_time());
        return true;
      }
      return false;
    });
  }

  confirm() {
    let ptext = this._password_entry.get_text().trim();
    if (ptext.length < 4) {
      this.set_msg(_('Passphrase too short'));
      return undefined;
    }

    this._password_entry.set_text(ptext);
    return ptext;
  }

  submit() {
    let password = this.confirm();
    if (password) {
      let msg=this.clip.decrypt(password, (ok, stderr) => {
        if (ok) {
          this.close(global.get_current_time());
          if (this.clip.clippie.cached_pass !== undefined) {
            this.clip.clippie.logger.debug('cached_pass submit=%s', password);
            this.clip.clippie.cached_pass = password;
          }
        } else {
          this._password_entry.add_style_class_name('eclipse-entry-red');
          this.set_msg(_('Decryption failed'));
        }
      });
      if (msg) {
        this.set_msg(msg);
      }
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

  set_msg(msg) {
    this._msg.set_text(msg);
  }
});

var EncryptModalDialog = GObject.registerClass({
}, class EncryptModalDialog extends ModalDialog.ModalDialog {

  _init(clip) {
    super._init({
      styleClass: 'extension-dialog'
    });

    this._clip = clip;

    this.setButtons([
      { label: _("Encrypt"),
        action: this._onOk.bind(this)
      },
      {
        label: _("Cancel"),
        action: this._onCancel.bind(this),
        key:    Clutter.Escape // doesn't work
      }
    ]);

    let box = new St.BoxLayout({
      x_expand: true,
      y_expand: true,
      vertical: true,
      style_class: 'eclipse-password-box'
    });
    this.contentLayout.add(box);

    let gkey = Gio.icon_new_for_string('dialog-password-symbolic');
    let gclear = Gio.icon_new_for_string('edit-clear-symbolic');

    //let icon = new St.Icon({ gicon: gkey, icon_size: 20 });
    //box.add(icon);

    this._entry = new St.Entry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'eclipse-encrypt-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      hint_text: _("Label for encrypted entry"),
      reactive: true
    });

    this._entry.set_hover(true);
    let etext = this._entry.get_clutter_text();
    etext.set_activatable(false);
    etext.set_editable(true);

    this._password_entry = new St.PasswordEntry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      show_peek_icon: true,
      style_class: 'eclipse-encrypt-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      primary_icon: new St.Icon({ gicon: gkey, icon_size: 20 }),
      //secondary_icon: new St.Icon({ gicon: gclear, icon_size: 20 }),
      hint_text: _("Passphrase"),
      reactive: true
    });

    this._password_entry.connect('primary-icon-clicked', (entry) => {
      let cur_text = entry.get_text();
      if (cur_text.length > 0 && cur_text === this.clip.clippie.cached_pass) {
        // if the value in the entry equals the value of the cached pass, clear it
        this.set_msg(_("Cached password cleared"))
        this.clip.clippie.cached_pass = "";
      }
      if (this.clip.clippie.cached_pass !== undefined) {
        this._password_entry.set_text(this.clip.clippie.cached_pass);
      }
    });

    // this._password_entry.connect('secondary-icon-clicked', (entry) => {
    //     this.clip.clippie.cached_pass = '';
    //     this._password_entry.set_text("");
    // });

    this._password_entry.set_hover(true);
    let ptext = this._password_entry.get_clutter_text();
    ptext.set_activatable(false);
    ptext.set_editable(true);

    this._password_confirm = new St.PasswordEntry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      show_peek_icon: true,
      style_class: 'eclipse-confirm-entry',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      primary_icon: new St.Icon({ gicon: gkey, icon_size: 20 }),
      //secondary_icon: new St.Icon({ gicon: gclear, icon_size: 20 }),
      hint_text: _("Confirm"),
      reactive: true
    });

    this._password_confirm.connect('primary-icon-clicked', (entry) => {
        let cur_text = entry.get_text();
        if (cur_text.length > 0 && cur_text === this.clip.clippie.cached_pass) {
          // if the value in the entry equals the value of the cached pass, clear it
          this.set_msg(_("Cached password cleared"))
          this.clip.clippie.cached_pass = "";
        }
      if (this.clip.clippie.cached_pass !== undefined) {
        this._password_confirm.set_text(this.clip.clippie.cached_pass);
      }
    });

    // this._password_confirm.connect('secondary-icon-clicked', (entry) => {
    //     this.clip.clippie.cached_pass = '';
    //     this._password_confirm.set_text("");
    // });

    this._password_confirm.set_hover(true);
    let ctext = this._password_confirm.get_clutter_text();
    ctext.set_activatable(true);
    ctext.set_editable(true);

    this._msg = new St.Label({
      text: _("Enter and confirm the encryption passphrase"),
      x_align: Clutter.ActorAlign.CENTER,
      style_class: 'eclipse-label-text'
    });

    box.add(this._entry);
    box.add(this._password_entry);
    box.add(this._password_confirm);
    box.add(this._msg);

    this.connect('opened', (dialog) => {
      global.stage.set_key_focus(this._entry);
    });

    this.connect('closed', (dialog) => {
      global.stage.set_key_focus(null);
    });

    ctext.connect('activate', (ctext) => {
      this.submit();
    });

    ptext.connect('text-changed', (ptext) => {
      this.confirm_with_style();
    });

    ctext.connect('text-changed', (ctext) => {
      this.confirm_with_style();
    });

    this.connect('key-press-event', (dialog, event) => {
      this.clip.logger.debug('key pressed %s', event);
      let symbol = event.get_key_symbol();
      // https://lazka.github.io/pgi-docs/Clutter-1.0/constants.html
      if (symbol === Clutter.KEY_Escape) {
        this.close(global.get_current_time());
        return true;
      }
      return false;
    });
  }

  confirm_with_style() {
    if (this.confirm()) {
      this._password_entry.add_style_class_name('eclipse-entry-green');
      this._password_confirm.add_style_class_name('eclipse-entry-green');
    } else {
      this._password_entry.remove_style_class_name('eclipse-entry-green');
      this._password_confirm.remove_style_class_name('eclipse-entry-green');
    }
  }

  confirm() {
    let label = this._entry.get_text().trim();
    if (label.length === 0) {
      this.set_msg(_('Specify a label for the encrypted entry'));
      return undefined;
    }
    let ptext = this._password_entry.get_text().trim();
    let ctext = this._password_confirm.get_text().trim();
    if (ptext.length < 4) {
      this.set_msg(_('Passphrase too short'));
      return undefined;
    }
    if (ptext !== ctext) {
      this.set_msg(_('Passphrase mismatch'));
      return undefined;
    }
    this.set_msg(_('Passphrase match'));
    this._entry.set_text(label);
    this._password_entry.set_text(ptext);
    this._password_confirm.set_text(ctext);
    return ptext;
  }

  submit() {
    let password = this.confirm();
    if (password) {
      this.clip.encrypt(this._entry.get_text(), password, (ok, stderr) => {
        //this.clip.logger.debug("ok=%s stderr=[%s]", ok, stderr);
        if (ok) {
          // success, delete from clipboard
          this.clip.delete();
          this.close(global.get_current_time());
          if (this.clip.clippie.cached_pass !== undefined) {
            this.clip.clippie.logger.debug('cached_pass submit=%s', password);
            this.clip.clippie.cached_pass = password;
          }
        } else {
          this.set_msg(stderr);
        }
      });
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

  set_msg(msg) {
    this._msg.set_text(msg);
  }
});

var LockItemModalDialog = GObject.registerClass({
}, class LockItemModalDialog extends ModalDialog.ModalDialog {

  _init(clip) {
    super._init({
      styleClass: 'extension-dialog'
    });

    this._clip = clip;

    this.setButtons([
      { label: _("Ok"),
        action: this._onOk.bind(this)
      },
      {
        label: _("Cancel"),
        action: this._onCancel.bind(this),
        key:    Clutter.Escape // doesn't work
      }
    ]);

    let box = new St.BoxLayout({
      x_expand: true,
      y_expand: true,
      vertical: true,
      style_class: 'eclipse-password-box'
    });
    this.contentLayout.add(box);

    let gkey = Gio.icon_new_for_string('dialog-password-symbolic');
    let icon = new St.Icon({ gicon: gkey, icon_size: 20 });

    this._entry = new St.Entry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'eclipse-password-entry',
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
      style_class: 'eclipse-password-text'
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

    this.connect('key-press-event', (dialog, event) => {
      this.clip.logger.debug('key pressed %s', event);
      let symbol = event.get_key_symbol();
      // https://lazka.github.io/pgi-docs/Clutter-1.0/constants.html
      if (symbol === Clutter.KEY_Escape) {
        this.close(global.get_current_time());
        return true;
      }
      return false;
    });

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

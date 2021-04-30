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
const Logger = Me.imports.logger.Logger;

var EditItemDialog = GObject.registerClass({
}, class EditItemDialog extends ModalDialog.ModalDialog {
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

    //   style_class: 'clippie-edit-entry',
    //   enable_mouse_scrolling: true,
    //   overlay_scrollbars: true,
    //   hscrollbar_policy: St.PolicyType.ALWAYS,
    //   vscrollbar_policy: St.PolicyType.ALWAYS
    // });

    /*
    value (Number) — the current value
    lower (Number) — the lower bound
    upper (Number) — the upper bound
    step_increment (Number) — the step increment
    page_increment (Number) — the page increment
    page_size (Number) — the page size
    set_values(value, lower, upper, step_increment, page_increment, page_size)
    */
    // let vscroll = scrollView.vscroll;
    // let vadjust = vscroll.get_adjustment();
    // vadjust.set_values(0, 0, 5000, 1, 10, 0);
    // let [ value, lower, upper, step_inc, page_inc, page_size ] = vadjust.get_values();

    // clip.logger.debug('v %d lower=%d upper=%d step=%d page_inc=%d, page_size=%d', value, lower, upper, step_inc, page_inc, page_size);
    // vscroll.set_adjustment(vadjust);

    // vscroll.connect('scroll-start', (vs) => {
    //   clip.logger.debug('scroll start');
    // });

    // vscroll.show();

    // let hscroll = scrollView.hscroll;
    // let hadjust = hscroll.get_adjustment();
    // hadjust.set_values(0, 0, 5000, 1, 10, 0);

    // [ value, lower, upper, step_inc, page_inc, page_size ] = hadjust.get_values();
    // clip.logger.debug('h %d lower=%d upper=%d step=%d page_inc=%d, page_size=%d', value, lower, upper, step_inc, page_inc, page_size);
    // hscroll.set_adjustment(hadjust);

    // let gicon = Gio.icon_new_for_string('document-edit-symbolic');
    // let icon = new St.Icon({
    //   gicon: gicon,
    //   icon_size: 20
    // });

    this._entry = new St.Entry({
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'clippie-edit-entry',
      x_align: Clutter.ActorAlign.START,
      y_align: Clutter.ActorAlign.START,
      //primary_icon: icon,
      reactive: true
    });
    this._entry.set_hover(true);

    let etext = this._entry.get_clutter_text();
    //scrollView.add_child(entryBox);
    //entryBox.add(scrollView);

    //entryBox.add(this._entry);
    //scrollView.add_child(this._entry);
    //this._entry.set_child(scrollView);

    let box = new St.BoxLayout({
      x_expand: true,
      y_expand: false,
      //vertical: true,
      //style_class: 'clippie-password-box'
    });

    let scrollView = new St.ScrollView();

    box.add(this._entry);
    scrollView.add_actor(box);
    this.contentLayout.add(scrollView);

    this.contentLayout.width = 640;
    //this.contentLayout.height = 320;

    etext.set_activatable(true);
    etext.set_editable(true);
    etext.set_single_line_mode(false);

    this.setInitialKeyFocus(etext);
    this._entry.set_text("{\n"+clip.content+"\n}");

    let lines = clip.content.split(/\n/).length;
    let vscroll = scrollView.vscroll;
    let vadjust = vscroll.get_adjustment();
    vadjust.set_values(0, 0, lines, 1, 10, 0);
    let [ value, lower, upper, step_inc, page_inc, page_size ] = vadjust.get_values();

    clip.logger.debug('v %d lower=%d upper=%d step=%d page_inc=%d, page_size=%d', value, lower, upper, step_inc, page_inc, page_size);
    vscroll.set_adjustment(vadjust);

    // box.add(new St.Label({
    //   text: label_text,
    //   x_align: Clutter.ActorAlign.CENTER,
    //   style_class: 'clippie-password-text'
    // }))
    //box.add(scrollView);
    //box.add(entryBox);

    this.connect('opened', (dialog) => {
      global.stage.set_key_focus(this._entry);
    });

    this.connect('closed', (dialog) => {
      global.stage.set_key_focus(null);
    });

    etext.connect('activate', (etext) => {
      this.submit();
    });
  }

  vfunc_key_release_event(event) {
    log('key release '+event.keyval);
    if (event.keyval === Clutter.KEY_Escape) {
      this.close();
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  }


  _onOk(button, event) {
    this.submit();
  }

  _onCancel(button, event) {
    this.close(global.get_current_time());
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

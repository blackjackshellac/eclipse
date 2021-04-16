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
const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var TestDialog = GObject.registerClass({
}, class TestDialog extends Dialog.Dialog {
  _init(parent) {
    super._init(parent);
  }
});

var TestModalDialog = GObject.registerClass({
}, class TestModalDialog extends ModalDialog.ModalDialog {

    _init() {
        super._init({ styleClass: 'extension-dialog' });

        this.setButtons([{ label: "OK",
                           action: Lang.bind(this, this._onClose),
                           key:    Clutter.Escape
                         }]);

        let box = new St.BoxLayout({ vertical: true});
        this.contentLayout.add(box);

        let gicon = Gio.icon_new_for_string('dialog-error');
        let icon = new St.Icon({ gicon: gicon });
        box.add(icon);

        box.add(new St.Label({ text: "AboutDialogTest Version " + Me.metadata.version, x_align: Clutter.ActorAlign.CENTER, style_class: "title-label" }));
        box.add(new St.Label({ text: "GNOME Shell extension to display an About Dialog.", x_align: Clutter.ActorAlign.CENTER }));
        box.add(new St.Label({ text: "This program comes with absolutely no warranty.", x_align: Clutter.ActorAlign.CENTER, style_class: "warn-label" }));
        box.add(new St.Label({ text: "Copyright © 2017-2018 BlahBlahBlah", x_align: Clutter.ActorAlign.CENTER, style_class: "copyright-label" }));
    }

    _onClose(button, event) {
        this.close(global.get_current_time());
    }

});

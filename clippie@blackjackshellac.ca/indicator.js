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

const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Clippie = Me.imports.clippie.Clippie;
const ClippieMenu = Me.imports.menus.ClippieMenu;
const Logger = Me.imports.logger.Logger;
const KeyboardShortcuts = Me.imports.keyboard_shortcuts.KeyboardShortcuts;

var ClippieIndicator = GObject.registerClass(
class ClippieIndicator extends PanelMenu.Button {
  _init() {
    super._init(0.0, _('Clippie'));

    // settings lives in Clippie singleton
    this._clippie = Clippie.attach(this);

    this.logger = new Logger('cl_indicator', this.settings);
    this.logger.debug('Initializing extension');

    this.accel = new KeyboardShortcuts(this.settings);

    this.settings.settings.connect('changed::accel-enable', () => {
      this.logger.debug('accel-enable has changed');
      this.toggle_keyboard_shortcuts();
    });

    if (this.settings.accel_enable) {
      this.enable_keyboard_shortcuts();
    }

    let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
    box.add_child(new St.Icon({
        icon_name: 'view-paged-symbolic',
        style_class: 'system-status-icon',
    }));
    box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
    this.add_child(box);

    this._clippie_menu = new ClippieMenu(this.menu, this.clippie);
    // set the filter to an empty string to prevent refreshing on startup
    this._clippie_menu.build("");
  }

  toggle_keyboard_shortcuts() {
    if (this.settings.accel_enable) {
      this.enable_keyboard_shortcuts();
    } else {
      this.disable_keyboard_shortcuts();
    }
  }

  enable_keyboard_shortcuts() {
    this.accel.listenFor(this.settings.accel_show_menu, () => {
      this.logger.debug("Show clippie menu");
      this.clippie_menu.open();
    });

    this.accel.listenFor(this.settings.accel_show_history, () => {
      this.logger.debug("Show clippie history");
      this.clippie_menu.open({history:true});
    });
  }

  disable_keyboard_shortcuts() {
    this.accel.remove(this.settings.accel_show_menu);
    this.accel.remove(this.settings.accel_show_history);
  }

  get settings() {
    return this.clippie.settings;
  }

  get clippie() {
    return this._clippie;
  }

  get clippie_menu() {
    return this._clippie_menu;
  }

  rebuild_menu(filter=undefined) {
    this.clippie_menu.build(filter);
  }
});

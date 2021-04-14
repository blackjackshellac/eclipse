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

var ClippieIndicator = GObject.registerClass(
class ClippieIndicator extends PanelMenu.Button {
  _init() {
    super._init(0.0, _('Clippie'));

    // settings lives in Clippie singleton
    this._clippie = Clippie.attach(this);

    this.logger = new Logger('cl_indicator', this.settings);
    this.logger.debug('Initializing extension');

    let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
    box.add_child(new St.Icon({
        icon_name: 'view-paged-symbolic',
        style_class: 'system-status-icon',
    }));
    box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
    this.add_child(box);

    this._clippieMenu = new ClippieMenu(this.menu, this.clippie);
    // set the filter to an empty string to prevent refreshing on startup
    this._clippieMenu.build("");
  }

  get settings() {
    return this.clippie.settings;
  }

  get clippie() {
    return this._clippie;
  }

  rebuild_menu(filter=undefined) {
    this._clippieMenu.build(filter);
  }
});

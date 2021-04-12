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

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, St, Clutter, Gio} = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Logger = Me.imports.logger.Logger;

var Clippie = class Clippie extends Array {
  constructor(...args) {
    super(...args);

    // id => clip
    this._lookup = {};

    this._settings = new Settings();
    this._attached = false;

    this.logger = new Logger('clippie', this.settings);

  }

  static attach(indicator) {
    // reload settings
    timersInstance._settings = new Settings();
    timersInstance._inhibitor.settings = timersInstance._settings;

    timersInstance.logger.settings = timersInstance._settings;

    timersInstance.logger.info("Attaching indicator");

    timersInstance.indicator = indicator;

    timersInstance.refresh();

    timersInstance.restoreRunningClippie();

    timersInstance.attached = true;

    return timersInstance;
  }

  static detach() {
    timersInstance.logger.info("Detaching indicator from Clippie");
    timersInstance.attached = false;
    timersInstance.indicator = undefined;
  }

}

// timers is a singleton class
var timersInstance = new Clippie();

var Clip = class Clip {

  constructor(uuid, content=undefined) {
    this._uuid = uuid;
    this._content = content;
  }

}



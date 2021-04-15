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

const { Gio, Gtk, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Settings = Me.imports.settings.Settings;
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;

// https://gjs.guide/extensions/upgrading/gnome-shell-40.html
const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

class PreferencesBuilder {
  constructor() {
      this._settings = new Settings();
      this._builder = new Gtk.Builder();
      this.logger = new Logger('cl_prefs', this._settings);
  }

  show() {
    this._widget.show_all();
  }

  build() {

    this.logger.info("Create preferences widget shell version %s", shellVersion < 40 ? "3.38 or less" : ""+shellVersion);

    this._builder.add_from_file(Me.path + '/prefs.ui');
    this._prefsBox = this._builder.get_object('clippie_prefs');

    this._viewport = new Gtk.Viewport();
    this._viewport.add(this._prefsBox);
    this._widget = new Gtk.ScrolledWindow();
    this._widget.add(this._viewport);

    this._bind();

    return this._widget;
  }

  /**
   * Get Gtk Builder object by id
   */
  _bo(id) {
    return this._builder.get_object(id);
  }

  /**
   * Bind setting to builder object
   */
  _ssb(key, object, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    if (object) {
      this._settings.settings.bind(key, object, property, flags);
    } else {
      this.logger.error(`object is null for key=${key}`);
    }
  }

  _bo_ssb(id, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    let object = this._bo(id);
    let key=id.replace(/_/g, '-');
    this._ssb(key, object, property, flags);
  }

  _bind() {
    //this._bo_ssb('accel_enable', 'active');
  }
}

function init() {

}

function buildPrefsWidget() {
  ExtensionUtils.initTranslations(GETTEXT_DOMAIN);

  var preferencesBuilder = new PreferencesBuilder();
  var widget = preferencesBuilder.build();
  preferencesBuilder.show();

  return widget;
}


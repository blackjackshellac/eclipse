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

const { Gio, Gtk, GLib, Gdk } = imports.gi;
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

    this._gsettings = Utils.exec_path('gsettings');
    this._gpaste_client = Utils.exec_path('gpaste-client');

    if (this._gsettings === null) {
      this.logger.error('gsettings not found');
      this._gsettings = 'gsettings';
    }
    if (this._gpaste_client === null) {
      this.logger.error('gpaste_client not found');
      throw 'clippie requires gpaste_client to work';
    }

    // gsettings get org.gnome.GPaste track-changes
    // gsettings set org.gnome.GPaste track-changes false
    // gpaste-client daemon-reexec
    this.command_args = {
      get_track_changes: (this.gsettings+' get org.gnome.GPaste track-changes').split(/\s+/),
      set_track_changes_true:  (this.gsettings+' set org.gnome.GPaste track-changes true').split(/\s+/),
      set_track_changes_false: (this.gsettings+' set org.gnome.GPaste track-changes false').split(/\s+/),
      daemon_reexec:  [ this.gpaste_client, 'daemon-reexec' ]
    };
  }

  get gsettings() {
    return this._gsettings;
  }

  get gpaste_client() {
    return this._gpaste_client;
  }

  show() {
    if (shellVersion < 40) { this._widget.show_all(); }
  }

  build() {

    this.logger.info("Create preferences widget shell version %s", shellVersion < 40 ? "3.38 or less" : ""+shellVersion);

    this._builder.add_from_file(Me.path + '/prefs.ui');
    this._prefs_box = this._builder.get_object('prefs_box');

    this._viewport = new Gtk.Viewport();
    this._widget = new Gtk.ScrolledWindow();
    if (shellVersion < 40) {
      this._viewport.add(this._prefs_box);
      this._widget.add(this._viewport);
    } else {
      this._viewport.set_child(this._prefs_box);
      this._widget.set_child(this._viewport);
    }

    this._prefs_grid = this._bo('prefs_grid');
    this._title = this._bo('title');
    this._track_changes = this._bo('track_changes');
    this._daemon_reexec = this._bo('daemon_reexec');

    if (shellVersion >= 40) {
      this._prefs_box.append(this._title);
      this._prefs_box.append(this._prefs_grid);

      let provider = new Gtk.CssProvider();

      provider.load_from_path(Me.dir.get_path() + '/prefs.css');
      Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      this._title.add_css_class('prefs-title');
    } else {
      // pack_start(child, expand, fill, padding)
      this._prefs_box.pack_start(this._title, false, false, 10);
      this._prefs_box.pack_start(this._prefs_grid, false, false, 10);
    }

    // left, top, width, height
    this._prefs_grid.attach(this._bo('track_changes_text'), 0, 1, 1, 1);
    this._prefs_grid.attach(this._track_changes, 1, 1, 1, 1);
    this._prefs_grid.attach(this._bo('debug_text'), 0, 2, 1, 1);
    this._prefs_grid.attach(this._bo('debug'),      1, 2, 1, 1);
    this._prefs_grid.attach(this._daemon_reexec,    0, 3, 2, 1);

    let [ exit_status, stdout, stderr ] = Utils.execute(this.command_args.get_track_changes);
    if (exit_status === 0) {
      let active = stdout.trim() === 'true';
      this.logger.debug('gsettings get org.gnome.GPaste track-changes => %s', stdout);
      this._track_changes.set_active(active);
    }
    this._track_changes.connect('notify::active', (sw) => {
      let active = sw.get_active();
      let cmdargs = active ? this.command_args.set_track_changes_true : this.command_args.set_track_changes_false;
      this.logger.debug(cmdargs.join(' '));
      let [ exit_status, stdout, stderr ] = Utils.execute(cmdargs);
      if (exit_status !== 0) {
        this.logger.debug('set track-changes failed: %d - %s', exit_status, stderr);
      }
    });

    this._daemon_reexec.connect('clicked', (btn) => {
      this.logger.debug("running %s", this.command_args.daemon_reexec.join(' '));
      let [ exit_status, stdout, stderr ] = Utils.execute(this.command_args.daemon_reexec);
      if (exit_status === 0) {
        this.logger.info(stdout.trim());
      }
    });

    // gsettings get org.gnome.GPaste track-changes
    // gsettings set org.gnome.GPaste track-changes false
    // gpaste-client daemon-reexec

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
    this._bo_ssb('debug', 'active');
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


/*
 * Kitchen Timer: Gnome Shell Kitchen Timer Extension
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

const GETTEXT_DOMAIN = 'eclipse-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const GLib = imports.gi.GLib;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;

// adapted from Bluetooth-quick-connect extension by Bartosz Jaroszewski
var Settings = class Settings {
  constructor() {
    // try to recompile the schema
    //let compile_schemas = [ Me.path+"/bin/compile_schemas.sh" ];
    //let [ exit_status, stdout, stderr ] = Utils.execute(compile_schemas);

    this.settings = ExtensionUtils.getSettings();
    this.logger = new Logger('settings', this.settings);

    // if (exit_status !== 0) {
    //   this.logger.warn("Failed to compile schemas: %s\n%s", stdout, stderr);
    // } else {
    //   this.logger.debug("compile_schemas: %s", stdout);
    // }

  }

  // export_json() {
  //   this.logger.info("Export settings to json");
  //   var h={
  //     accel_enable: this.accel_enable,
  //     accel_show_endtime: this.accel_show_endtime,
  //     accel_stop_next: this.accel_stop_next,
  //     debug: this.debug,
  //     detect_dupes: this.detect_dupes,
  //     inhibit: this.inhibit,
  //     inhibit_max: this.inhibit_max,
  //     notification_sticky: this.notification_sticky,
  //     notification: this.notification,
  //     notification_longtimeout: this.notification_longtimeout,
  //     play_sound: this.play_sound,
  //     prefer_presets: this.prefer_presets,
  //     save_quick_timers: this.save_quick_timers,
  //     show_endtime: this.show_endtime,
  //     show_label: this.show_label,
  //     show_progress: this.show_progress,
  //     show_time: this.show_time,
  //     sort_by_duration: this.sort_by_duration,
  //     sort_descending: this.sort_descending,
  //     sound_file: this.sound_file,
  //     sound_loops: this.sound_loops,
  //     volume_level_warn: this.volume_level_warn,
  //     volume_threshold: this.volume_threshold,
  //     quick_timers: this.unpack_quick_timers([]),
  //     timers: this.unpack_preset_timers([])
  //   }
  //   return JSON.stringify(h, null, 2);
  // }

  // import_json(json) {
  //   this.logger.info("Import json to settings");
  //   var obj = JSON.parse(json.replace( /[\r\n]+/gm, " "));
  //   for (let [key, value] of Object.entries(obj)) {
  //     key=key.replace(/_/g, '-');
  //     this.logger.info("Import setting %s=%s (%s)", key, value, value.constructor.name);
  //     switch(key) {
  //       case 'timers':
  //         this.pack_preset_timers(value);
  //         break;
  //       case 'quick-timers':
  //         this.pack_quick_timers(value);
  //         break;
  //       case 'accel-show-endtime':
  //       case 'accel-stop-next':
  //       case 'sound-file':
  //         this.settings.set_string(key, value);
  //         break;
  //       case 'sound-loops':
  //       case 'notification-longtimeout':
  //       case 'prefer-presets':
  //       case 'inhibit':
  //       case 'inhibit-max':
  //         this.settings.set_int(key, value);
  //         break;
  //       default:
  //         this.settings.set_boolean(key, value);
  //         break;
  //     }

  //   }
  // }

  get_default(key) {
    return this.settings.get_default_value(key);
  }

  reset(key) {
    this.settings.reset(key);
  }

  get entries() {
    return this.settings.get_int('entries');
  }

  set entries(val) {
    this.settings.set_int(val);
  }

  get state() {
    return this.settings.get_string('state');
  }

  set state(str) {
    return this.settings.set_string('state', str);
  }

  get debug() {
    return this.settings.get_boolean('debug');
  }

  set debug(bool) {
    this.settings.set_boolean('debug', bool);
  }

  get show_histories() {
    return this.settings.get_boolean('show-histories');
  }

  set show_histories(bool) {
    this.settings.set_boolean('show-histories', bool);
  }

  get accel_enable() {
    return this.settings.get_boolean('accel-enable');
  }

  set accel_enable(bool) {
    this.settings.set_boolean('accel-enable', bool);
  }

  get accel_show_menu() {
    return this.settings.get_string('accel-show-menu');
  }

  set accel_show_menu(accel) {
    this.settings.set_string('accel-show-menu', accel);
  }

  get accel_show_history() {
    return this.settings.get_string('accel-show-history');
  }

  set accel_show_history(accel) {
    this.settings.set_string('accel-show-history', accel);
  }

  get accel_next() {
    return this.settings.get_string('accel-next');
  }

  set accel_next(accel) {
    return this.settings.set_string('accel-next', accel);
  }

};
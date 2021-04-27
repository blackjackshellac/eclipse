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

const Lang = imports.lang
const Meta = imports.gi.Meta
const Shell = imports.gi.Shell
const Main = imports.ui.main

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Logger = Me.imports.logger.Logger;
const Utils = Me.imports.utils;

var KeyboardShortcuts = class KeyboardShortcuts {
  constructor(settings) {
    this._settings = settings;
    /*
      this._grabbers[action] = {
        accel_id: <accel_id>,
        name: <name>,
        accelerator: <accelerator>,
        callback: <callback>
      }
    */
    this._grabbers = {};

    this.logger = new Logger('cl_kbshortcuts', settings);

    //log(Error().stack);
    this.logger.debug('Creating KeyboardShortcuts');
    global.display.connect('accelerator-activated', (display, action, deviceId, timestamp) => {
      this.logger.debug("Accelerator Activated: [display=%s, action=%s, deviceId=%s, timestamp=%s]",
        display, action, deviceId, timestamp);
      this._onAccelerator(action);
    });
  }

  listenFor(accel_id, accelerator, callback) {
    let [ action, grabber ] = this.lookupGrabber(accel_id);
    if (grabber) {
      this.remove(grabber.accel_id);
    }

    if (accelerator.length === 0) {
      // just removing accel_id, not updating
      return;
    }

    this.logger.debug('Trying to listen for shortcut %s [accelerator=%s]', accel_id, accelerator);
    action = global.display.grab_accelerator(accelerator, 0);
    if (action == Meta.KeyBindingAction.NONE) {
      this.logger.error('Unable to grab shortcut %s [%s]', accel_id, accelerator);
      return;
    }

    this.logger.debug('Grabbed shortcut %s [action=%s]', accel_id, action);
    let name = Meta.external_binding_name_for_action(action);
    this.logger.debug('Received binding name for action [name=%s, action=%s]', name, action);

    this.logger.debug('Requesting WM to allow binding [name=%s]', name);
    Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);

    this._grabbers[action]={
      accel_id: accel_id,
      name: name,
      accelerator: accelerator,
      callback: callback
    };
    //Utils.logObjectPretty(this._grabbers);
  }

  lookupGrabber(accel_id) {
    for (const [action, grabber] of Object.entries(this._grabbers)) {
      if (grabber.accel_id === accel_id) {
        return [ action, grabber ];
      }
    }
    return [ undefined, undefined ];
  }

  remove(accel_id) {
    let [ action, grabber ] = this.lookupGrabber(accel_id);

    if (grabber) {
      let name=grabber.name;
      if (name) {
        this.logger.debug('Requesting WM to remove binding [name=%s] accelerator=%s', name, grabber.accelerator);
        global.display.ungrab_accelerator(action);
        Main.wm.allowKeybinding(name, Shell.ActionMode.NONE);
        delete this._grabbers[action];
      }
    } else {
      this.logger.debug('grabber not found for accelerator=%s', accelerator);
    }
  }

  _onAccelerator(action) {
    let grabber = this._grabbers[action];

    if (grabber) {
      grabber.callback();
    } else {
      this.logger.debug('No listeners [action=%s]', action);
      //Utils.logObjectPretty(this._grabbers);
    }
  }
}



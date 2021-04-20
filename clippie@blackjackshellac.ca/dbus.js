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
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Logger = Me.imports.logger.Logger;
const DBusGpaste = Me.imports.dbus_gpaste;

const DBusGPasteProxy = Gio.DBusProxy.makeProxyWrapper(DBusGpaste.DBusGPasteIface);

var DBusGPaste = class DBusGPaste {
  constructor(settings) {
    this._settings = settings;
    this._elements = {};

    this.logger = new Logger('cl_dbus', settings);
    this._gpaste_proxy = new DBusGPasteProxy(Gio.DBus.session,
                                             'org.gnome.GPaste',
                                             '/org/gnome/GPaste');
  }

  // https://wiki.gnome.org/Gjs/Examples/DBusClient
  // get history synchronously
  getHistory() {
    let history = this.gpaste_proxy.GetHistorySync();
    if (history) {
      return history[0];
    }
    return [];
  }

  // get history asynchronously with callback
  getHistoryRemote(callback) {
    this.gpaste_proxy.GetHistoryRemote(callback);
  }

  getElement(uuid) {
    return this.gpaste_proxy.GetElementSync(uuid);
  }

  getElementKind(uuid) {
    try {
      let kind=this.gpaste_proxy.GetElementKindSync(uuid);
      return kind[0];
    } catch (e) {
      this.logger.error('getElementKind failed uuid=%s: %s', uuid, e.toString());
    }
    return undefined;
  }

  getElementAtIndex(idx) {
    try {
      let [ uuid, content ]=this.gpaste_proxy.GetElementAtIndexSync(idx);
      return [ uuid, content ];
    } catch (e) {
      this.logger.error('getElementAtIndex failed idx=%d: %s', idx, e.toString());
    }
    return undefined;

  }

  listHistories() {
    try {
      let list = this.gpaste_proxy.ListHistoriesSync();
      return list[0];
    } catch (e) {
      this.logger.error('failed to load histories: %s', e.toString());
    }
    return [];
  }

  getHistoryName() {
    try {
      let name = this.gpaste_proxy.GetHistoryNameSync();
      return name[0];
    } catch (e) {
      this.logger.error('failed to get current history name: %s', e.toString());
    }
    return undefined;
  }

  daemonReexec() {
    this.gpaste_proxy.ReexecuteSync();
  }

  setPassword(uuid, label) {
    this.gpaste_proxy.SetPasswordSync(uuid, label);
  }

  renamePassword(old_name, new_name) {
    try {
      this.logger.debug('rename password %s to %s', old_name, new_name);
      this.gpaste_proxy.RenamePasswordSync(old_name, new_name);
    } catch(e) {
      return false;
    }
    return true;
  }

  select(uuid) {
    try {
      this.gpaste_proxy.SelectSync(uuid);
    } catch(e) {
      this.logger.error("select failed for uuid=%s: %s", uuid, e.toString());
      return false;
    }
    return true;
  }

  delete(uuid) {
    try {
      this.gpaste_proxy.DeleteSync(uuid);
    } catch(e) {
      this.logger.error("delete failed for uuid=%s: %s", uuid, e.toString());
      return false;
    }
    return true;
  }

  get settings() {
    return this._settings;
  }

  set settings(val) {
    this._settings = val;
  }

  get gpaste_proxy() {
    return this._gpaste_proxy;
  }
}

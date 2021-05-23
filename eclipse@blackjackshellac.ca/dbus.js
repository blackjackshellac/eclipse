/*
 * eclipse GPaste interface with encryption
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

function detect_GPasteIface() {
  let sess=Gio.DBus.session
  let result=sess.call_sync(
      'org.gnome.GPaste',
      '/org/gnome/GPaste',
      'org.freedesktop.DBus.Introspectable',
      'Introspect',
      null, null,
      Gio.DBusCallFlags.NONE,
      -1,
      null);
  let result0=result.get_child_value(0);
  let DBusGPasteIface = result0.get_string()[0].trim();
  if (DBusGPasteIface.match('"org.gnome.GPaste2"')) {
    return 2;
  } else if (DBusGPasteIface.match('"org.gnome.GPaste1"')) {
    return 1;
  } else {
    return 0;
  }
}

var DBusGPasteVersions = {
  2: DBusGpaste.DBusGPasteIface,
  1: DBusGpaste.DBusGPaste1Iface,
  0: DBusGpaste.DBusGPasteIface
}

var DBusGPaste = class DBusGPaste {
  constructor(settings) {
    this._settings = settings;
    this._elements = {};

    this._version = detect_GPasteIface();
    let DBusGPasteIface = DBusGPasteVersions[this._version];
    let DBusGPasteProxy = Gio.DBusProxy.makeProxyWrapper(DBusGPasteIface);

    this.logger = new Logger('cl_dbus', settings);
    this.logger.debug('Detected interface org.gnome.GPaste%s', this.version);

    this._gpaste_proxy = new DBusGPasteProxy(Gio.DBus.session,
                                             'org.gnome.GPaste',
                                             '/org/gnome/GPaste');
  }

  get version() {
    return this._version;
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
    try {
      return this.gpaste_proxy.GetElementSync(uuid);
    } catch(e) {
      this.logger.error('getElement failed to get uuid=%s: %s', ""+uuid, e.toString());
      this.logger.debug(e.stack);
    }
    return undefined;
  }

  getElementKind(uuid) {
    try {
      let kind=this.gpaste_proxy.GetElementKindSync(uuid);
      return kind[0];
    } catch (e) {
      this.logger.error('getElementKind failed uuid=%s: %s', uuid, e.toString());
      this.logger.debug(e.stack);
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

  getHistorySize(name) {
    try {
      let size = this.gpaste_proxy.GetHistorySizeSync(name);
      return size;
    } catch (e) {
      this.logger.error('failed to get history %s size: %s', name, e.toString());
    }
    return undefined;
  }

  deleteHistory(name) {
    try {
      this.gpaste_proxy.DeleteHistorySync(name);
      return true;
    } catch (e) {
    }
    return false;
  }

  emptyHistory(name) {
    try {
      this.gpaste_proxy.EmptyHistorySync(name);
      return true;
    } catch (e) {
    }
    return false;
  }

  switchHistory(name) {
    try {
      this.gpaste_proxy.SwitchHistorySync(name);
      return true;
    } catch (e) {
    }
    return false;
  }

  daemonReexec() {
    this.gpaste_proxy.ReexecuteSync();
  }

  add(entry) {
    try {
      this.gpaste_proxy.AddSync(entry);
    } catch (e) {
      this.logger.error("Failed to add entry %s: %s", entry, e);
      return false;
    }
    return true;
  }

  addPassword(name, content) {
    try {
      this.gpaste_proxy.AddPasswordSync(name, content);
    } catch (e) {
      this.logger.error("Failed to add password entry %s: %s", name, e);
      return false;
    }
    return true;
  }

  setPassword(uuid, label) {
    this.gpaste_proxy.SetPasswordSync(uuid, label);
  }

  setPasswordAsync(uuid, label, callback) {
    try {
      this.gpaste_proxy.SetPasswordRemote(uuid, label, callback);
      return true;
    } catch (e) {
      this.logger.error('failed to set password for uuid=%s, label=%s');
    }
    return false;
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

  deletePassword(name) {
    try {
      this.logger.debug('delete password %s', name);
      this.gpaste_proxy.DeletePasswordSync(name);
    } catch(e) {
      this.logger.error('failed to delete password %s: %s', name, e.message);
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

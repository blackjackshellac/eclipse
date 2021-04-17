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
//const Logger = Me.imports.logger.Logger;

// Bus: org.gnome.GPaste
// Object path: /org/gnome/GPaste
// Interface: org.gnome.GPaste2

// GetHistory () ↦ (Array of [Struct of (String, String)] history)
// GetElement (String uuid) ↦ (String value)
// a(s,s)
const DBusGPasteIface = `
<node>
  <interface name="org.gnome.GPaste2">
    <method name="GetElement">
        <arg type="s" direction="in" />
        <arg type="s" direction="out" />
    </method>
    <method name="GetHistory">
        <arg type="a(ss)" direction="out" />
    </method>
  </interface>
</node>
`.trim();

const DBusGPasteProxy = Gio.DBusProxy.makeProxyWrapper(DBusGPasteIface);

var DBusGPaste = class DBusGPaste {
  constructor(settings) {
    this._settings = settings;
    this._elements = {};

    //this.logger = new Logger('cl_dbus', settings);
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

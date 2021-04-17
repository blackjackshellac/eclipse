
const { Gio, Gtk, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Logger = Me.imports.logger.Logger;

// Bus: org.gnome.GPaste
// Object path: /org/gnome/GPaste
// Interface: org.gnome.GPaste2

// GetHistory () ↦ (Array of [Struct of (String, String)] history)
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


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

  getHistory() {
    this._history = undefined;
    this._gpaste_proxy.GetHistoryRemote( history => {
      this.logger.debug("history=%s", typeof history);
      // for (let i=0; i < history.length; i++) {
      //   let entry = history[i];
      //   this.logger.debug("entry[%d]=%s entry[1]=[%s]", i, entry[0][0], entry[0][1]);
      // }
      //history[0]=entry[0],history[1]
      //history[1]=entry[0],history[2]

      this._history = history;
    });
    return this._history;
  }

  getElement(uuid) {
    this._gpaste_proxy.GetElementRemote(uuid, (element) => {
      this._element=element;
      this.logger.debug("in element[%s]=%s", uuid, this._element);
    });
    this.logger.debug("out element[%s]=%s", uuid, this._element);
    return this._element;
  }

  get settings() {
    return this._settings;
  }

  set settings(val) {
    this._settings = val;
  }

}

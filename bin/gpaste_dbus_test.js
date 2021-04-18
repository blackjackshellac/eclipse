#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const { Gio, Gtk, GLib } = imports.gi;
String.prototype.format = imports.format.format;

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
    <method name="GetElementKind">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="kind" direction="out">
      </arg>
    </method>
  </interface>
</node>
`.trim();

const DBusGPasteProxy = Gio.DBusProxy.makeProxyWrapper(DBusGPasteIface);

let _gpaste_proxy = new DBusGPasteProxy(Gio.DBus.session,
                                             'org.gnome.GPaste',
                                             '/org/gnome/GPaste');

let history=_gpaste_proxy.GetHistorySync();
let element=_gpaste_proxy.GetElementSync("98d19ed8-479e-4fc9-9e27-f5bb43c020d2");
print (element);

print(`history `+history.length);
let elements=history[0];
print("elements "+elements.length);
for (let element of elements) {
  print("%s>>%d".format(element[0], element[1].length));
}

function logObjectPretty(obj) {
  print(JSON.stringify(obj, null, 2));
}

let uuid='08325bb7-ab21-488e-86fb-1cb7d1d4266b';
let kind=_gpaste_proxy.GetElementKindSync(uuid);
print('kind=%s type=%s'.format(kind[0]), typeof (kind[0]));

logObjectPretty(kind);


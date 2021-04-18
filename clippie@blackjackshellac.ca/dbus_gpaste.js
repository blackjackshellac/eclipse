// Bus: org.gnome.GPaste
// Object path: /org/gnome/GPaste
// Interface: org.gnome.GPaste2

// GetHistory () ↦ (Array of [Struct of (String, String)] history)
// GetElement (String uuid) ↦ (String value)
// a(s,s)
var DBusGPasteIface = `
<node>
  <interface name="org.gnome.GPaste2">
    <method name="About">
    </method>
    <method name="Add">
      <arg type="s" name="text" direction="in">
      </arg>
    </method>
    <method name="AddFile">
      <arg type="s" name="file" direction="in">
      </arg>
    </method>
    <method name="AddPassword">
      <arg type="s" name="name" direction="in">
      </arg>
      <arg type="s" name="password" direction="in">
      </arg>
    </method>
    <method name="BackupHistory">
      <arg type="s" name="history" direction="in">
      </arg>
      <arg type="s" name="backup" direction="in">
      </arg>
    </method>
    <method name="Delete">
      <arg type="s" name="uuid" direction="in">
      </arg>
    </method>
    <method name="DeleteHistory">
      <arg type="s" name="name" direction="in">
      </arg>
    </method>
    <method name="DeletePassword">
      <arg type="s" name="name" direction="in">
      </arg>
    </method>
    <method name="EmptyHistory">
      <arg type="s" name="name" direction="in">
      </arg>
    </method>
    <method name="GetElement">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="value" direction="out">
      </arg>
    </method>
    <method name="GetElementAtIndex">
      <arg type="t" name="index" direction="in">
      </arg>
      <arg type="s" name="uuid" direction="out">
      </arg>
      <arg type="s" name="value" direction="out">
      </arg>
    </method>
    <method name="GetElementKind">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="kind" direction="out">
      </arg>
    </method>
    <method name="GetElements">
      <arg type="as" name="uuids" direction="in">
      </arg>
      <arg type="a(ss)" name="elements" direction="out">
      </arg>
    </method>
    <method name="GetHistory">
      <arg type="a(ss)" name="history" direction="out">
      </arg>
    </method>
    <method name="GetHistoryName">
      <arg type="s" name="name" direction="out">
      </arg>
    </method>
    <method name="GetHistorySize">
      <arg type="s" name="name" direction="in">
      </arg>
      <arg type="t" name="size" direction="out">
      </arg>
    </method>
    <method name="GetRawElement">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="value" direction="out">
      </arg>
    </method>
    <method name="GetRawHistory">
      <arg type="a(ss)" name="history" direction="out">
      </arg>
    </method>
    <method name="ListHistories">
      <arg type="as" name="histories" direction="out">
      </arg>
    </method>
    <method name="Merge">
      <arg type="s" name="decoration" direction="in">
      </arg>
      <arg type="s" name="separator" direction="in">
      </arg>
      <arg type="as" name="uuids" direction="in">
      </arg>
    </method>
    <method name="OnExtensionStateChanged">
      <arg type="b" name="extension-state" direction="in">
      </arg>
    </method>
    <method name="Reexecute">
    </method>
    <method name="RenamePassword">
      <arg type="s" name="old-name" direction="in">
      </arg>
      <arg type="s" name="new-name" direction="in">
      </arg>
    </method>
    <method name="Replace">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="contents" direction="in">
      </arg>
    </method>
    <method name="Search">
      <arg type="s" name="query" direction="in">
      </arg>
      <arg type="as" name="results" direction="out">
      </arg>
    </method>
    <method name="Select">
      <arg type="s" name="uuid" direction="in">
      </arg>
    </method>
    <method name="SetPassword">
      <arg type="s" name="uuid" direction="in">
      </arg>
      <arg type="s" name="name" direction="in">
      </arg>
    </method>
    <method name="ShowHistory">
    </method>
    <method name="SwitchHistory">
      <arg type="s" name="name" direction="in">
      </arg>
    </method>
    <method name="Track">
      <arg type="b" name="tracking-state" direction="in">
      </arg>
    </method>
    <method name="Upload">
      <arg type="s" name="uuid" direction="in">
      </arg>
    </method>
    <signal name="DeleteHistory">
      <arg type="s" name="history">
      </arg>
    </signal>
    <signal name="EmptyHistory">
      <arg type="s" name="history">
      </arg>
    </signal>
    <signal name="ShowHistory">
    </signal>
    <signal name="SwitchHistory">
      <arg type="s" name="history">
      </arg>
    </signal>
    <signal name="Update">
      <arg type="s" name="action">
      </arg>
      <arg type="s" name="target">
      </arg>
      <arg type="t" name="index">
      </arg>
    </signal>
    <property type="b" name="Active" access="read">
    </property>
    <property type="s" name="Version" access="read">
    </property>
  </interface>
</node>
`.trim();


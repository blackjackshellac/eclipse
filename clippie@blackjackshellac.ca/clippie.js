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

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, St, Clutter, Gio } = imports.gi;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Logger = Me.imports.logger.Logger;
const DBusGPaste = Me.imports.dbus.DBusGPaste;

var Clippie = class Clippie extends Array {
  constructor(...args) {
    super(...args);

    // id => clip
    this._lookup = {};
    this._state = {};

    this._settings = new Settings();
    this._attached = false;

    this.logger = new Logger('cl_ippie', this.settings);

    this.gpaste_client = Utils.exec_path('gpaste-client');
    if (this.gpaste_client === null) {
      this.notification('Error', this.logger.error('Failed to find gpaste-client program'),
        MessageTray.Urgency.CRITICAL,
        {gicon: Gio.icon_new_for_string('dialog-error')});
      this.gpaste_client = 'gpaste-client';
    } else {
      // this.notification('Info', this.gpaste_client,
      //   MessageTray.Urgency.NORMAL,
      //   {gicon: Gio.icon_new_for_string('dialog-information')});
    }
    this.gpaste_client_oneline = [ this.gpaste_client, '--oneline' ];
  }

  notification(title, banner, urgency=MessageTray.Urgency.NORMAL, params={}) {
    // notification
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);

    let notification = new MessageTray.Notification(source, title, banner, params);
    notification.setUrgency(urgency);
    source.showNotification(notification);
  }

  static attach(indicator) {
    // reload settings
    clippieInstance._settings = new Settings();

    clippieInstance.logger.settings = clippieInstance._settings;

    clippieInstance.logger.info("Attaching indicator, size=%d items", clippieInstance.length);

    clippieInstance.indicator = indicator;

    clippieInstance.attached = true;

    clippieInstance.restore_state();

    //clippieInstance.refresh();

    return clippieInstance;
  }

  static detach() {
    clippieInstance.logger.info("Detaching indicator from Clippie");
    clippieInstance.attached = false;
    clippieInstance.indicator = undefined;
    clippieInstance._dbus_gpaste = undefined;
  }

  get clippie() {
    return clippieInstance;
  }

  get attached() {
    return this._attached;
  }

  set attached(b) {
    this._attached = b;
  }

  get settings() {
    return this._settings;
  }

  set settings(v) {
    this._settings = v;
  }

  restore_state() {
    this._state = JSON.parse(this.settings.state);
  }

  get dbus_gpaste() {
    if (!this._dbus_gpaste) {
      this._dbus_gpaste = new DBusGPaste(this.settings);
    }
    return this._dbus_gpaste;
  }

  save_state() {
    this._state={};
    // for (let i=0; i < this.length; i++) {
    //   let clip = this[i];
    //   if (clip.lock) {
    //     this._state[clip.uuid] = { lock: true }
    //   }
    // }
    this.settings.state = JSON.stringify(this._state);
  }

  escapeRegex(string) {
    let escaped=string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    this.logger.debug("regex excaped "+escaped);
    return escaped;
  }

  search(filter) {
    if (!filter || filter.length == 0) {
      return this;
    }

    let filter_re=new RegExp(this.escapeRegex(filter), 'im');

    let entries = [];
    for (let i=0; i < this.length; i++) {
      let clip=this[i];
      if (clip.search(filter_re)) {
        entries.push(clip);
      }
    }
    return entries;
  }

  refresh_result(stdout) {
    let lines=stdout.replace(/\r?\n$/, "").split(/\r?\n/);
    let arr = [];
    for (let i=0; i < lines.length; i++) {
      let line=lines[i];
      if (line.length > 0) {
        let clip=Clip.parse(line);
        if (!clip) {
          this.logger.error("failed to parse output=%s", line);
          continue;
        }
        let idx = this.find(clip);
        if (idx >= 0) {
          //this.logger.debug('clip already exists at idx=%d %s=%s', idx, clip.uuid, this[idx].uuid);
          clip = this[idx];
          if (clip.lock) {
            this.logger.debug('Found lock entry %s', clip.toString());
          }
        }
        //this.logger.debug('Adding clip=[%s] (lock=%s)', clip.uuid, clip.lock);
        if (this._state[clip.uuid]) {
          clip.lock = this._state[clip.uuid].lock;
        }
        arr[i] = clip;
        this.menu.add_item(clip);
      }
    }
    for (let i=0; i < arr.length; i++) {
      this[i]=arr[i];
    }
    this.length = arr.length;
  }

  // Obsolete: Asynchronous refresh replaced by refresh_dbus()
  refresh_async(menu) {
    this.menu = menu;

    Utils.execCommandAsync(this.gpaste_client_oneline).then(stdout => {
      this.refresh_result(stdout);
    });
  }

  // Asynchronous gpaste dbus GetHistory refresh
  refresh_dbus(menu) {
    this.menu = menu;
    this.dbus_gpaste.getHistoryRemote( (history) => {
      if (history.length === 0) {
        return;
      }
      history = history[0];
      this.logger.debug("history %d", history.length);
      for (let i=0; i < history.length; i++) {
        let entry=history[i];
        //this.logger.debug("%03d>%s:%d", i, entry[0], entry[1].length);
        let clip = new Clip(entry[0], entry[1]);
        let idx = this.find(clip);
        if (idx >= 0) {
          clip = this[idx];
          if (idx !== i) {
            //this.logger.debug('moving clip from %d to %d: %s', idx, i, clip.uuid);
            // remove it from its old location
            this.splice(idx, 1);
            // move it to the current location
            this.splice(i, 0, clip);
          }
        } else {
          //this.logger.debug("New clip uuid=%s", clip.uuid);
          // add the new clip at this location
          this.splice(i, 0, clip);
        }
        //this.logger.debug('Adding clip=[%s] (lock=%s)', clip.uuid, clip.lock);
        if (this._state[clip.uuid]) {
          clip.lock = this._state[clip.uuid].lock;
        }
        if (clip.lock) {
          this.logger.debug('Found lock entry %s', clip.toString());
          if (!clip.isPassword()) {
            this.logger.warn('Found locked entry %s that it not saved as a password, unlocking', clip.uuid)
            clip.lock = false;
          }
        }
        this.menu.add_item(clip);
      }
      this.length = history.length;
    });
  }

  // Obsolete: Synchronous refresh replaced by refresh_async() and then refresh_dbus()
  refresh() {
    let result = Utils.execute(this.gpaste_client_oneline);
    if (result[0] != 0) {
      this.logger.error("Failed to execute %s", this.gpaste_client_oneline.join(" "));
      return;
    }

    let lines=result[1].replace(/\r?\n$/, "").split(/\r?\n/);
    let arr = [];
    for (let i=0; i < lines.length; i++) {
      let line=lines[i];
      if (line.length > 0) {
        let clip=Clip.parse(line);
        if (!clip) {
          this.logger.error("failed to parse output=%s", line);
          continue;
        }
        let idx = this.find(clip);
        if (idx >= 0) {
          this.logger.debug('clip already exists at idx=%d %s=%s', idx, clip.uuid, this[idx].uuid);
          clip = this[idx];
          if (clip.lock) {
            this.logger.debug('Found lock entry %s', clip.toString());
          }
        }
        this.logger.debug('Adding clip=[%s] (lock=%s)', clip.uuid, clip.lock);
        if (this._state[clip.uuid]) {
          clip.lock = this._state[clip.uuid].lock;
          delete this._state[clip.uuid];
        }
        arr[i] = clip;
      }
    }
    for (let i=0; i < lines.length; i++) {
      this[i]=arr[i];
    }
    this.length = lines.length;
  }

  find(clip) {
    return this.findIndex(c => c.uuid === clip.uuid);
  }

  has(clip) {
    return this.some(c => c.uuid === clip.uuid);
  }

  delete(clip) {
    let idx = this.find(clip);
    if (idx >= -1) {
      this.splice(idx, 1);
    }
  }

}

// clippie is a singleton class
var clippieInstance = new Clippie();

const GPASTE_LINE_RE=/^([-0-9a-f]+):\s(.*$)/;
const PASSWORD_NAME_RE=/\[.*?\](.*)$/

var Clip = class Clip {

  constructor(uuid, content=undefined) {
    this._uuid = uuid;
    this._content = content;
    this._menu_item = undefined; // clippie menu
    this.logger = clippieInstance.logger;
    this._kind = this.dbus_gpaste.getElementKind(this.uuid);
    this._lock = this.isPassword();
    if (this._lock) {
      this._password_name = this.get_password_name(content);
      this._content = "▷▷▷ "+content;
    }
  }

  static parse(line) {
    let m = line.match(GPASTE_LINE_RE);
    if (m) {
      return new Clip(m[1], m[2]);
    }
    return undefined;
  }

  get clippie() {
    return clippieInstance;
  }

  get settings() {
    return clippieInstance.settings;
  }

  // Obsolite
  get gpaste_client() {
    return clippieInstance.gpaste_client;
  }

  get dbus_gpaste() {
    return clippieInstance.dbus_gpaste;
  }

  get uuid() {
    return this._uuid;
  }

  get password_name() {
    return this._password_name;
  }

  get_password_name(content) {
    let m = content.match(PASSWORD_NAME_RE)
    if (m) {
      return m[1].trim();
    }
    return content;
  }

  isPassword() {
    if (this._kind === 'Password') {
      this.logger.debug('%s is a password: %s', this.uuid, this.content);
      return true;
    }
    return false;
  }

  refresh() {
    if (!this._content) {
      let content = this.dbus_gpaste.getElement(this.uuid);
      if (content) {
        this.content = content;
      } else {
        this.logger.error('Failed to refresh content for uuid %s', this.uuid);
      }
    }
  }

  get content() {
    if (!this._content) {
      this.logger.debug("Refreshing %s", this.uuid);
      this.refresh();
    }
    return this._content
  }

  set content(val) {
    this._content = val;
  }

  get lock() {
    return this._lock;
  }

  set lock(b) {
    this._lock = b;
  }

  get menu_item() {
    return this._menu_item;
  }

  set menu_item(m) {
    this._menu_item = m;
  }

  label_text() {
    var label = this.content.trim().replaceAll(/\n/gm, '↲'); // ¶↲
    label = label.replaceAll(/\s+/g, ' ');
    label = label.substring(0, 50);
    label = this.lock ? label.trim() : label.trim();
    return label;
  }

  // can't toggle lock any more
  // toggle_lock() {
  //   this._lock = !this._lock;
  //   clippieInstance.save_state();
  // }

  select() {
    this.dbus_gpaste.select(this.uuid);
    return true;
  }

  delete() {
    this.dbus_gpaste.delete(this.uuid);
    return true;
  }

  toString() {
    return "uuid=%s".format(this.uuid);
  }

  search(filter_re) {
    let m = this.content.match(filter_re);
    return (m) ? true : false;
  }

  set_password(label) {
    label = label.trim();
    if (label.length === 0) {
      return false;
    }
    if (this.lock) {
      // already locked, rename password

      if (this.password_name === label) {
        return true;
      }

      let cmdargs = [ this.gpaste_client, 'rename-password', this.password_name, label ];
      let [ exit_status , stdout, stderr ] = Utils.execute(cmdargs);
      if (exit_status === 0) {
        this.logger.debug("Renamed password [%s] to [%s]", this.password_name, label);
        clippieInstance.length = 0;
      } else {
        this.logger.error("Failed to rename password %s to %s", this.password_name, label)
      }
      // if (clippieInstance.dbus_gpaste.renamePassword(this.password_name, label)) {
      //   this._password_name = label;
      //   clippieInstance.length = 0;
      // }

    } else {
      // unlocked, convert clipboard entry to password

      // get the index of the clip before setting as password
      let idx = clippieInstance.indexOf(this);

      clippieInstance.dbus_gpaste.setPassword(this.uuid, label);
      this.menu_item.trash_self();
      this.lock = true;

      // seems to replace the item at the same index with a new uuid
      if (idx >= 0) {
        let [uuid, content] = clippieInstance.dbus_gpaste.getElementAtIndex(idx);
        if (uuid) {
          let clip=new Clip(uuid, content);
          clippieInstance.push(clip);
          clippieInstance.dbus_gpaste.select(uuid);
        }
      }

    }
    return true;
  }
}



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

  save_state() {
    this._state={};
    for (let i=0; i < this.length; i++) {
      let clip = this[i];
      if (clip.lock) {
        this._state[clip.uuid] = { lock: true }
      }
    }
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

  refresh_async(menu) {
    this.menu = menu;

    Utils.execCommandAsync(this.gpaste_client_oneline).then(stdout => {
      this.refresh_result(stdout);
    });
  }

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

var Clip = class Clip {

  constructor(uuid, content=undefined) {
    this._uuid = uuid;
    this._content = content;
    this._lock = false;
    this._menu_item = undefined; // clippie menu
    this.logger = clippieInstance.logger;
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

  get gpaste_client() {
    return clippieInstance.gpaste_client;
  }

  get uuid() {
    return this._uuid;
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

  get settings() {
    return clippieInstance.settings;
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

  refresh() {
    if (!this.content) {
      // gpaste-client get --oneline uuid
      let cmdargs = [ this.gpaste_client, "get", "--oneline", this.uuid ];
      let result = Utils.execute(cmdargs);
      if (result[0] == 0) {
        this.content = result[1];
      } else {
        this.logger.error("uuid not in gpaste: %s", this.uuid);
      }
    }
  }

  label_text() {
    //var label = this.content.substring(0, 50);
    // TODO (Issue #7) not sure why this isn't replacing \n with the given character
    var label = this.content.replaceAll(/\n/gm, '↲'); // ¶↲
    label = label.replaceAll(/\s+/g, ' ');
    label = label.substring(0, 50);
    label = this._lock ? label.replaceAll(/./g, '·') : label.trim();
    return label;
  }

  toggle_lock() {
    this._lock = !this._lock;
    clippieInstance.save_state();
  }

  select() {
    // gpaste-client select <uuid>
    let cmdargs = [ this.gpaste_client, "select", this.uuid ];
    let result = Utils.execute(cmdargs);
    if (result[0] == 0) {
      return true;
    }
    this.logger.error("uuid not in gpaste: %s", this.uuid);
    return false;
  }

  delete() {
    let cmdargs = [ this.gpaste_client, "delete", this.uuid ];
    let result = Utils.execute(cmdargs);
    if (result[0] == 0) {
      this.logger.debug('%s deleted uuid=%s', this.gpaste_client, this.uuid);
      this.clippie.delete(this);
      return true;
    }
    this.logger.error("uuid not in gpaste: %s", this.uuid);
    return false;
  }

  toString() {
    return "uuid=%s".format(this.uuid);
  }

  search(filter_re) {
    let m = this.content.match(filter_re);
    return (m) ? true : false;
  }
}



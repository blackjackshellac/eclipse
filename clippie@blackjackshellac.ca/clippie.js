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

const {GLib, St, Clutter, Gio} = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Logger = Me.imports.logger.Logger;

var Clippie = class Clippie extends Array {
  constructor(...args) {
    super(...args);

    // id => clip
    this._lookup = {};

    this._settings = new Settings();
    this._attached = false;

    this.logger = new Logger('clippie', this.settings);
  }

  static attach(indicator) {
    // reload settings
    clippieInstance._settings = new Settings();

    clippieInstance.logger.settings = clippieInstance._settings;

    clippieInstance.logger.info("Attaching indicator");

    clippieInstance.indicator = indicator;

    clippieInstance.attached = true;

    clippieInstance.refresh();

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

  refresh() {
    let cmdargs = [ "gpaste-client", "--oneline"];
    let result = Utils.execute(cmdargs);
    if (result[0] != 0) {
      this.logger.error("Failed to execute %s", cmdargs.join(" "));
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
        }
        this.logger.debug('Adding clip=[%s] (password=%s)', clip.uuid, clip.password);
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
    this._password = false;
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

  get password() {
    return this._password;
  }

  refresh() {
    if (!this.content) {
      // gpaste-client get --oneline uuid
      let cmdargs = [ "gpaste-client", "get", "--oneline", this.uuid ];
      let result = Utils.execute(cmdargs);
      if (result[0] == 0) {
        this.content = result[1];
      } else {
        this.logger.error("uuid not in gpaste: %s", this.uuid);
      }
    }
  }

  label_text() {
    var label = this.content.substring(0, 50);
    label = this._password ? label.replaceAll(/./g, '·') : label.trim();
    return label;
  }

  toggle_password() {
    this._password = !this._password;
  }

  select() {
    // gpaste-client select <uuid>
    let cmdargs = [ "gpaste-client", "select", this.uuid ];
    let result = Utils.execute(cmdargs);
    if (result[0] == 0) {
      return true;
    }
    this.logger.error("uuid not in gpaste: %s", this.uuid);
    return false;
  }

  delete() {
    let cmdargs = [ "gpaste-client", "delete", this.uuid ];
    let result = Utils.execute(cmdargs);
    if (result[0] == 0) {
      this.logger.debug('gpaste-client deleted uuid=%s', this.uuid);
      this.clippie.delete(this);
      return true;
    }
    this.logger.error("uuid not in gpaste: %s", this.uuid);
    return false;
  }

  toString() {
    return "uuid=%s".format(this.uuid);
  }
}



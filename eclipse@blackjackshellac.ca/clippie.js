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

const GETTEXT_DOMAIN = 'eclipse-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, St, Clutter, Gio } = imports.gi;
const ByteArray = imports.byteArray;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Logger = Me.imports.logger.Logger;
const DBusGPaste = Me.imports.dbus.DBusGPaste;
const KeyboardShortcuts = Me.imports.keyboard_shortcuts.KeyboardShortcuts;

var Clippie = class Clippie {
  constructor() {
    this._clips = [];
    this._cur_clip = 0;

    // id => clip
    this._lookup = {};
    this._state = {};

    this._settings = new Settings();
    this._attached = false;
    this._accel = new KeyboardShortcuts(this.settings);

    this.logger = new Logger('cl_ippie', this.settings);

    this.logger.debug('Instantiating Clippie');

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

    this.openssl = Utils.exec_path('openssl');
    if (this.openssl === null) {
      this.logger.error('openssl not found');
    } else {
      // use -A -a for oneline ascii armoured output
      this.openssl_enc_args = (this.openssl+' enc -aes-256-cbc -pbkdf2 -A -a -pass stdin').trim().split(/\s+/);
      this.openssl_dec_args = (this.openssl+' enc -aes-256-cbc -pbkdf2 -d -A -a -pass stdin').trim().split(/\s+/);
    }
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

    clippieInstance.logger.info("Attaching indicator, size=%d items", clippieInstance.clips.length);

    clippieInstance._indicator = indicator;

    clippieInstance.attached = true;

    clippieInstance.restore_state();

    //clippieInstance.refresh();

    clippieInstance.settings_changed_signals();

    clippieInstance.toggle_keyboard_shortcuts();

    clippieInstance.refresh_eclips_async();

    return clippieInstance;
  }

  static detach() {
    clippieInstance.logger.info("Detaching indicator from Clippie");
    clippieInstance.attached = false;
    clippieInstance._indicator = undefined;
    clippieInstance._dbus_gpaste = undefined;
    clippieInstance.disable_keyboard_shortcuts();
  }

  settings_changed_signals() {
    this.settings.settings.connect('changed::accel-enable', () => {
      this.toggle_keyboard_shortcuts();
    });
    this.settings.settings.connect('changed::accel-show-menu', () => {
      if (this.settings.accel_show_menu.length > 0) {
        this.enable_keyboard_shortcuts(['accel-show-menu']);
      } else {
        this._accel.remove('accel-show-menu');
      }
    });
    this.settings.settings.connect('changed::accel-show-history', () => {
      this.enable_keyboard_shortcuts(['accel-show-history']);
    });
    this.settings.settings.connect('changed::accel-next', () => {
      this.enable_keyboard_shortcuts(['accel-next']);
    });
  }

  toggle_keyboard_shortcuts() {
    if (this.settings.accel_enable) {
      this.enable_keyboard_shortcuts();
    } else {
      this.disable_keyboard_shortcuts();
    }
  }

  enable_keyboard_shortcuts(accel_ids=['accel-show-menu', 'accel-show-history', 'accel-next']) {
    if (accel_ids.includes('accel-show-menu')) {
      this._accel.listenFor('accel-show-menu', this.settings.accel_show_menu, () => {
        //this.logger.debug("Show clippie menu");
        this.indicator.clippie_menu.open();
      });
    }

    if (accel_ids.includes('accel-show-history')) {
      this._accel.listenFor('accel-show-history', this.settings.accel_show_history, () => {
        //this.logger.debug("Show clippie history");
        this.indicator.clippie_menu.open({history:true});
      });
    }

    if (accel_ids.includes('accel-next')) {
      this._accel.listenFor('accel-next', this.settings.accel_next, () => {
        this.indicator.clippie_menu.open();
        this.logger.debug("Select clip %d in history: %d", this.cur_clip+1, this.clips.length);
        let clip = this.get_next_clip();
        if (clip !== undefined) {
          this.logger.debug("Select clip %d in history: %s", this.cur_clip, clip.label_text());
          clip.menu_item.select();
        } else {
          this.logger.debug("No clips %s", clip);
        }
      });
    }
  }

  disable_keyboard_shortcuts() {
    this._accel.remove('accel-show-menu');
    this._accel.remove('accel-show-history');
    this._accel.remove('accel-next');
  }

  get clippie() {
    return clippieInstance;
  }

  get clips() {
    return this._clips;
  }

  set clips(clips) {
    this._clips = clips;
  }

  get cur_clip() {
    return this._cur_clip;
  }

  set cur_clip(idx) {
    this.logger.debug('clip %d %d', idx, this._cur_clip);
    if (idx >= this.clips.length) {
      idx = 0;
    }
    this._cur_clip = idx;
  }

  inc_cur_clip() {
    this.cur_clip = this.cur_clip+1;
    return this.cur_clip;
  }

  get_next_clip() {
    if (this.clips.length === 0) {
      return undefined;
    }
    return this.clips[this.inc_cur_clip()];
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

  get indicator() {
    return this._indicator;
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
    // for (let i=0; i < this.clips.length; i++) {
    //   let clip = this.clips[i];
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
    if (!filter || filter.trim().length === 0) {
      return this.clips;
    }

    let filter_re=new RegExp(this.escapeRegex(filter), 'im');

    let entries = [];
    for (let i=0; i < this.clips.length; i++) {
      let clip=this.clips[i];
      if (clip.search(filter_re)) {
        entries.push(clip);
      }
    }
    return entries;
  }

  refresh_result(stdout) {
    let lines=stdout.replace(/\r?\n$/, "").split(/\r?\n/);
    let clips = [];
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
          //this.logger.debug('clip already exists at idx=%d %s=%s', idx, clip.uuid, this.clips[idx].uuid);
          clip = this.clips[idx];
          if (clip.lock) {
            this.logger.debug('Found lock entry %s', clip.toString());
          }
        }
        //this.logger.debug('Adding clip=[%s] (lock=%s)', clip.uuid, clip.lock);
        if (this._state[clip.uuid]) {
          clip.lock = this._state[clip.uuid].lock;
        }
        clips[i] = clip;
        this.menu.add_item(clip);
      }
    }
    this.clips = clips;
  }

  // Obsolete: Asynchronous refresh replaced by refresh_dbus()
  refresh_async(menu) {
    this.menu = menu;

    Utils.execCommandAsync(this.gpaste_client_oneline).then(result => {
      let ok = result[0];
      let stdout = result[1];
      let stderr = result[2];
      if (ok) {
        this.refresh_result(stdout);
      } else {
        this.logger.error("%s failed: %s", this.gpaste_client_oneline.join(' '), stderr);
      }
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
      let clips = [];
      let eclipsed_uuids = [];
      this.logger.debug("history %d", history.length);
      for (let i=0; i < history.length; i++) {
        let [uuid, content]=history[i];

        //this.logger.debug('uuid=%s', uuid);
        if (eclipsed_uuids.includes(uuid)) {
          this.logger.debug('%s entry is eclipsed', uuid);
          // delete uuid here (or below?)
          // TODO this.dbus_gpaste.delete(uuid);
          continue;
        }

        // find clip with this uuid (if any)
        let clip = this.find_uuid(uuid);
        if (clip === undefined) {
          // clip not found in clips, create a new one
          clip = new Clip(uuid, content);
        }
        if (clip.isEclipsed()) {
          //this.logger.debug("%s eclipsed: %s [%s]", clip.uuid, clip.content, clip.eclipsed);
          eclipsed_uuids.push(clip.eclipsed_uuid);
        }
        clips.push(clip);
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
      this.clips = clips;
      for (uuid of eclipsed_uuids) {
        this.logger.debug('deleting eclipsed uuid=%s', uuid);
        // TODO this.dbus_gpaste.delete(uuid);
      }
    });
  }

  refresh_eclips_async(menu=undefined) {
    if (this.settings.save_eclips === false) {
      return;
    }
    this.menu = menu;
    // use async version in refresh
    let dir = Gio.file_new_for_path(this.settings.save_eclips_path);
    dir.enumerate_children_async("standard::*", Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, null, (dir, res) => {
      let dir_enumerator = dir.enumerate_children_finish(res);
      // Gio.FileInfo or null
      do {
        let file_info = dir_enumerator.next_file(null);
        if (file_info == null) {
          break;
        }
        let file_name = file_info.get_name();
        if (file_name.endsWith('.eclip')) {
          this.logger.debug("eclip name=%s", file_name);

          let path = GLib.build_filenamev( [ this.settings.save_eclips_path, file_name ] );
          try {
            let gfile = Gio.file_new_for_path(path);
            let stream = gfile.read(null);
            let size = gfile.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null).get_size();
            let data = stream.read_bytes(size, null).get_data();
            let eclip = ByteArray.toString(data);

            this.logger.debug("read size=%d eclip=%s", size, eclip);
            let uuid = Utils.uuid();
            let clip = new Clip(uuid, eclip, 'eClip');
            if (this.menu) {
              this.menu.add_item(clip);
            } else {
              // just testing without menu
              this.logger.debug("clip=%s", clip.toString());
            }
          } catch(e) {
            this.logger.error("Failed to read eclip %s [%s]", path, e.message);
          }
        }
      } while(true);
    });
  }

  // Obsolete: Synchronous refresh replaced by refresh_async() and then refresh_dbus()
  // refresh() {
  //   let result = Utils.execute(this.gpaste_client_oneline);
  //   if (result[0] != 0) {
  //     this.logger.error("Failed to execute %s", this.gpaste_client_oneline.join(" "));
  //     return;
  //   }

  //   let lines=result[1].replace(/\r?\n$/, "").split(/\r?\n/);
  //   let clips = [];
  //   for (let i=0; i < lines.length; i++) {
  //     let line=lines[i];
  //     if (line.length > 0) {
  //       let clip=Clip.parse(line);
  //       if (!clip) {
  //         this.logger.error("failed to parse output=%s", line);
  //         continue;
  //       }
  //       let idx = this.find(clip);
  //       if (idx >= 0) {
  //         this.logger.debug('clip already exists at idx=%d %s=%s', idx, clip.uuid, this.clips[idx].uuid);
  //         clip = this.clips[idx];
  //         if (clip.lock) {
  //           this.logger.debug('Found lock entry %s', clip.toString());
  //         }
  //       }
  //       this.logger.debug('Adding clip=[%s] (lock=%s)', clip.uuid, clip.lock);
  //       if (this._state[clip.uuid]) {
  //         clip.lock = this._state[clip.uuid].lock;
  //         delete this._state[clip.uuid];
  //       }
  //       clips[i] = clip;
  //     }
  //   }
  //   this.clips = clips;
  // }

  find(clip) {
    return this.clips.findIndex(c => c.uuid === clip.uuid);
  }

  find_uuid(uuid) {
    this.clips.find(c => c.uuid === uuid);
  }

  has(clip) {
    return this.clips.some(c => c.uuid === clip.uuid);
  }

  delete(clip) {
    let idx = this.find(clip);
    if (idx >= -1) {
      this.clips.splice(idx, 1);
    }
  }

}

// clippie is a singleton class
var clippieInstance = new Clippie();

const GPASTE_LINE_RE=/^([-0-9a-f]+):\s(.*$)/;
const PASSWORD_NAME_RE=/\[.*?\](.*)$/

var Clip = class Clip {

  constructor(uuid, content, kind=undefined) {
    this.logger = clippieInstance.logger;
    this._uuid = uuid;
    this._menu_item = undefined; // clippie menu

    //this.logger.debug('%s: %s', uuid, content);

    let res = Clip.declipser(content);

    /*
      if it is encrypted the entry will be label,eclipsed_uuid, eclipsed data
    */
    this._content = res[0];
    this._eclipsed_uuid = res[1];
    this._eclipsed = res[2];

    if (this.eclipsed) {
      // TODO delete uuid this._eclipsed_uuid
      // gpaste delete(this._eclipsed_uuid);
    }

    this._kind = kind === undefined ? this.dbus_gpaste.getElementKind(this.uuid) : kind;
    this._lock = this.isPassword();
    if (this._lock) {
      this._password_name = this.get_password_name(content);
      this._content = "▷ "+content;
    }
  }

  static parse(line) {
    let m = line.match(GPASTE_LINE_RE);
    if (m) {
      this.logger.debug('parsed %s: %s', m[1], m[2]);
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

  get eclipsed() {
    return this._eclipsed;
  }

  get eclipsed_uuid() {
    return this._eclipsed_uuid;
  }

  isEclipsed() {
    return this.eclipsed !== undefined;
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
      } else {
        this.logger.error("Failed to rename password %s to %s", this.password_name, label)
      }
    } else {
      // unlocked, convert clipboard entry to password

      // get the index of the clip before setting as password
      let idx = clippieInstance.clips.indexOf(this);

      clippieInstance.dbus_gpaste.setPassword(this.uuid, label);
      this.menu_item.trash_self();
      this.lock = true;

      // seems to replace the item at the same index with a new uuid
      if (idx >= 0) {
        let [uuid, content] = clippieInstance.dbus_gpaste.getElementAtIndex(idx);
        if (uuid) {
          let clip=new Clip(uuid, content);
          clippieInstance.clips.push(clip);
          clippieInstance.dbus_gpaste.select(uuid);
        }
      }
    }
    return true;
  }

  // add gpaste entry with ~~eclipse~~label~~this.uuid~~eclipse~~
  eclipser(label, eclipse) {
    let str= "~~eclipse~~%s~~%s~~%s~~".format(label, this.uuid, eclipse);
    //this.logger.debug("eclipser:"+str);
    return str;
  }

  static declipser(content) {
    const declipse_re = /^~~eclipse~~(.*?)~~(.*?)~~(.*?)~~/m;
    let m = content.match(declipse_re);
    if (m) {
      let label = m[1];
      let eclipsed_uuid = m[2];
      let eclipse = m[3];
      //this.logger.debug('declipser: %s "%s" eclipse=[%s]', eclipsed_uuid, label, eclipse);
      return [ label, eclipsed_uuid, eclipse ];
    }
    //this.logger.debug('content not encrypted: %s', content);
    // not encrypted, so content is itself
    return [ content, undefined, undefined ];
  }

  /*
    Encryption test phrase
    # encrypt secret password with pin 'super secret passphrase' as first line of data to stdin for openssl
    $ echo -en "super secret passphrase\nencrypt this secret" | openssl enc -aes-256-cbc -pbkdf2 -a -pass stdin
    U2FsdGVkX19AY8pFZ+HcRtZhXBy0m+/MvPVmdM4mJ6HHoKREUNh7M1LUHSJHQ+vt
  */
  encrypt(label, passphrase, callback) {
    // openssl enc -aes-256-cbc -pbkdf2 -a -pass stdin
    if (!clippieInstance.openssl) {
      return this.logger.error(_('openssl not found'));
    }
    if (!passphrase || passphrase.trim().length === 0) {
      return this.logger.error(_('will not encrypt without passphrase'));
    }

    let cmdargs=clippieInstance.openssl_enc_args.join(' ');
    // passphrase is piped as first line of data to openssl
    let data=passphrase+"\n"+this.content;
    //this.logger.debug("%s | %s", data, );
    this.logger.debug("encrypt content | %s", cmdargs);
    Utils.execCommandAsync(clippieInstance.openssl_enc_args, data).then((result) => {
      let ok = result[0];
      let stdout = result[1];
      let stderr = result[2];
      let status = result[3];
      if (ok && status === 0) {
        //this.logger.debug("Encrypted %s [%s]", label, stdout);
        // test decryption with same password
        clippieInstance.dbus_gpaste.add(this.eclipser(label, stdout.trimEnd()));
        // TODO trash this
      } else {
        ok = false;
        this.logger.error("%s failed status=%d: %s", cmdargs, status, stderr);
      }
      callback(ok, stderr);
    });
    return undefined;
  }

  /*
    # successfully decrypt secret with good pin
    $ echo -e "super secret passphrase\nU2FsdGVkX19AY8pFZ+HcRtZhXBy0m+/MvPVmdM4mJ6HHoKREUNh7M1LUHSJHQ+vt" | openssl enc -aes-256-cbc -pbkdf2 -d -a -pass stdin
    encrypt this secret
    $ echo $?
    0
  */
  decrypt(passphrase, callback) {
    if (!clippieInstance.openssl) {
      return this.logger.error('openssl not found');
    }
    if (!passphrase || passphrase.trim().length === 0) {
      return this.logger.error('can not decrypt without passphrase');
    }
    // passphrase is piped as first line of data to openssl
    let cmdargs = clippieInstance.openssl_dec_args.join(' ');
    let data=passphrase+"\n"+this.eclipsed+"\n";
    this.logger.debug("decrypt content | %s", cmdargs);
    Utils.execCommandAsync(clippieInstance.openssl_dec_args, data).then((result) => {
      let ok = result[0];
      let stdout = result[1];
      let stderr = result[2].trimEnd();
      let status = result[3];
      if (ok && status == 0) {
        //this.logger.debug("ok=%s stdout=[%s] stderr=[%s] status=[%d]", ok, stdout, stderr, status);
        clippieInstance.dbus_gpaste.addPassword(this.content, stdout.trimEnd());
      } else {
        this.logger.debug("%s failed status=%d: %s", cmdargs, status, stderr);
        ok = false;
      }
      callback(ok, stderr);
    });
    return undefined;
  }
}



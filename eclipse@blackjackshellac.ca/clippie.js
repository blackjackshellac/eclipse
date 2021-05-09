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

var clippieInstance;

var Clippie = class Clippie {
  constructor() {
    this._clips = [];
    this._cur_clip = 0;

    // id => clip
    this._lookup = {};
    this._state = {};

    this._settings = new Settings();
    this._attached = false;
    this.logger = new Logger('cl_ippie', this.settings);
    this._accel = new KeyboardShortcuts(this.settings);

    this.logger.debug('Instantiating Clippie');
    if (clippieInstance) {
      this.logger.debug('Clippie is already instantiated');
    }
    clippieInstance = this;
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

    this._openssl = this.openssl;
  }

  notification(title, banner, urgency=MessageTray.Urgency.NORMAL, params={}) {
    // notification
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);

    let notification = new MessageTray.Notification(source, title, banner, params);
    notification.setUrgency(urgency);
    source.showNotification(notification);
  }

  attach(indicator) {
    // reload settings
    if (this.attached) {
      return this;
    }

    this._settings = new Settings();

    this.logger.settings = this._settings;

    this.logger.debug("Attaching indicator, size=%d items", this.clips.length);

    this._indicator = indicator;

    this.attached = true;

    this.restore_state();

    //this.refresh();

    this.settings_changed_signals();

    this.enable_keyboard_shortcuts();

    this.cached_pass = this.settings.cache_password ? '' : undefined;

    return this;
  }

  detach() {
    if (this.attached) {
      this.logger.debug("Detaching indicator from Clippie");
      this.attached = false;
      this._indicator = undefined;
      this._dbus_gpaste = undefined;
      this.cached_pass = undefined;
      this.disable_keyboard_shortcuts();

      // clear the clips
      this.logger.debug("Clearing %d clips", this.clips.length);
      for (let i=0; i < this.clips.length; i++) {
        this.clips[i]=undefined;
      }
      this.clips = [];
      this.cur_clip = 0;

      clippieInstance = undefined;
      this._settings = undefined;
    }
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

    this.settings.settings.connect('changed::cache-password', () => {
      let cache_password = this.settings.cache_password;
      this.logger.debug('cache password=%s', cache_password);
      this.cached_pass = cache_password ? '' : undefined;
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
    return this;
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
    //this.logger.debug('clip %d %d', idx, this._cur_clip);
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

  get openssl() {
    if (!this._openssl) {
      this._openssl = Utils.exec_path('openssl');
      if (this._openssl === null) {
        this.logger.error('openssl not found');
      } else {
        // use -A -a for oneline ascii armoured output
        this.openssl_enc_args = (this._openssl+' enc -aes-256-cbc -pbkdf2 -A -a -pass stdin').trim().split(/\s+/);
        this.openssl_dec_args = (this._openssl+' enc -aes-256-cbc -pbkdf2 -d -A -a -pass stdin').trim().split(/\s+/);
      }
    }
    return this._openssl;
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

  get dbus_gpaste() {
    if (!this._dbus_gpaste) {
      this._dbus_gpaste = new DBusGPaste(this.settings);
    }
    return this._dbus_gpaste;
  }

  get cached_pass() {
    return this._cached_pass;
  }

  set cached_pass(pass) {
    if (pass.length > 0 && this.settings.cache_password_timeout > 0) {
      let timeout = Date.now() + this.settings.cache_password_timeout * 1000;
      this.cached_pass_timeout = timeout;
      this.logger.debug('timeout cached password at %s', new Date(timeout).toString());
      Utils.setTimeout(this.timeout_callback, this.settings.cache_password_timeout * 1000, this);
    }
    this._cached_pass = pass;
  }

  get cached_pass_timeout() {
    return this._cached_pass_timeout;
  }

  set cached_pass_timeout(t) {
    this._cached_pass_timeout = t;
  }

  timeout_callback(clippie) {
    let now=Date.now();
    //clippie.logger.debug('now-timeout=%d', now-clippie.cached_pass_timeout);
    if (now >= clippie.cached_pass_timeout) {
      clippie.logger.debug('clearing cached password at %s', new Date(now).toString());
      clippie.cached_pass_timeout = 0;
      clippie.cached_pass = '';
    }
  }

  restore_state() {
    this._state = JSON.parse(this.settings.state);
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

  // Asynchronous gpaste dbus GetHistory refresh
  refresh_dbus(menu=undefined) {
    if (menu !== undefined) { this.menu = menu; }
    this.dbus_gpaste.getHistoryRemote( (history) => {
      if (history.length === 0) {
        return;
      }
      history = history[0];
      let clips = [];
      this.logger.debug("history %d", history.length);
      for (let i=0; i < history.length; i++) {
        let [uuid, content]=history[i];

        //this.logger.debug('uuid=%s', uuid);

        // find clip with this uuid (if any)
        let clip = this.find_uuid(uuid);
        if (clip === undefined) {
          // clip not found in clips, create a new one
          clip = Clip.unClip(content, uuid);
          if (clip === undefined) {
            clip = new Clip(uuid, content);
          }
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
        if (menu !== undefined) { this.menu.add_item(clip); }
      }
      this.clips = clips;
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

            let clip = Clip.unClip(eclip);
            if (clip === undefined) {
              this.logger.error("Invalid eclip: %s", path);
            } else if (this.menu) {
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

  save_eclip_async(uuid, eclip) {
    if (this.settings.save_eclips === false) {
      return;
    }

    let file_name = uuid+".eclip";
    let path = GLib.build_filenamev( [ this.settings.save_eclips_path, file_name ] );
    let gfile = Gio.file_new_for_path(path);
    gfile.create_readwrite_async(Gio.FileCreateFlags.PRIVATE, GLib.PRIORITY_DEFAULT, null, (gfile, res) => {
      try {
        let stream = gfile.create_readwrite_finish(res);
        let bytes = stream.get_output_stream().write(eclip, null);
        this.logger.debug("wrote %d bytes to %s", bytes, path);
      } catch (e) {
        this.logger.error("Failed to write to %s: [%s] - %s", path, eclip, e.message);
      }
    });
  }

  find(clip) {
    return this.clips.findIndex(c => c.uuid === clip.uuid);
  }

  find_uuid(uuid) {
    return this.clips.find(c => c.uuid === uuid);
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

const GPASTE_LINE_RE=/^([-0-9a-f]+):\s(.*$)/;
const PASSWORD_NAME_RE=/\[.*?\](.*)$/

var Clip = class Clip {

  constructor(uuid, content, params={kind: undefined, eclip: undefined}) {
    this.logger = clippieInstance.logger;
    this._uuid = uuid;
    this._content = content;

    this._menu_item = undefined; // clippie menu

    //this.logger.debug('%s: %s', uuid, content);

    this._kind = params.kind ? params.kind : this.dbus_gpaste.getElementKind(this.uuid);
    this._eclip = params.eclip;

    this._lock = this.isPassword();
    if (this._lock) {
      this._password_name = this.get_password_name(content);
      this._content = "▷ "+content;
      if (this.timeout_gpaste_password === undefined && this.settings.timeout_gpaste_password > 0) {
        let timeout = Date.now() + this.settings.timeout_gpaste_password * 1000;
        this.timeout_gpaste_password = timeout;
        this.logger.debug('timeout GPaste password at %s', new Date(timeout).toString());
        Utils.setTimeout(this.timeout_gpaste_callback, this.settings.timeout_gpaste_password * 1000, this);
      }
    }
  }

  timeout_gpaste_callback(clip) {
    let now=Date.now();
    clip.logger.debug('now-timeout=%d', now-clip.timeout_gpaste_password);
    if (now >= clip.timeout_gpaste_password) {
      clip.logger.debug('delete GPaste password entry at %s', new Date(now).toString());
      clip.timeout_gpaste_password = 0;
      clip.delete();
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

  static unClip(content, gpaste_uuid=undefined) {
    let [ label, uuid, eclip ] = Clip.declipser(content);
    if (uuid === undefined || eclip === undefined) {
      // invalid eclip
      return undefined;
    }
    let clip = new Clip(uuid, label, { kind: 'eClip', eclip: eclip });
    clip.gpaste_uuid = gpaste_uuid;

    clip.logger.debug('label=%s uuid=%s gpuuid=%s', label, uuid, gpaste_uuid)
    return clip;
  }

  get clippie() {
    return clippieInstance;
  }

  get settings() {
    return this.clippie.settings;
  }

  // Obsolete
  get gpaste_client() {
    return this.clippie.gpaste_client;
  }

  get dbus_gpaste() {
    return this.clippie.dbus_gpaste;
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

  get eclip() {
    return this._eclip;
  }

  set eclip(e) {
    this._eclip = e;
  }

  get kind() {
    return this._kind;
  }

  set kind(k) {
    this._kind = k;
  }

  isEclipsed() {
    return this.eclip !== undefined;
  }

  isPassword() {
    if (this._kind === 'Password') {
      this.logger.debug('%s is a password: %s', this.uuid, this.content);
      return true;
    }
    return false;
  }

  iseClip() {
    return this._kind === 'eClip';
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
  //   this.clippie.save_state();
  // }

  select() {
    let uuid = this.gpaste_uuid ? this.gpaste_uuid : this.uuid;
    this.dbus_gpaste.select(uuid);
    return true;
  }

  delete() {
    if (this.iseClip()) {
      /* if the gpaste_uuid is set we delete the gpaste entry but leave our eclip on disk */
      if (this.gpaste_uuid) {
        this.dbus_gpaste.delete(this.gpaste_uuid);
      } else {
        // deleting the eclip on disk
        let file_name = this.uuid+".eclip";
        let path = GLib.build_filenamev( [ this.settings.save_eclips_path, file_name ] );
        this.logger.debug('delete eclip %s', path);
        GLib.unlink(path);
      }
    } else {
      this.dbus_gpaste.delete(this.uuid);
    }
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
      let idx = this.clippie.clips.indexOf(this);

      this.clippie.dbus_gpaste.setPassword(this.uuid, label);
      this.menu_item.trash_self();
      this.lock = true;

      // seems to replace the item at the same index with a new uuid
      if (idx >= 0) {
        let [uuid, content] = this.clippie.dbus_gpaste.getElementAtIndex(idx);
        if (uuid) {
          let clip=new Clip(uuid, content);
          this.clippie.clips.push(clip);
          this.clippie.dbus_gpaste.select(uuid);
        }
      }
    }
    return true;
  }

  // add gpaste entry with ~~eclipse~~label~~this.uuid~~eclipse~~
  eclipser(label, uuid, eclipse) {
    let str= "~~eclipse~~%s~~%s~~%s~~".format(label, uuid, eclipse);
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
    if (!this.clippie.openssl) {
      return this.logger.error(_('openssl not found'));
    }
    if (!passphrase || passphrase.trim().length === 0) {
      return this.logger.error(_('will not encrypt without passphrase'));
    }

    let cmdargs=this.clippie.openssl_enc_args.join(' ');
    // passphrase is piped as first line of data to openssl
    let data=passphrase+"\n"+this.content;
    //this.logger.debug("%s | %s", data, );
    this.logger.debug("encrypt content | %s", cmdargs);
    Utils.execCommandAsync(this.clippie.openssl_enc_args, data).then((result) => {
      let ok = result[0];
      let stdout = result[1];
      let stderr = result[2];
      let status = result[3];
      if (ok && status === 0) {
        this.logger.debug("Encrypted %s [%s]", label, stdout);
        // test decryption with same password
        let uuid = Utils.uuid();
        let eclip = this.eclipser(label, uuid, stdout.trimEnd());
        this.clippie.dbus_gpaste.add(eclip);
        this.clippie.save_eclip_async(uuid, eclip);
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
    if (!this.clippie.openssl) {
      return this.logger.error('openssl not found');
    }
    if (!passphrase || passphrase.trim().length === 0) {
      return this.logger.error('can not decrypt without passphrase');
    }
    // passphrase is piped as first line of data to openssl
    let cmdargs = this.clippie.openssl_dec_args.join(' ');
    let data=passphrase+"\n"+this.eclip+"\n";
    this.logger.debug("decrypt content | %s", cmdargs);
    Utils.execCommandAsync(this.clippie.openssl_dec_args, data).then((result) => {
      let ok = result[0];
      let stdout = result[1];
      let stderr = result[2].trimEnd();
      let status = result[3];
      if (ok && status == 0) {
        //this.logger.debug("ok=%s stdout=[%s] stderr=[%s] status=[%d]", ok, stdout, stderr, status);
        this.clippie.dbus_gpaste.addPassword(this.content, stdout.trimEnd());
        this.clippie.refresh_dbus();
      } else {
        this.logger.debug("%s failed status=%d: %s", cmdargs, status, stderr);
        ok = false;
      }
      callback(ok, stderr);
    });
    return undefined;
  }
}



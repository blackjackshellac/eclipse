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
const Params = imports.misc.params;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Logger = Me.imports.logger.Logger;
const DBusGPaste = Me.imports.dbus.DBusGPaste;
const KeyboardShortcuts = Me.imports.keyboard_shortcuts.KeyboardShortcuts;

var clippieInstance;
var timedOutGpastePasswords = {};

var Clippie = class Clippie {
  constructor() {
    this._clips = [];
    this._eclips = [];
    this._cur_clip = 0;

    // id => clip
    this._lookup = {};
    this._gp1_map = {};

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

  attach(indicator, refresh=false) {
    // reload settings
    if (this.attached) {
      return this;
    }

    this._settings = new Settings();

    this.logger.settings = this._settings;

    this.logger.debug("Attaching indicator, size=%d items", this.clips.length);

    this._indicator = indicator;

    this.attached = true;

    if (refresh) {
      this.refresh_dbus();
    }

    if (this.settings.cache_eclips) {
      this.refresh_eclips_async();
    }

    this.settings_changed_signals();

    this.enable_keyboard_shortcuts();

    this.cached_pass = this.settings.cache_password;

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
      this.eclips = [];
      this.cur_clip = 0;
      this._gp1_map = {};

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

    this.settings.settings.connect('changed::cache-eclips', () => {
      if (this.settings.cache_eclips === false) {
        this.logger.debug('clearing eclips cache');
        this.eclips = [];
      }
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

  get gp1_map() {
    return this._gp1_map;
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

  get eclips() {
    return this._eclips;
  }

  set eclips(eclips) {
    this._eclips = eclips;
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
        // defaults, use -A -a for oneline base64 output
        // enc -aes-256-cbc -pbkdf2 -A -a -pass stdin
        // enc -aes-256-cbc -pbkdf2 -A -a -pass stdin -d
        this.openssl_enc_args = [ this._openssl ];
        this.openssl_dec_args = [ this._openssl ];
        this.openssl_enc_args.push(...this.settings.openssl_encrypt_opts.trim().split(/\s+/));
        this.openssl_dec_args.push(...this.settings.openssl_decrypt_opts.trim().split(/\s+/));
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
      this.gp2 = this._dbus_gpaste.version === 2;
      this.gp1 = !this.gp2;
      this.logger.debug('dbus_gpaste version=%d gp2=%s gp1=%s', this._dbus_gpaste.version, this.gp2, this.gp1);
    }
    return this._dbus_gpaste;
  }

  get cached_pass() {
    return this._cached_pass;
  }

  set cached_pass(pass) {
    if (pass && pass.length > 0 && this.settings.cache_password_timeout > 0) {
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

  get_uuid_content(i, history) {
    history=history[i];
    //this.logger.debug('get_uuid_content: i=%d gp2=%s [%s]', i, this.gp2, history);
    let map = {};
    if (this.gp2) {
      map.uuid = history[0];
      map.content = history[1];
      map.index = null;
    } else {
      // uuid is a 64bit hash of the content
      let uuid=Clip.hash64(history);
      map = this.gp1_map[uuid];
      if (!map) {
        map = {};
        map.uuid = uuid;
        map.content = history;
        this.gp1_map[uuid] = map;
      }
      // update index
      map.index = i;
      //Utils.logObjectPretty(map);
    }
    return map;
  }

  // Asynchronous gpaste dbus GetHistory refresh
  refresh_dbus(menu=undefined) {
    if (menu !== undefined) { this.menu = menu; }
    //Utils.logObjectPretty(timedOutGpastePasswords);
    this.dbus_gpaste.getHistoryRemote( (history) => {
      if (history.length === 0) {
        return;
      }
      history = history[0];
      let clips = [];
      this.logger.debug("history %d", history.length);
      for (let i=0; i < history.length; i++) {
        let map = this.get_uuid_content(i, history);
        let uuid = map.uuid;
        let content = map.content;
        map.content = undefined;

        //Utils.logObjectPretty(map);

        let params = { index: map.index };
        // find clip with this uuid (if any)
        let clip = this.find_uuid(uuid);
        if (clip === undefined) {
          // clip not found in clips, create a new one
          clip = Clip.unClip(content, uuid, params);
          if (clip === undefined) {
            //this.logger.debug('create new clip %s', uuid);
            clip = new Clip(uuid, content, params);
          } else {
            //this.logger.debug('created eclip %s', uuid);
            clip.save_eclip();
          }
        } else if (timedOutGpastePasswords[uuid] !== undefined) {
          //this.logger.debug('test clip uuid=%s %d', timedOutGpastePasswords[uuid]);
          if (clip.timeout_gpaste_password(timedOutGpastePasswords[uuid])) {
            // clip has expired and has been deleted
            this.logger.debug('deleted expired GPaste password clip %s', clip.content);
            continue;
          }
        }

        clips.push(clip);
        if (menu !== undefined) {
          //this.logger.debug('Adding to menu clip=%s', clip.toString())
          this.menu.add_item(clip);
        }
      }
      this.clips = clips;
    });
  }

  refresh_eclips_async(menu=undefined) {
    if (this.settings.save_eclips === false) {
      return;
    }
    this.eclips_popup = menu;
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
          let uuid = file_name.replace(/\.[^/.]+$/, '');

          let clip = this.eclips.find(c => c.uuid === uuid);
          if (clip) {
            this.logger.debug('cached eclip %s: %s', clip.content, clip.uuid)
            if (this.eclips_popup) {
              this.eclips_popup.add_eclip_item(clip);
            }
            continue;
          }
          this.logger.debug("eclip name=%s uuid=%s", file_name, uuid);

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
            } else {
              if (this.eclips_popup) {
                this.logger.debug('Adding eclip %s to eclip popup menu', clip.content);
                this.eclips_popup.add_eclip_item(clip);
              }
              this.eclips.push(clip);
            }
          } catch(e) {
            this.logger.error("Failed to read eclip %s [%s]", path, e.message);
          }
        }
      } while(true);
      if (this.eclips.length === 0 && this.eclips_popup) {
        this.eclips_popup.destroy();
      }
    });
  }

  save_eclip_async(uuid, eclip) {
    if (this.settings.save_eclips === false) {
      return;
    }

    let file_name = uuid+".eclip";
    let path = GLib.build_filenamev( [ this.settings.save_eclips_path, file_name ] );
    let gfile = Gio.file_new_for_path(path);

    gfile.replace_readwrite_async(null, false,
        Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION,
        GLib.PRIORITY_DEFAULT, null, (gfile, res) => {
      try {
        let stream = gfile.replace_readwrite_finish(res);
        let bytes = stream.get_output_stream().write(eclip, null);
        this.logger.debug("wrote %d bytes to %s", bytes, path);
      } catch (e) {
        this.logger.error("Failed to write to %s: [%s] - %s", path, eclip, e.message);
      }
    });
    this.logger.debug("async writing %s", file_name);
  }

  find(clip) {
    return this.clips.findIndex(c => c.uuid === clip.uuid);
  }

  find_uuid(uuid) {
    return this.clips.find(c => (c.uuid === uuid || (c.gpaste_uuid !== undefined && c.gpaste_uuid === uuid)));
  }

  has(clip) {
    return this.clips.some(c => c.uuid === clip.uuid);
  }

  delete_eclip(clip) {
    if (clip.iseClip()) {
      let label=clip.content;
      let idx = this.eclips.indexOf(label);
      if (idx > -1) {
        this.eclips.splice(idx, 1);
      }
    }
  }

  has_eclip(label) {
    if (this.settings.cache_eclips) {
      return this.eclips.some(c => c.content === label);
    }
    // only check for duplicates if the eclps are cached
    return false;
  }

  delete(clip) {
    let idx = this.find(clip);
    if (idx > -1) {
      this.clips.splice(idx, 1);
      if (this.gp1) {
        // adjust indices for cached clips
        for (let i=idx; i < this.clips.length; i++) {
          if (this.clips[i]) {
            this.clips[i].index = i;
          } else {
            this.logger.debug('failed to adjust clips at index %d', i);
          }
        }
      }
    }
    this.delete_eclip(clip);
  }

}

const GPASTE_LINE_RE=/^([-0-9a-f]+):\s(.*$)/;
const PASSWORD_NAME_RE=/\[.*?\](.*)$/

var Clip = class Clip {

  constructor(uuid, content, params={}) {
    params = Params.parse(params, {
      kind: null,
      eclip: null,
      index: null
    });

    this.logger = clippieInstance.logger;
    this._uuid = uuid;
    this._content = content;

    this._menu_item = undefined; // clippie menu

    //this.logger.debug('new Clip %s: %s', uuid, content);

    //Utils.logObjectPretty(params);
    this.index = params.index;  // for GPaste1
    this.kind = params.kind;
    this.eclip = params.eclip;

    this._password = this.isPassword();
    if (this._password) {
      this._password_name = this.get_password_name(content);
      this._content = "▷ "+content;
      if (this._timeout_gpaste_password === undefined && this.settings.timeout_gpaste_password > 0) {
        let timeout = Date.now() + this.settings.timeout_gpaste_password * 1000;
        this._timeout_gpaste_password = timeout;
        this.logger.debug('timeout GPaste password at %s', new Date(timeout).toString());
        Utils.setTimeout(this.timeout_gpaste_callback, this.settings.timeout_gpaste_password * 1000, this);

        timedOutGpastePasswords[this.uuid] = this._timeout_gpaste_password;
      }
    }
  }

  // based on cyrb53 (https://stackoverflow.com/a/52171480/916462
  // returns the full 64bit hash as a hex string
  static hash64(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    //return 4294967296 * (2097151 & h2) + (h1>>>0);
    return (h2>>>0).toString(16).padStart(8,0)+(h1>>>0).toString(16).padStart(8,0);
  }

  timeout_gpaste_password(timeout=undefined) {
    if (this._timeout_gpaste_password === undefined) {
      return false;
    }
    if (!this.isPassword()) {
      return false;
    }
    if (timeout === undefined) {
      timeout = this._timeout_gpaste_password;
    }
    let now=Date.now();
    if (now >= timeout) {
      this._timeout_gpaste_password = undefined;
      this.logger.debug('delete GPaste password entry at %s %d ms', new Date(now).toString(), (now-timeout));
      if (this.dbus_gpaste.deletePassword(this._password_name)) {
        this.clippie.delete(this);
        delete timedOutGpastePasswords[this.uuid];
      }
      return true;
    }
    return false;
  }

  timeout_gpaste_callback(clip) {
    clip.timeout_gpaste_password();
  }

  static parse(line) {
    let m = line.match(GPASTE_LINE_RE);
    if (m) {
      this.logger.debug('parsed %s: %s', m[1], m[2]);
      return new Clip(m[1], m[2]);
    }
    return undefined;
  }

  static unClip(content, gpaste_uuid=undefined, params={}) {
    let [ label, uuid, eclip ] = Clip.declipser(content);
    if (uuid === undefined || eclip === undefined) {
      // invalid eclip
      return undefined;
    }
    params.kind = 'eClip';
    params.eclip = eclip;
    let clip = new Clip(uuid, label, params);
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

  // return idx for GPaste1 and uuid for GPaste2
  get uuidx() {
    return this.clippie.gp1 ? this.index : this._uuid;
  }

  get index() {
    return this._index;
  }

  set index(index) {
    this._index = index ? index : undefined;
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

  set eclip(eclip) {
    this._eclip = eclip ? eclip : undefined;
  }

  get kind() {
    return this._kind;
  }

  set kind(k) {
    if (k === undefined || k === null) {
      if (this.clippie.gp1 && this.index === null) {
        this.logger.error('index not set when attempting to get kind');
        k = 'Text';
      } else {
        k = this.dbus_gpaste.getElementKind(this.uuidx);
      }
    }
    this._kind = k;
  }

  isEclipsed() {
    return this.eclip !== undefined;
  }

  isPassword() {
    if (this._kind !== undefined && this._kind === 'Password') {
      this.logger.debug('%s is a password: %s', this.uuid, this.content);
      return true;
    }
    return false;
  }

  iseClip() {
    return this.eclip !== undefined;
  }

  refresh() {
    if (!this._content) {
      let content = this.dbus_gpaste.getElement(this.uuidx);
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
    return this._password;
  }

  set lock(b) {
    this._password = b;
  }

  get menu_item() {
    return this._menu_item;
  }

  set menu_item(m) {
    this._menu_item = m;
  }

  label_text() {
    var label = this.content.trim().replace(/\n/gm, '↲'); // ¶↲
    label = label.replace(/\s+/g, ' ');
    label = label.substring(0, 50);
    return label.trim();
  }

  select() {
    let uuid = this.gpaste_uuid ? this.gpaste_uuid : this.uuidx;
    this.dbus_gpaste.select(uuid);
    if (this.clippie.gp1) {
      this.clippie.refresh_dbus();
    }
    return true;
  }

  delete_eclip(uuid) {
    // deleting the eclip on disk
    let file_name = uuid+".eclip";
    let path = GLib.build_filenamev( [ this.settings.save_eclips_path, file_name ] );
    this.logger.debug('delete eclip %s', path);
    GLib.unlink(path);
  }

  delete() {
    if (this.iseClip()) {
      /* if the gpaste_uuid is set we delete the gpaste entry but leave our eclip on disk */
      if (this.gpaste_uuid) {
        this.dbus_gpaste.delete(this.gpaste_uuid);
      } else {
        this.delete_eclip(this.clippie.gp1 ? this._uuid : this.uuid);
      }
    } else {
      this.dbus_gpaste.delete(this.uuidx);
    }
    this.clippie.delete(this);
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

      let ok = this.clippie.dbus_gpaste.renamePassword(this.password_name, label);
      if (ok) {
        this.logger.debug("Renamed password [%s] to [%s]", this.password_name, label);
        this.clippie.delete(this);
      } else {
        this.logger.error("Failed to rename password %s to %s", this.password_name, label)
      }
    } else {
      // unlocked, convert clipboard entry to password

      // get the index of the clip before setting as password
      let idx = this.clippie.clips.indexOf(this);

      this.logger.debug('set entry as password uuid=%s label=%s', this.uuid, label);
      this.clippie.dbus_gpaste.setPasswordAsync(this.uuidx, label, () => {
        this.menu_item.trash_self();
        this.clippie.delete(this);
        this.clippie.refresh_dbus();
      });

    }
    return true;
  }

  save_eclip() {
    let eclipse = this.eclipser(this.content, this.uuid, this.eclip);
    this.clippie.save_eclip_async(this.uuid, eclipse);
  }

  // add gpaste entry with ~~eclipse~~label~~this.uuid~~eclipse~~
  eclipser(label, uuid, eclip) {
    return "~~eclipse~~%s~~%s~~%s~~".format(label, uuid, eclip.replace(/\r?\n$/, ''));
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
      callback(false, this.logger.error(_('openssl not found')));
      return;
    }
    if (!passphrase || passphrase.trim().length === 0) {
      callback(false, this.logger.error(_('will not encrypt without passphrase')));
      return;
    }

    let cmdargs=this.clippie.openssl_enc_args.join(' ');
    // passphrase is piped as first line of data to openssl

    //this.logger.debug("%s | %s", data, );
    //this.logger.debug("encrypt content | %s", cmdargs);
    let data=passphrase+"\n"+this.content;
    Utils.execCommandAsync(this.clippie.openssl_enc_args, data).then((result) => {
      let [ ok, stdout, stderr, status ] = result;
      if (ok && status === 0) {
        this.logger.debug("Encrypted %s [%s]", label, stdout);
        // test decryption with same password
        let uuid = Utils.uuid();
        let eclip = this.eclipser(label, uuid, stdout);
        this.clippie.dbus_gpaste.add(eclip);
        this.clippie.save_eclip_async(uuid, eclip);
      } else {
        ok = false;
        this.logger.error("%s failed status=%d: %s", cmdargs, status, stderr);
      }
      //this.logger.debug('encrypt return %s %s', ok, callback)
      callback(ok, stderr);
    });
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
      callback(false, this.logger.error(_('openssl not found')));
      return;
    }
    if (!passphrase || passphrase.trim().length === 0) {
      callback(false, this.logger.error('can not decrypt without passphrase'));
      return;
    }
    if (this.eclip === undefined) {
      callback(false, this.logger.error('clip is not encrypted'));
      return;
    }
    // passphrase is piped as first line of data to openssl
    let cmdargs = this.clippie.openssl_dec_args.join(' ');
    let data=passphrase+"\n"+this.eclip+"\n";
    this.logger.debug("decrypt content | %s", cmdargs);
    Utils.execCommandAsync(this.clippie.openssl_dec_args, data).then((result) => {
      let [ ok, stdout, stderr, status ] = result;
      if (ok && status === 0) {
        this.clippie.dbus_gpaste.addPassword(this.content, stdout);
        this.clippie.refresh_dbus();
      } else {
        this.logger.debug("%s failed status=%d: %s", cmdargs, status, stderr.trimEnd());
        ok = false;
      }
      callback(ok, stderr);
    });
  }

  reencrypt(label, passphrase_old, passphrase_new, callback) {
    if (!this.clippie.openssl) {
      callback(false, this.logger.error(_('openssl not found')));
      return;
    }
    if (!passphrase_old || passphrase_old.trim().length < this.settings.minimum_password_length) {
      callback(false, this.logger.error('can not decrypt without passphrase'));
      return;
    }
    if (this.eclip === undefined) {
      callback(false, this.logger.error('clip is not encrypted'));
      return;
    }
    let cmdargs = this.clippie.openssl_dec_args.join(' ');
    let data=passphrase_old+"\n"+this.eclip+"\n";
    this.logger.debug("reecrypt decrypt content | %s", this.eclip);
    Utils.execCommandAsync(this.clippie.openssl_dec_args, data).then((result) => {
      let [ ok, stdout, stderr, status ] = result;
      if (ok && status === 0) {
        //this.logger.debug("ok=%s stdout=[%s] stderr=[%s] status=[%d]", ok, stdout, stderr, status);
        // this is now decrypted
        this.content = stdout;
        //this.kind = 'Text';
        //this.eclip = undefined;
        //this.logger.debug('reencrypt encrypt this with label %s', label);
        this.encrypt(label, passphrase_new, callback);
      } else {
        this.logger.debug("%s failed status=%d: %s", cmdargs, status, stderr.trimEnd());
        ok = false;
      }
      callback(ok, stderr);
    });
  }
}



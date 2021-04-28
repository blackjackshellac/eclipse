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

const { Gio, Gtk, GLib, Gdk } = imports.gi;
const ByteArray = imports.byteArray;

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Settings = Me.imports.settings.Settings;
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;
const DBusGPaste = Me.imports.dbus.DBusGPaste;
const KeyboardShortcutDialog = Me.imports.kb_shortcuts_dialog.KeyboardShortcutDialog;

class PreferencesBuilder {
  constructor() {
    this._settings = new Settings();
    this._builder = new Gtk.Builder();
    this.logger = new Logger('cl_prefs', this._settings);

    this._gsettings = Utils.exec_path('gsettings');
    this._gpaste_client = Utils.exec_path('gpaste-client');

    if (this._gsettings === null) {
      this.logger.error('gsettings not found');
      this._gsettings = 'gsettings';
    }

    // gsettings get org.gnome.GPaste track-changes
    // gsettings set org.gnome.GPaste track-changes false
    // gpaste-client daemon-reexec
    this.command_args = {
      get_track_changes: (this.gsettings+' get org.gnome.GPaste track-changes').split(/\s+/),
      set_track_changes_true:  (this.gsettings+' set org.gnome.GPaste track-changes true').split(/\s+/),
      set_track_changes_false: (this.gsettings+' set org.gnome.GPaste track-changes false').split(/\s+/)
    };

    if (Utils.isGnome40()) {
      let iconPath = Me.dir.get_child("icons").get_path();
      let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
      iconTheme.add_search_path(iconPath);
    }
  }

  get gsettings() {
    return this._gsettings;
  }

  show() {
    if (Utils.isGnome3x()) {
      this._widget.show_all();
    }
  }

  build() {
    this.logger.info("Create preferences widget gnome shell version %s: %s",
      Utils.gnomeShellVersion, Utils.isGnome3x() ? "less than 40" : "40 or more");

    let ui = Utils.isGnome3x() ? 'prefs3x.ui' : 'prefs40.ui';

    this._builder.add_from_file(GLib.build_filenamev( [Me.path, 'ui', ui] ));
    this._prefs_box = this._builder.get_object('prefs_box');

    this._viewport = new Gtk.Viewport();
    this._widget = new Gtk.ScrolledWindow();
    if (Utils.isGnome3x()) {
      this._viewport.add(this._prefs_box);
      this._widget.add(this._viewport);
    } else {
      this._viewport.set_child(this._prefs_box);
      this._widget.set_child(this._viewport);
    }

    // https://gjs-docs.gnome.org/gtk30~3.24.26/gtk.widget#signal-key-press-event
    // https://gjs-docs.gnome.org/gdk30/gdk.eventkey
    // this._widget.connect('key-press-event', (w, event) => {
    //   this.logger.debug("key-press-event, w=%s event=%s", Utils.logObjectPretty(w), Utils.logObjectPretty(event));
      // propogate if false

    //   return false;
    // });

    //this._title = this._bo('title');

    this._clippie_grid = this._bo('clippie_grid');
    this._shortcuts_grid = this._bo('shortcuts_grid');
    this._gpaste_grid = this._bo('gpaste_grid');
    this._msg_text = this._bo('msg_text');

    if (Utils.isGnome40()) {
      // this._prefs_box.append(this._title);
      // grids are inside of frames now in prefs.ui
      // this._prefs_box.append(this._clippie_grid);
      // this._prefs_box.append(this._gpaste_grid);

      let provider = new Gtk.CssProvider();

      provider.load_from_path(Me.dir.get_path() + '/prefs.css');
      Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      //this._title.add_css_class('prefs-title');
    }

    // col, row, col_span, row_span
    this._clippie_grid.attach(this._bo('show_histories_text'), 0, 0, 1, 1); // row 0
    this._clippie_grid.attach(this._bo('show_histories'),      1, 0, 1, 1);

    this._clippie_grid.attach(this._bo('debug_text'),          0, 1, 1, 1); // row 1
    this._clippie_grid.attach(this._bo('debug'),               1, 1, 1, 1);

    //this._clippie_grid.attach(this._test,                      0, 3, 2, 1);

    // this._test.connect('clicked', (btn) => {
    //   let dialog = new KeyboardShortcutDialog(( {binding, mask, keycode, keyval } ) => {
    //     this.logger.debug('binding=%s mask=0x%x keycode=%s keyval=%s', binding, mask, keycode, keyval);
    //     this._test.set_label(binding ? binding : _("No shortcut chosen"));
    //   });

    //   let toplevel = Utils.isGnome3x() ? this._widget.get_toplevel() : this._widget.get_root();
    //   dialog.set_transient_for(toplevel);
    //   dialog.present();
    //   this.logger.debug('top level=%s', toplevel);
    // });

    this._accel_enable = this._bo('accel_enable');
    // keyboard shortcut buttons
    this._accel_menu = this._bo('accel_menu');
    this._accel_history = this._bo('accel_history');
    this._accel_next = this._bo('accel_next');

    this._accel_menu.connect('clicked', (btn) => {
      let dialog = new KeyboardShortcutDialog( ( { binding, mask, keycode, keyval }) => {
        if (binding) {
          this.settings.accel_show_menu = binding;
          btn.set_label(binding.length > 0 ? binding : _("<None>") );
        }
      });

      let toplevel = Utils.isGnome3x() ? this._widget.get_toplevel() : this._widget.get_root();
      dialog.set_transient_for(toplevel);
      dialog.present();
      this.logger.debug('top level=%s', toplevel);
    });

    this._accel_history.connect('clicked', (btn) => {
      let dialog = new KeyboardShortcutDialog( ( { binding, mask, keycode, keyval }) => {
        if (binding) {
          this.settings.accel_show_history = binding;
          btn.set_label(binding.length > 0 ? binding : _("<None>") );
        }
      });

      let toplevel = Utils.isGnome3x() ? this._widget.get_toplevel() : this._widget.get_root();
      dialog.set_transient_for(toplevel);
      dialog.present();
      this.logger.debug('top level=%s', toplevel);
    });

    this._accel_next.connect('clicked', (btn) => {
      let dialog = new KeyboardShortcutDialog( ( { binding, mask, keycode, keyval }) => {
        if (binding) {
          this.settings.accel_next = binding;
          btn.set_label(binding.length > 0 ? binding : _("<None>") );
        }
      });

      let toplevel = Utils.isGnome3x() ? this._widget.get_toplevel() : this._widget.get_root();
      dialog.set_transient_for(toplevel);
      dialog.present();
      this.logger.debug('top level=%s', toplevel);
    });

    this._accel_menu.set_label(this.settings.accel_show_menu);
    this._accel_history.set_label(this.settings.accel_show_history);
    this._accel_next.set_label(this.settings.accel_next);

    // col, row, col_span, row_span
    this._shortcuts_grid.attach(this._bo('accel_enable_text'),   0, 0, 1, 1); // row 0
    this._shortcuts_grid.attach(this._accel_enable,              1, 0, 1, 1);
    this._shortcuts_grid.attach(this._bo('accel_menu_text'),     0, 1, 1, 1);
    this._shortcuts_grid.attach(this._accel_menu,                1, 1, 1, 1);
    this._shortcuts_grid.attach(this._bo('accel_history_text'),  0, 2, 1, 1);
    this._shortcuts_grid.attach(this._accel_history,             1, 2, 1, 1);
    this._shortcuts_grid.attach(this._bo('accel_next_text'),     0, 3, 1, 1);
    this._shortcuts_grid.attach(this._accel_next,                1, 3, 1, 1);

    this._track_changes = this._bo('track_changes');
    this._daemon_reexec = this._bo('daemon_reexec');
    this._gpaste_ui = this._bo('gpaste_ui');

    this._gpaste_grid.attach(this._bo('track_changes_text'),  0, 0, 1, 1);
    this._gpaste_grid.attach(this._track_changes,             1, 0, 1, 1);
    this._gpaste_grid.attach(this._daemon_reexec,             0, 1, 2, 1);
    this._gpaste_grid.attach(this._gpaste_ui,                 0, 2, 2, 1);

    let [ exit_status, stdout, stderr ] = Utils.execute(this.command_args.get_track_changes);
    if (exit_status === 0) {
      let active = stdout.trim() === 'true';
      this.logger.debug('gsettings get org.gnome.GPaste track-changes => %s', stdout);
      this._track_changes.set_active(active);
    }
    this._track_changes.connect('notify::active', (sw) => {
      let active = sw.get_active();
      let cmdargs = active ? this.command_args.set_track_changes_true : this.command_args.set_track_changes_false;
      this.logger.debug(cmdargs.join(' '));
      let [ exit_status, stdout, stderr ] = Utils.execute(cmdargs);
      if (exit_status !== 0) {
        this.logger.debug('set track-changes failed: %d - %s', exit_status, stderr);
      }
    });

    this._daemon_reexec.connect('clicked', (btn) => {
      this.logger.debug('Run dbus gpaste method Reexecute()');
      this.dbus_gpaste.daemonReexec();
      this._msg_text.set_label(_("GPaste deamon restarted"));
    });

    this._gpaste_ui.connect('clicked', (btn) => {
      this.logger.debug('Launch the GPaste preferences UI');
      Utils.execCommandAsync([this._gpaste_client, "ui"]);
      this._msg_text.set_label(_("Launched gpaste-client ui"));
    });

    this._accel_enable.connect('notify::active', (sw) => {
      this.logger.debug('accel_enable=%s', sw.get_active());
      return true;
    });

    // gsettings get org.gnome.GPaste track-changes
    // gsettings set org.gnome.GPaste track-changes false
    // gpaste-client daemon-reexec

    this._bind();

    if (this._bo('show_histories').grab_focus()) {
      this.logger.debug('set focus to history switch');
    }

    this._bo('version').set_text("Version "+Me.metadata.version);
    this._bo('description').set_text(Me.metadata.description.split('\n')[0]);

    // About box
    this._about_clicks = 0;
    if (Utils.isGnome3x()) {

      this.timer_icon = this._bo('clippie_icon');

      this.timer_icon.connect('button-press-event', () => {
        this._about_clicks = this._spawn_dconf_config(this._about_clicks);
      });
    } else {
      this.timer_icon_button = this._bo('clippie_icon_button');

      this.timer_icon_button.connect('clicked', (btn) => {
        this._about_clicks = this._spawn_dconf_config(this._about_clicks);
      });

      let bmac = Gtk.Picture.new_for_filename(Me.dir.get_path()+'/icons/bmc_logo_wordmark.svg');
      this._bo('link_bmac').set_child(bmac);
    }
    return this._widget;
  }

  _spawn_dconf_config(clicks) {
    if (clicks === 2) {
      var cmd = Me.path+"/bin/dconf-editor.sh";
      this.logger.debug("spawn %s", cmd);
      Utils.spawn(cmd, undefined);
      clicks = 0;
    } else {
      clicks++;
    }
    return clicks;
  }

  get dbus_gpaste() {
    if (!this._dbus_gpaste) {
      this._dbus_gpaste = new DBusGPaste(this.settings);
    }
    return this._dbus_gpaste;
  }

  /**
   * Get Gtk Builder object by id
   */
  _bo(id) {
    return this._builder.get_object(id);
  }

  /**
   * Bind setting to builder object
   */
  _ssb(key, object, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    if (object) {
      this._settings.settings.bind(key, object, property, flags);
    } else {
      this.logger.error(`object is null for key=${key}`);
    }
  }

  _bo_ssb(id, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    let object = this._bo(id);
    let key=id.replace(/_/g, '-');
    this._ssb(key, object, property, flags);
  }

  _bind() {
    //this._bo_ssb('accel_enable', 'active');
    this._bo_ssb('debug', 'active');
    this._bo_ssb('show_histories', 'active');
    this._bo_ssb('accel_enable', 'active');
  }

  get settings() {
    return this._settings;
  }
}

function init() {

}

function getTopLevelWindow(w) {
  while(true) {
    let t=w.get_parent();
    if (t) {
      w=t;
      continue;
    }
    return w;
  }
}

function buildPrefsWidget() {
  ExtensionUtils.initTranslations(GETTEXT_DOMAIN);

  var preferencesBuilder = new PreferencesBuilder();
  var widget = preferencesBuilder.build();
  preferencesBuilder.show();

  // gtk_widget_get_ancestor(w, GTK_TYPE_WINDOW);
  // TODO find out where widget types are documented
  // let window = widget.get_parent();
  // if (window) {
  //   window.set_icon_name('view-paged-symbolic');
  // } else {
  //   preferencesBuilder.logger.debug("Prefrences widget has no parent");
  // }

  // widget.connect('state-flags-changed', (w, flags) => {
    //preferencesBuilder.logger.debug('state flags change %s, %s', w, flags);
  //   if (flags & Gtk.StateFlags.BACKDROP) {
  //     w = getTopLevelWindow(w)
  //     let event_mask = w.get_events();
  //     preferencesBuilder.logger.debug('In backdrop window %s %s', w, ""+event_mask);
  //     w.set_events(event_mask & Gdk.EventMask.KEY_PRESS_MASK);
  //   }

  //   let dialog = new KeyboardShortcutDialog((binding, mask, keycode, keyval) => {
  //     preferencesBuilder.logger.debug('binding=%s mask=0x%x keycode=%s keyval=%s', binding, mask, keycode, keyval);
  //   });

  //   dialog.set_transient_for(widget.get_toplevel());
  //   dialog.present();
  // });

  return widget;
}


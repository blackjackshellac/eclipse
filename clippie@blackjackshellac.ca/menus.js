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

const { GObject, St, Clutter } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const LockItemModalDialog = Me.imports.dialog.LockItemModalDialog;
const Logger = Me.imports.logger.Logger;

const logger = new Logger('cl_menus');

var ClippieMenu = class ClippieMenu {
  constructor(menu, clippie) {
    log("");
    this._menu = menu;
    this._items = [];

    this._clippie = clippie;

    logger.settings = clippie.settings;

    this._searchItem = new ClippieSearchItem(this);

    this.menu.connect('open-state-changed', (self, open) => {
      logger.debug("menu open="+open);
      if (open) {
        //this.build();
        this.rebuild();
      } else {
        this.items = [];
      }
    });

    //logger.debug("menu style=%s", this.menu.box.style_class);
    //this.menu.box.style_class = 'clippie-menu-content';
  }

  add_item(clip) {
    let menu = this.menu;

    let len = this.items.length;
    let max = this.clippie.settings.entries;
    if (len === max) {
      this.more = new PopupMenu.PopupSubMenuMenuItem(_("More…"), { reactive: false } );
      menu.addMenuItem(this.more);
      this.items.push(this.more);
      menu = this.more.menu;
    } else if (len > max) {
      menu = this.more.menu;
    } else {
      this.more = undefined;
    }
    let item = new ClipMenuItem(clip, menu);
    this.items.push(item);
  }

  rebuild() {
    logger.debug('Refreshing all menu items');
    this.menu.removeAll();
    this._searchItem = new ClippieSearchItem(this);
    global.stage.set_key_focus(this._searchItem.entry);
    this.items = [];
    this.clippie.refresh_dbus(this);
    this.menu.open();
  }

  build(filter=undefined) {
    logger.debug("Building clippie menu filter=[%s]", filter);

    let menu = this.menu;

    if (filter === undefined) {
      this.rebuild();
      //this.clippie.refresh();
      return;
    }
    logger.debug("items=%d", this.items.length);
    for (let i=0; i < this.items.length; i++) {
      this.items[i].destroy();
    }
    this.items = [];

    let entries = this.clippie.search(filter);
    logger.debug("found %d entries with filter=%s", entries.length, filter);

    for (let i=0; i < entries.length; i++) {
      let clip=entries[i];
      this.add_item(clip);
    }
  }

  // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  _addSeparator() {
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  }

  get items() {
    return this._items;
  }

  set items(array) {
    this._items = array;
  }

  get menu() {
    return this._menu;
  }

  get clippie() {
    return this._clippie;
  }

  trash(item) {
    var index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }
}

var ClipMenuItem = GObject.registerClass(
class ClipMenuItem extends PopupMenu.PopupMenuItem {
  _init(clip, menu) {
      super._init("", { reactive: true });

      this._clip = clip;
      this._menu = menu;

      clip.menu_item = this;

      var box = new St.BoxLayout({
        x_expand: true,
        x_align: St.Align.START,
        pack_start: false,
        style_class: 'clippie-menu-box'
      });
      this.add(box);

      this.label = new St.Label({
        style_class: 'clippie-menu-content',
        x_expand: true,
        x_align: St.Align.START
      });
      this.label.set_text(clip.label_text());

      box.add_child(new ClipItemControlButton(clip, clip.lock ? 'lock' : 'unlock'));
      box.add_child(this.label);
      box.add_child(new ClipItemControlButton(clip, 'delete'));

      this.connect('activate', (mi) => {
        logger.debug("Selected %s", mi.clip.uuid);
        if (mi.clip.select()) {
          let cm = mi.clip.clippie.indicator.clippie_menu.menu;
          cm.moveMenuItem(mi, 1);
        }
      });

      //logger.debug("Adding clip %s", clip.uuid);
      menu.addMenuItem(this);
  }

  get clip() {
    return this._clip;
  }

  trash_self() {
    this.clip.clippie.indicator.clippie_menu.trash(this);
    this.destroy();
  }
});

var CICBTypes = {
  'lock': { icon: 'changes-prevent-symbolic', style: 'clippie-menu-lock-icon' },
  'unlock': { icon: 'changes-allow-symbolic', style: 'clippie-menu-lock-icon' },
  'delete' :  { icon: 'edit-delete-symbolic'    , style: 'clippie-menu-delete-icon' }
}

var ClipItemControlButton = GObject.registerClass(
class ClipItemControlButton extends St.Button {
    _init(clip, type) {
        super._init();

        this._type = type;
        this._clip = clip;

        // 'media-playback-stop-symbolic'
        // 'edit-delete-symbolic'
        this.child = this.get_icon(type);

        this.connect_type();
    }

    get_icon(type) {
      var icon = new St.Icon({
          icon_name: CICBTypes[type].icon,
          style_class: CICBTypes[type].style
      });
      icon.set_icon_size(16);
      return icon;
    }

    connect_type() {
        switch(this.type) {
        case "lock":
        case "unlock":
          this.connect('clicked', (cb) => {

            let dialog = new LockItemModalDialog(this.clip);
            dialog.open(global.get_current_time());

            // this.clip.toggle_lock();
            // let type = this.clip.lock ? 'lock' : 'unlock';
            // this.child = this.get_icon(type);
            // this.clip.menu_item.label.set_text(this.clip.label_text());
            // this.clip.menu_item.queue_redraw();
          });
          break;
        case "delete":
          this.connect('clicked', (cb) => {
            let item = this.clip.menu_item;
            item.trash_self();
            // item.destroy();
            // this.clip.clippie.indicator.clippie_menu.trash(item);
            //this.clip.menu_item.destroy();
            //this.clip.menu_item._menu.trash(this.clip.menu_item);
            this.clip.delete();
            //this.rebuild();
          });
          break;
        }
    }

    get clip() {
      return this._clip;
    }

    get type() {
      return this._type;
    }

    get icon() {
      return this.child;
    }

    rebuild() {
      this.clip.clippie.indicator.rebuild_menu();
    }
});

var ClippieSearchItem = GObject.registerClass(
class ClippieSearchItem extends PopupMenu.PopupMenuItem {
  _init(clippie_menu) {
    super._init("", { reactive: false, can_focus: false });

    this._clippie_menu = clippie_menu;
    this._menu = clippie_menu.menu;
    this._clippie = clippie_menu.clippie;

    this._menu.addMenuItem(this);

    logger.settings = this.clippie.settings;

    var layout = new St.BoxLayout({
      style_class: 'clippie-search-menu',
      pack_start: false,
      x_expand: true,
      y_expand: false,
      x_align: St.Align.START,
      vertical: false
    });

    this.add(layout);

    // name: 'searchEntry',
    // style_class: 'search-entry',
    // can_focus: true,
    // hint_text: _('Type here to search…'),
    // track_hover: true,
    // x_expand: true,

    this._entry = new St.Entry( {
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'clippie-search-entry',
      x_align: St.Align.START,
      y_align: St.Align.START, // Clutter.ActorAlign.CENTER,
      hint_text: _("Search")
    });
    //this._entry.set_hint_text();

    this._entry.set_track_hover(true);

    let entry_text = this._entry.get_clutter_text();
    //entry_text.set_activatable(true);
    entry_text.set_editable(true);

    this._icon = new St.Icon( {
      x_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'preferences-system-symbolic',
      icon_size: 20
    });

    this._prefs = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'clippie_prefs',
      child: this._icon
    });

    this._prefs.connect('button_press_event', (btn, event) => {
      logger.debug("mouse button pressed");
      ExtensionUtils.openPrefs();
      //this.clippie_menu.menu.close();
    });

    this._prefs.connect('enter_event', (btn, event) => {
      //btn.get_child().icon_name = 'preferences-system-symbolic';
      btn.get_child().icon_size = 28;
    })

    this._prefs.connect('leave_event', (btn, event) => {
      //btn.get_child().icon_name = 'open-menu-symbolic';
      btn.get_child().icon_size = 20;
    })

    //this._prefs.set_child(this._icon);

    this._search_icon = new St.Icon( {
      x_expand: false,
      y_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'edit-find-symbolic',
      icon_size: 20
    });

    layout.add_child(this._search_icon);
    layout.add_child(this._entry);
    layout.add_child(this._prefs);

    // entry_text.connect('activate', (e) => {
    //   var entry = e.get_text();
    //   logger.debug('activate: '+entry);
    // });

    // entry_text.connect('key-focus-out', (e) => {
    //   var entry = e.get_text();
    //   if (entry.length > 0) {
    //     logger.debug('key out hours: '+entry);
    //   }
    // });

    entry_text.connect('text-changed', (e) => {
      var entry = e.get_text().trim();
      logger.debug('text-changed: '+entry);
      this.clippie_menu.build(entry);
    });
  }

  get clippie_menu() {
    return this._clippie_menu;
  }

  get menu() {
    return this._menu;
  }

  get clippie() {
    return this._clippie;
  }

  get entry() {
    return this._entry;
  }

});

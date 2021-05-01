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
const EncryptDecryptModalDialog = Me.imports.dialog.EncryptDecryptModalDialog;
const Logger = Me.imports.logger.Logger;
const Utils = Me.imports.utils;

const logger = new Logger('cl_menus');

var ClippieMenu = class ClippieMenu {
  constructor(menu, clippie) {
    log("");
    this._menu = menu;
    this._items = [];

    this._clippie = clippie;

    logger.settings = clippie.settings;

    this.rebuild(false);
    // this._searchItem = new ClippieSearchItem(this);
    // this._historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("Histories"), { reactive: false, can_focus: true } );
    // this.menu.addMenuItem(this._historyMenu);
    // this._createHistory = new ClippieCreateHistoryItem(this);

    this.menu.connect('open-state-changed', (self, open) => {
      logger.debug("menu open="+open);
      if (open) {
        this.rebuild();
        global.stage.set_key_focus(this._searchItem.entry);
        //this._searchItem.entry.get_clutter_text().grab_key_focus();
      } else {
        this.items.length = 0;
        this.clippie.cur_clip = 0;
        global.stage.set_key_focus(null);
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
      menu = this.more.menu;
    } else if (len > max) {
      menu = this.more.menu;
    } else {
      this.more = undefined;
    }
    let item = new ClipMenuItem(clip, menu);
    this.items.push(item);
  }

  rebuild(load=true, history=false) {
    logger.debug('Refreshing all menu items. history=%s', this.clippie.settings.show_histories);
    this.menu.removeAll();

    if (history || this.clippie.settings.show_histories) {
      this._historyMenu = new ClippieHistoryMenu(this);
    }
    this._searchItem = new ClippieSearchItem(this);

    this.items = [];
    if (load) {
      this.clippie.refresh_dbus(this);
      this.menu.open();
    }
  }

  build(filter=undefined) {
    logger.debug("Building clippie menu filter=[%s]", filter === undefined ? filter : "undefined");

    let menu = this.menu;

    if (filter === undefined) {
      this.rebuild();
      return;
    }

    //log(Error().stack);
    logger.debug("items=%d", this.items.length);
    for (let i=0; i < this.items.length; i++) {
      let item = this.items[i];
      item.destroy();
    }
    // destroy more after the items
    if (this.more) {
      this.more.destroy();
      this.more = undefined;
    }
    this.items = [];

    // if filter is empty string
    let entries = this.clippie.search(filter);
    logger.debug("found %d entries with filter=[%s]", entries.length, filter);

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

  get searchItem() {
    return this._searchItem;
  }

  get historyMenu() {
    return this._historyMenu;
  }

  trash(item) {
    var index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }

  open(params={history:false}) {
    if (params.history) {
      this.rebuild(false, true);
      this.menu.open();
      this.history_menu_open(true);
    } else {
      this.menu.open();
    }
  }

  history_menu_open(open=true) {
    this.menu.open();
    if (!this.historyMenu) {
      this._historyMenu = new ClippieHistoryMenu(this);
    }
    this.historyMenu.setSubmenuShown(open);
  }

  select(item) {
    if (this.items.includes(item)) {
      this.menu.moveMenuItem(item, 2);
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
        style_class: 'clippie-menu-layout'
      });
      this.add(box);

      this.label = new St.Label({
        style_class: 'clippie-menu-content',
        x_expand: true,
        track_hover: false,
        x_align: St.Align.START
      });
      this.label.set_text(clip.label_text());

      box.add_child(new ClipItemControlButton(clip, clip.lock ? 'lock' : 'unlock'));
      //box.add_child(new ClipItemControlButton(clip, 'edit'));
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

  select() {
    this.clip.select();
    this.clip.clippie.indicator.clippie_menu.select(this);
  }
});

var CICBTypes = {
  'lock': { icon: 'changes-prevent-symbolic', style: 'clippie-menu-lock-icon' },
  'unlock': { icon: 'changes-allow-symbolic', style: 'clippie-menu-lock-icon' },
  'delete' :  { icon: 'edit-delete-symbolic'    , style: 'clippie-menu-delete-icon' },
  'edit' : { icon: 'document-edit-symbolic', style: 'clippie-menu-edit-icon' }
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
        case 'edit':
          // TODO
          break;
        case 'lock':
        case 'unlock':
          this.connect('clicked', (cb) => {
            //let dialog = new LockItemModalDialog(this.clip);
            let dialog = new EncryptDecryptModalDialog(this.clip);
            dialog.open(global.get_current_time());
          });
          break;
        case 'delete':
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
    super._init("", { reactive: false, can_focus: true });

    this._menu = clippie_menu.menu;
    this._clippie_menu = clippie_menu;
    this._clippie = clippie_menu.clippie;

    this._menu.addMenuItem(this);

    logger.settings = this.clippie.settings;

    var layout = new St.BoxLayout({
      style_class: 'clippie-item-layout',
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
      y_align: Clutter.ActorAlign.CENTER,
      hint_text: _("Search")
    });
    //this._entry.set_hint_text();

    this._entry.set_track_hover(true);

    let entry_text = this._entry.get_clutter_text();
    entry_text.set_activatable(true);
    entry_text.set_editable(true);

    this._icon = new St.Icon( {
      x_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'preferences-system-symbolic',
      icon_size: 20,
    });

    this._prefs = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'clippie-prefs-button',
      child: this._icon
    });

    this._prefs.connect('clicked', (btn, clicked_button) => {
      logger.debug("mouse button pressed %d", clicked_button);
      ExtensionUtils.openPrefs();
      this.clippie_menu.menu.close();
      global.stage.set_key_focus(null);
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
      icon_size: 20,
      style_class: 'clippie-search-icon'
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

var ClippieHistoryMenu = GObject.registerClass(
class ClippieHistoryMenu extends PopupMenu.PopupSubMenuMenuItem {
  _init(clippie_menu) {
    super._init(_("History [")+clippie_menu.clippie.dbus_gpaste.getHistoryName()+"]");

    logger.debug("Creating History SubMenu popup");

    // default
    //this.add_style_class_name('popup-submenu-menu-item');

    this._clippie_menu = clippie_menu;
    this._clippie = this.clippie_menu.clippie;

    clippie_menu.menu.addMenuItem(this);

    new ClippieCreateHistoryItem(this);

    this.menu.connect('open-state-changed', (self, open) => {
      logger.debug("history menu open="+open);
      if (open) {
        this.rebuild();
        //global.stage.set_key_focus(this._entry);
      } else {
        //global.stage.set_key_focus(null);
        this.menu.removeAll();
        new ClippieCreateHistoryItem(this);
      }
    });
  }

  get clippie_menu() {
    return this._clippie_menu;
  }

  get clippie() {
    return this._clippie;
  }

  rebuild() {
    let list = this.clippie.dbus_gpaste.listHistories().sort();
    let current = this.clippie.dbus_gpaste.getHistoryName();
    //Utils.logObjectPretty(list);
    for (let i=0; i < list.length; i++) {
      let item = new ClippieHistoryItem(list[i], this.menu, this, current === list[i]);
      //this.menu.addMenuItem(item);
    }
  }

});

var ClippieCreateHistoryItem = GObject.registerClass(
class ClippieCreateHistoryItem extends PopupMenu.PopupMenuItem {
  _init(history_menu) {
    super._init("", { reactive: false, can_focus: false });

    this._clippie_menu = history_menu.clippie_menu;
    this._menu = history_menu.menu;
    this._clippie = this.clippie_menu.clippie;

    var layout = new St.BoxLayout({
      style_class: 'clippie-history-menu-item',
      pack_start: false,
      x_expand: true,
      y_expand: false,
      x_align: St.Align.START,
      vertical: false
    });

    this._entry = new St.Entry( {
      x_expand: true,
      y_expand: false,
      can_focus: true,
      track_hover: true,
      style_class: 'clippie-create-history-entry',
      x_align: St.Align.START,
      y_align: St.Align.START, // Clutter.ActorAlign.CENTER,
      hint_text: _("Create history")
    });

    let etext = this._entry.get_clutter_text();

    etext.set_activatable(true);
    etext.set_editable(true);
    etext.connect('activate', (etext) => {
      let name=etext.get_text();
      if (this.clippie.dbus_gpaste.switchHistory(name)) {
        logger.debug("Created new history %s", name);
        this.clippie_menu.rebuild(true);
      }
    });

    layout.add_child(this._entry);
    this.add(layout);

    history_menu.menu.addMenuItem(this);
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

var ClippieHistoryItem = GObject.registerClass(
class ClippieHistoryItem extends PopupMenu.PopupMenuItem {
  _init(name, menu, clippie_menu, current) {
    super._init("", { reactive: true, can_focus: true });

    this._menu = menu;
    this._clippie_menu = clippie_menu;
    this._clippie = clippie_menu.clippie;

    var layout = new St.BoxLayout({
      style_class: 'clippie-item-layout',
      pack_start: false,
      x_expand: true,
      y_expand: false,
      x_align: St.Align.START,
      vertical: false
    });

    this.add(layout);

    let size=this.clippie.dbus_gpaste.getHistorySize(name);
    if (size === undefined) {
      size=0;
    }
    this._size = new St.Label({
      style_class: 'clippie-history-size',
      x_expand: false,
      y_expand: false,
      track_hover: false,
      can_focus: false,
      x_align: St.Align.START,
      text: ""+size
    });
    this._size.set_text("%03d".format(size));

    this._name = new St.Label({
      style_class: 'clippie-menu-content',
      x_expand: true,
      y_expand: false,
      track_hover: false,
      x_align: St.Align.START,
      text: name
    });

    this._clear_icon = new St.Icon( {
      x_expand: false,
      y_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'edit-clear-symbolic',
      icon_size: 20
    });

    this._clear = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'clippie-history-clear-icon',
      child: this._clear_icon
    });

    this._clear.connect('enter_event', (btn, event) => {
      btn.set_label(_("Clear"));
    });

    this._clear.connect('leave_event', (btn, event) => {
      //btn.set_label(undefined);
      btn.set_label('');
      btn.set_child(this._clear_icon);
    });

    this._clear.connect('button_press_event', (btn, event) => {
      //btn.set_label(undefined);
      btn.set_label('');
      btn.set_child(this._clear_icon);
    });

    this._clear.connect('clicked', (btn) => {
      let name = this._name.get_text();
      if (this.clippie.dbus_gpaste.emptyHistory(name)) {
        logger.debug("cleared %s", name);
      }
    });

    this._delete_icon = new St.Icon( {
      x_expand: false,
      y_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'edit-delete-symbolic',
      icon_size: 20
    });

    this._delete = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'clippie-history-delete-icon',
      child: this._delete_icon
    });

    this._delete.connect('enter_event', (btn, event) => {
      btn.set_label(_('Delete'));
    });

    this._delete.connect('leave_event', (btn, event) => {
      btn.set_label('');
      btn.set_child(this._delete_icon);
    });

    this._delete.connect('button_press_event', (btn, event) => {
      //btn.set_label(undefined);
      btn.set_label('');
      btn.set_child(this._delete_icon);
    });

    this._delete.connect('clicked', (btn) => {
      let name = this._name.get_text();
      if (this.clippie.dbus_gpaste.deleteHistory(name)) {
        logger.debug("deleted %s", name);
        this.destroy();
      }
    });

    layout.add_child(this._size);
    layout.add_child(this._name);
    layout.add_child(this._clear);
    layout.add_child(this._delete);

    this._menu.addMenuItem(this);

    this.connect('activate', (self) => {
      let name = this._name.get_text();
      let current = this.clippie.dbus_gpaste.getHistoryName();
      if (name !== current) {
        logger.debug("clicked item=%s", name);
        this.clippie.dbus_gpaste.switchHistory(name);
        this.clippie.indicator.clippie_menu.history_menu_open(false);
        this.clippie.indicator.clippie_menu.rebuild();
        //this.clippie_menu.history_menu_open(false);
      } else {
        // don't switch histories if there is no change
        // mostly to avoid deleting password
      }
    });
  }

  get clippie_menu() {
    return this._clippie_menu;
  }

  get clippie() {
    return this._clippie;
  }
});



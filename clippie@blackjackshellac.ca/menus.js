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

const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const GETTEXT_DOMAIN = 'clippie-blackjackshellac';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Logger = Me.imports.logger.Logger;

const logger = new Logger('menus');

var ClippieMenu = class ClippieMenu {
  constructor(menu, clippie) {
    log("");
    this._menu = menu;

    this._clippie = clippie;

    logger.settings = clippie.settings;

    //logger.debug("menu style=%s", this.menu.box.style_class);
    //this.menu.box.style_class = 'clippie-menu-content';

    this._menu.connect('open-state-changed', (self, open) => {
      if (open) {
        logger.debug("Opening clippieMenu")
        this.build();
      } else {
        logger.debug("Closing ClippieMenu")
        // this.clippie.forEach( (clip) => {
        //   logger.debug("clip=%s", clip.uuid);
        // });
      }
    });
  }

  build() {
    this._menu.removeAll();
    this.clippie.refresh();

    let menu = this._menu;
    let more = undefined;
    for (let i=0; i < this.clippie.length; i++) {
      let clip=this.clippie[i];
      if (i === this.clippie.settings.entries) {
        more = new PopupMenu.PopupSubMenuMenuItem(_("More…"), { reactive: false } );
        menu.addMenuItem(more);
        menu = more.menu;
      }
      new ClipMenuItem(clip, menu);
    }
  }

  // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  _addSeparator() {
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  }

  get menu() {
    return this._menu;
  }

  get clippie() {
    return this._clippie;
  }
}

var ClipMenuItem = GObject.registerClass(
class ClipMenuItem extends PopupMenu.PopupMenuItem {
  _init(clip, menu) {
      super._init("", { reactive: true });

      this._clip = clip;

      var box = new St.BoxLayout({
        x_expand: true,
        x_align: St.Align.START,
        pack_start: true,
        style_class: 'clippie-menu-box'
      });
      this.add(box);

      var label = new St.Label({
        style_class: 'clippie-menu-content',
        x_expand: true,
        x_align: St.Align.START
      });
      label.set_text(clip.label_text());

      box.add_child(new ClipItemControlButton(clip, 'delete'));
      box.add_child(label);
      box.add_child(new ClipItemControlButton(clip, clip.password ? 'lock' : 'unlock'));

      this.connect('activate', (mi) => {
        logger.debug("Selected %s", mi.clip.uuid);
        if (mi.clip.select()) {
          mi.clip.clippie.indicator.rebuild_menu();
        }
      });

      //logger.debug("Adding clip %s", clip.uuid);
      menu.addMenuItem(this);
  }

  get clip() {
    return this._clip;
  }
});

var CICBTypes = {
  'lock': { icon: 'changes-prevent-symbolic', style: 'clippie-menu-password-icon' },
  'unlock': { icon: 'changes-allow-symbolic', style: 'clippie-menu-password-icon' },
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
        var icon = new St.Icon({
            icon_name: CICBTypes[type].icon,
            style_class: CICBTypes[type].style
        });
        icon.set_icon_size(20);

        this.child = icon;

        this.connect_type();
    }

    connect_type() {
        switch(this.type) {
        case "lock":
        case "unlock":
          this.connect('clicked', (cb) => {
            this.clip.toggle_password();
            this.rebuild();
          });
          break;
        case "delete":
          this.connect('clicked', (cb) => {
            this.clip.delete();
            this.rebuild();
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


# clippie

### Description

Gnome shell extension to interface with gpaste-client output

The purpose of this extension is to get some GPaste clipboard
functionality back for Gnome 40. It currently has the ability
to list the currently selected history.

I've added some search functionality to the panel menu. Eventually
there will be a preferences dialog accessible from the menu on
the top right.

There is a lock/unlock icon on the side of each item that can
be used to hide sensitive information. I'm looking into the possiblity
of password protecting this info, or having a pin.

### Requirements

Make sure gpaste-client is installed, and the daemon is running. For example, on Fedora,

```
$ sudo dnf install gpaste gpaste-ui gpaste-libs
...
$ gpaste-client daemon-reexec
$ gsettings set org.gnome.GPaste track-changes true
$ gsettings get org.gnome.GPaste track-changes
true
```

### Installation

Install from github using something like the following,

```
$ mkdir ~/github
$ cd ~/github
$ git clone https://github.com/blackjackshellac/clippie.git
$ cd clippie
$ ./install_local.sh
```

Restart the shell or logout and login.

The extension is installed in `~/.local/share/gnome-shell/extensions/clippie@blackjackshellac.ca`

### Preferences

There are some rudimentary controls for interacting with gpaste in the Preferences (top right menu button)

![image](https://user-images.githubusercontent.com/825403/114990482-8af38500-9e66-11eb-9a7c-4ca5eccef603.png)

and the dialog displayed when that button is clicked,

![image](https://user-images.githubusercontent.com/825403/114990724-cf7f2080-9e66-11eb-80d7-8a2ada0c87c7.png)



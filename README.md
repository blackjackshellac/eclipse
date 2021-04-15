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
$ sudo dnf install gpaste-client
...
$ gpaste-client daemon-reexec
$ gsettings set org.gnome.GPaste track-changes true
$ gsettings get org.gnome.GPaste track-changes
true
```

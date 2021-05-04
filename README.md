# eclipse

_formerly clippie_

### Description

Gnome shell extension to interface with gpaste-client output

The purpose of this extension is to get some GPaste clipboard
functionality back for Gnome 40. It currently has the ability
to list the currently selected history.

I've added some search functionality to the panel menu.

There is a lock/unlock icon on the side of each item that can
be used to hide sensitive information. The extension will now 
encrypt entries with a password and are shown with a key icon. When
an encrypted item is decrypted, its contents are saved as a GPaste
password entry with the same label.

The extension now uses dbus to communicate with the gpaste daemon 
rather than spawning gpaste-client. The openssl command line utility
must be installed to support encryption.

### Requirements

Make sure gpaste-client is installed, and the daemon is running. For encryption
support you also need openssl to be install. For example, on Fedora,

```
$ sudo dnf install gpaste gpaste-ui gpaste-libs openssl
...
$ gpaste-client daemon-reexec
```

### Installation

Install from github using something like the following,

```
$ mkdir ~/github
$ cd ~/github
$ git clone https://github.com/blackjackshellac/eclipse.git
$ cd eclipse
$ ./install_local.sh
```

Restart the shell or logout and login.

The extension is installed in `~/.local/share/gnome-shell/extensions/eclipse@blackjackshellac.ca`

### Clipboard Menu

Clicking the indicator icon brings down the main menu.  If there are more than 20 entries a More...
menu is created for the remainder.  You can search by content or password name in the search box.
The lock icon indicates a `[Password]` entry so it is hidden until selected and pasted.  Click on
an unlock icon to encrypt a clipboard item with a pin/password/passphrase.  Click on a key icon
to decrypt the encrypted item with the password you used previously.  If you encrypt something and
forget the password it's gone man, like 'keys in a lava flow'. When a clipboard icon is decrypted it
is shown as a GPaste Password item. Click on lock icon to rename a password entry.  Click on the 'X'
icon on the far right to delete the clipboard item.

![Screenshot from 2021-05-03 17-47-23](https://user-images.githubusercontent.com/825403/116938663-22175580-ac39-11eb-9815-262c38607465.png)

### Preferences

There are some rudimentary controls for interacting with gpaste in the Preferences (top right menu button)

![image](https://user-images.githubusercontent.com/825403/114990482-8af38500-9e66-11eb-9a7c-4ca5eccef603.png)

and the dialog displayed when that button is clicked,

![image](https://user-images.githubusercontent.com/825403/116744269-17a25500-a9c8-11eb-9c98-57dc8552ae99.png)


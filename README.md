# eclipse

_formerly clippie_

### Description

Gnome shell extension to interface with gpaste-client output,
and provide a means to _encrypt clipboard items_ with a pin/password
or pass phrase.

The purpose of this extension is to get some GPaste clipboard
functionality back for Gnome 40. It has support for gpaste
histories, and a More submenu to show all items in the history.
A search feature is available in the panel menu.

There is a lock/unlock icon on the side of each item that can
be used to hide sensitive information. The extension will now 
encrypt entries with a password and are shown with a key icon. When
an encrypted item is decrypted, its contents are saved as a GPaste
password entry with the same label.

The extension now uses dbus to communicate with the gpaste daemon 
rather than spawning gpaste-client.

### Encryption

eclipse uses openssl to encrypt entries and stores them back in the
current GPaste history in base64.  Encrypted items are encoded as
follows, with entries separated by `~~` characters,

```
~~eclipse~~Secret entry~~376f006d-6080-4d74-8606-8831cf5c5c69~~U2FsdGVkX181g3xGGkmuTdi90Orm7Wl30EXhHusS/vA0Xkhd50wqzNwttUHaZuys8ptDfvU4DqI7AuLbDsp0LCRvIcA2MBYBJ8KVgQyai9FYiMtX/Bhmn4Q2NDg7/C3fARnQNmYFoH6TyFnFk6PsbBdinimp/pdhzuh9JqlHR0E=~~

type: eclipse
label: Secret entry
eclipsed_uuid: 376f006d-6080-4d74-8606-8831cf5c5c69
enc_data: U2FsdGVkX181g3xGGkmuTdi90Orm7Wl30EXhHusS/vA0Xkhd50wqzNwttUHaZuys8ptDfvU4DqI7AuLbDsp0LCRvIcA2MBYBJ8KVgQyai9FYiMtX/Bhmn4Q2NDg7/C3fARnQNmYFoH6TyFnFk6PsbBdinimp/pdhzuh9JqlHR0E=
```

When an item is encrypted, the original item is deleted using the eclipsed uuid
stored in the encoded entry.

When the encrypted item is selected a dialog requests the encryption pass
phrase and deccrypts the result, duplicating it in a GPaste password entry with
the same label as the encrypted item, in this example it would be `[Password] Secret entry`.
The item is selected into the clipboard so once it has been used it can be
deleted.

![image](https://user-images.githubusercontent.com/825403/117049654-6ca0dc80-ace2-11eb-8fa1-24f9ddf58b5a.png)

One benefit to this approach is that encrypted items are securely persisted in the clipboard
history when changing histories, or restarting one's session.

The openssl command line utility must be installed to support encryption.  The extension
uses the following openssh commands for encryption and decryption respectively,

```
openssl enc -aes-256-cbc -pbkdf2 -A -a -pass stdin
openssl enc -aes-256-cbc -pbkdf2 -d -A -a -pass stdin
```

The password is never stored, and is passed to openssl using its standard input.  At the
command line the process would look like this,

```
# passord is passed in the first line to openssl's stdin, the encrypted data is
# everything else
$ echo -en "this is my passphrase\nand this is the secret that is being encrypted" \
> | openssl enc -aes-256-cbc -pbkdf2 -A -a -pass stdin
U2FsdGVkX19DMZlELabFmSs1dbzyPEJE+JmkqgmDfjtmDGXGRcNMhuYZ1fyUyN3+eiJFXlJQYlsNlHIt9EcCVA==
# for decryption we do the same with the passphrase in the first line and the encrypted
# base64 data following
$ echo -e "this is my passphrase\nU2FsdGVkX19DMZlELabFmSs1dbzyPEJE+JmkqgmDfjtmDGXGRcNMhuYZ1fyUyN3+eiJFXlJQYlsNlHIt9EcCVA==" \
> | openssl enc -aes-256-cbc -pbkdf2 -d -A -a -pass stdin 
and this is the secret that is being encrypted
```

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

![image](https://user-images.githubusercontent.com/825403/117047625-1af75280-ace0-11eb-88ef-e221cdab8db6.png)



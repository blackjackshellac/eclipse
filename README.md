# eclipse

_formerly clippie_

### Description

The **eclipse** gnome shell extension provides a ways to encrypt and 
access *GPaste* histories. Currently, the password/passphrase/pin is only limited
to greater than 4 characters. Of course, depending on the sensitivity
of the entry being encrypted a secure password should be used to 
encrypt your password entries.

The original purpose of this extension was to get some *GPaste* clipboard
functionality back for *Gnome 40*. It has support for *GPaste*
histories, and a More submenu to show all items in the history.
A search feature is available in the main menu.

There is a lock/unlock icon on the left side of each item that can
be used to hide sensitive information. The extension will  
encrypt entries with a password and once encrypted are preceded by a key icon.
When an encrypted item is decrypted, its contents are saved as a GPaste
password entry with the same label.

An encrypted clipboard entry (**eclip**) is automatically saved to disk
in the ~/.config/eclipse/eclips directory.  This behaviour can be changed
or disabled in the preferences dialog box.

The extension uses dbus to communicate with the gpaste daemon.

### Encryption

eclipse uses openssl to encrypt entries and stores them back in the
current GPaste history in base64 encoded format.  Encrypted items 
are encoded as follows, with entries separated by `~~` delimiters,

```
~~eclipse~~Secret entry~~376f006d-6080-4d74-8606-8831cf5c5c69~~U2FsdGVkX181g3xGGkmuTdi90Orm7Wl30EXhHusS/vA0Xkhd50wqzNwttUHaZuys8ptDfvU4DqI7AuLbDsp0LCRvIcA2MBYBJ8KVgQyai9FYiMtX/Bhmn4Q2NDg7/C3fARnQNmYFoH6TyFnFk6PsbBdinimp/pdhzuh9JqlHR0E=~~

type: eclipse
label: Secret entry
uuid: 376f006d-6080-4d74-8606-8831cf5c5c69
eclip: U2FsdGVkX181g3xGGkmuTdi90Orm7Wl30EXhHusS/vA0Xkhd50wqzNwttUHaZuys8ptDfvU4DqI7AuLbDsp0LCRvIcA2MBYBJ8KVgQyai9FYiMtX/Bhmn4Q2NDg7/C3fARnQNmYFoH6TyFnFk6PsbBdinimp/pdhzuh9JqlHR0E=
```

When an item is encrypted, the original item is deleted using the *GPaste*
uuid.

When the encrypted item is selected a dialog requests the encryption pass
phrase and decrypts the result, duplicating it in a GPaste password entry with
the same label as the encrypted item, in this example it would be `[Password] Secret entry`.
The item is selected into the clipboard so once it has been used it can be
deleted.

![image](https://user-images.githubusercontent.com/825403/117049654-6ca0dc80-ace2-11eb-8fa1-24f9ddf58b5a.png)

One benefit to this approach is that **eclips** are securely persisted in the clipboard
history when changing histories, or restarting one's session. Note that *GPaste Password*
entries are not persisted when changing histories.

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

Make sure *gpaste-client* is installed, and the daemon is running. For encryption
support you also need *openssl* to be installed. For example, on Fedora,

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
The lock icon indicates a *GPaste* `[Password]` entry so it is hidden until selected and pasted.  Click on
an unlock icon to encrypt a clipboard item with a pin/password/passphrase.  Click on a key icon
to decrypt the encrypted item with the password you used for its encryption.  If you encrypt something and
forget the password it's gone man, like *keys in a lava flow*. When a clipboard icon is decrypted it
is shown as a *GPaste* `[Password]` item. Click on lock icon to rename a password entry.  Click on the 'X'
icon on the far right to delete the clipboard item.

![Screenshot from 2021-05-03 17-47-23](https://user-images.githubusercontent.com/825403/116938663-22175580-ac39-11eb-9815-262c38607465.png)

### Preferences

Preferences button can be found to the right of the search entry in the main menu.

![Screenshot-20210517090520-764x504](https://user-images.githubusercontent.com/825403/118493723-6867bc80-b6ef-11eb-9dcd-5277b513d0df.png)


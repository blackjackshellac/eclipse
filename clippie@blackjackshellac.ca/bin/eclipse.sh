#!/bin/bash

ME=$(basename $0 .sh)
MD=$(dirname $0)

add_password() {
	local name="$1"
	shift
	local pass="$*"
	echo gpaste-client add-password "$name"
	echo $pass | gpaste-client add-password "$name"
	[ $? -ne 0 ] && echo "failed to add password $name" && exit 1
}

cd $MD
while read line; do
	name=$(echo $line | cut -f1 -d':')
	pass=$(echo $line | cut -f2- -d':')
	add_password "$name" "$pass"
done < <(gpg -q -d $ME.gpg)

exit 0

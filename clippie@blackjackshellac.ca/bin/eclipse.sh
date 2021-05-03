#!/bin/bash

ME=$(basename $0 .sh)
MD=$(dirname $0)

#
# save eclipse to $ME.txt with something like
#
# gpaste-client --oneline | cut -f2 -d':' | grep "^ ~~eclipse~~" > $MD/$ME.txt
#
add() {
	local name="$*"
	echo gpaste-client add "$name"
	echo $pass | gpaste-client add "$name"
	[ $? -ne 0 ] && echo "failed to add $name" && exit 1
}

cd $MD
while read line; do
	add "$line"
done < <(cat $ME.txt | grep -v ^#)


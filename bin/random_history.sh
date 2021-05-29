#!/bin/bash

ME=$(basename $0)
MD=$(dirname $0)
cd $MD

if [ ! -f "$1" ]; then
	echo "Usage is: $ME sentence_file.txt"
	exit 1
fi

file=$1
history="${file%.*}"

echo $history

gpaste-client switch-history "$history"
while read line ; do
	echo $line | gpaste-client
done < <(cat $file)

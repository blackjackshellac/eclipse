#!/bin/bash

ME=$(basename $0)
MD=$(dirname $0)
cd $MD

gpaste-client switch-history examples
while read line ; do
	echo $line | gpaste-client
done < <(cat examples.txt)

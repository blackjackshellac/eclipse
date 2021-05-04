#!/bin/bash
#
# export the current gpaste history
#
# prints filename to stdout
#
# if it detects Password entries it prints them to
# stderr and returns with a non-zero exit code
#

# make the file secure
umask 0077

[ $# -ne 0 -a -d "$1" ] && cd "$1"
bdir=$(pwd)
now=$(date +%Y%m%d_%H%M%S)
history=$(gpaste-client get-history)
backup="${bdir}/${history}_${now}.txt"
echo $backup
gpaste-client --oneline | sed 's/^[-0-9a-f]*: //g' > "$backup"
out=$(grep '^\[Password\] ' "$backup")
[ $? -eq 0 ] && echo -e "$out" 1>&2 && exit 1
exit 0

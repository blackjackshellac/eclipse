#!/bin/bash

ME=$(basename $0)
MD=$(cd $(dirname $0); pwd)

echo $MD
cd $MD/../eclipse@blackjackshellac.ca
[ $? -ne 0 ] && echo "Failed to change to extension directory" && exit 1

echo Working in $(pwd)

pot='po/eclipse-blackjackshellac.pot'
opts="--from-code=UTF-8 -F -j --output=$pot"
#opts="$opts --copyright-holder=SteeveMcCauley"
#--foreign-user
#omit FSF copyright in output for foreign user
opts="$opts --package-name=eclipse-blackjackshellac"
#opts="$opts --package-version='5'"
files="*.js *.ui schemas/*.xml"
files="*.js schemas/*.xml"

cmd="xgettext $opts $files $pot"
echo $cmd
$cmd

# # SOME DESCRIPTIVE TITLE.
#-# Copyright (C) YEAR Copyright (C) 2021, Steeve McCauley
#+# Copyright (C) 2021, Steeve McCauley
# # This file is distributed under the same license as the eclipse-blackjackshellac package.
# # FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
# #
#@@ -8,7 +8,7 @@ msgid ""
# msgstr ""
# "Project-Id-Version: eclipse-blackjackshellac\n"
# "Report-Msgid-Bugs-To: \n"
#-"POT-Creation-Date: 2021-01-03 10:34-0500\n"
#+"POT-Creation-Date: 2021-01-03 11:22-0500\n"
# "PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\n"
# "Last-Translator: FULL NAME <EMAIL@ADDRESS>\n"
# "Language-Team: LANGUAGE <LL@li.org>\n"

sed -i 's/SOME DESCRIPTIVE TITLE./Clippie/' $pot
sed -i 's/YEAR THE PACKAGE.S COPYRIGHT HOLDER/2021, Steeve McCauley/' $pot
sed -i 's/FIRST AUTHOR/Steeve McCauley/' $pot
sed -i 's/EMAIL.ADDRESS/steeve.mccauley@gmail.com/' $pot
sed -i 's/FULL NAME/Steeve McCauley/' $pot
sed -i 's/, YEAR./, 2001/' $pot
now=$(date "+%Y-%m-%d %H:%M%z")
sed -i "s/YEAR.MO.DA HO.MI.ZONE/$now/" $pot

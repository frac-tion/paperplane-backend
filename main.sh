#!/bin/bash

if [ "$1" == "--start" ] ; then
  echo start Service
  avahi-publish -s paperplane _http._tcp 3000 "Download this files"
fi


#pp --send ip file
if [ "$1" == "--send" ] ; then
  if [ "$2" != "" ] ; then
    if [ "$3" != "" ] ; then
      node server.js $3
      curl $2:3000?action=file_offer
    fi
  fi
fi

#pp --list ip file
if [ "$1" == "--list" ] ; then
  avahi-browse -lr -t _http._tcp
fi

#!/bin/sh
ncu -u
for d in ./packages/* ; do (cd "$d" && ncu -u); done
#!/bin/sh
set -eu
case "$1" in
  ''|/*|*../*|../*|*/..|*\\*) exit 2 ;;
esac
ulimit -t 8
ulimit -f 65536
ulimit -n 64
/rust-toolchain/bin/rustc --sysroot /rust-toolchain \
  --edition=2021 --crate-type bin --crate-name frank_addon \
  -C opt-level=0 -C "linker=$2" -o /tmp/frank-executable "/addon/$1" 1>&2
exec /tmp/frank-executable

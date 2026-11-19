#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
VERSION=3.24.1
ALPINE=https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/aarch64
NAME="alpine-minirootfs-$VERSION-aarch64.tar.gz"
VM_DIR="$HOME/vms/alpine"
DEST="$VM_DIR/rootfs.ext4"
mkdir -p "$VM_DIR"
if [[ -e "$DEST" ]]; then
  printf 'Refusing to overwrite existing disk: %s\n' "$DEST" >&2
  exit 3
fi
for cmd in curl tar sha256sum truncate mke2fs qemu-system-aarch64; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }
done
for file in vmlinuz-virt initramfs-virt; do
  [[ -s "$VM_DIR/$file" ]] || { echo "Missing $VM_DIR/$file" >&2; exit 2; }
done
WORK="$(mktemp -d "$VM_DIR/.build.XXXXXXXX")"
trap 'rm -rf -- "$WORK"' EXIT
curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --max-time 150 -o "$WORK/$NAME" "$ALPINE/$NAME"
curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --max-time 60 -o "$WORK/$NAME.sha256" "$ALPINE/$NAME.sha256"
(cd "$WORK" && sha256sum --check --strict "$NAME.sha256")
mkdir -p "$WORK/root"
tar --no-same-owner -xzf "$WORK/$NAME" -C "$WORK/root"
for dir in proc sys dev run tmp; do mkdir -p "$WORK/root/$dir"; done
mkdir -p "$WORK/root/etc/apk"
cat > "$WORK/root/etc/apk/repositories" <<'REPOS'
https://dl-cdn.alpinelinux.org/alpine/v3.24/main
https://dl-cdn.alpinelinux.org/alpine/v3.24/community
REPOS
printf 'parallaxis\n' > "$WORK/root/etc/hostname"
cat > "$WORK/root/etc/inittab" <<'INITTAB'
::sysinit:/bin/mount -t proc proc /proc
::sysinit:/bin/mount -t sysfs sysfs /sys
::sysinit:/bin/mount -t devtmpfs devtmpfs /dev
::sysinit:/bin/hostname -F /etc/hostname
ttyAMA0::respawn:/bin/sh -l
::ctrlaltdel:/bin/umount -a -r
INITTAB
[[ -e "$WORK/root/sbin/init" ]] || ln -s /bin/busybox "$WORK/root/sbin/init"
truncate -s 2G "$WORK/rootfs.ext4"
mke2fs -t ext4 -F -d "$WORK/root" -L PX_ALPINE "$WORK/rootfs.ext4"
if [[ -e "$DEST" ]]; then echo 'Disk appeared during build' >&2; exit 3; fi
mv -- "$WORK/rootfs.ext4" "$DEST"
printf 'PX_ROOTFS_CREATED=%s\n' "$DEST"

#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
VM_DIR="$HOME/vms/alpine"
RAM_MB=768
SSH_PORT=2222
for f in rootfs.ext4 vmlinuz-virt initramfs-virt; do
  [[ -s "$VM_DIR/$f" ]] || { echo "Missing $VM_DIR/$f" >&2; exit 2; }
done
exec qemu-system-aarch64 \
  -machine virt -cpu cortex-a72 -accel tcg,thread=multi \
  -smp 2 -m "$RAM_MB" -display none -monitor none -serial stdio \
  -kernel "$VM_DIR/vmlinuz-virt" -initrd "$VM_DIR/initramfs-virt" \
  -append 'console=ttyAMA0 root=/dev/vda rw rootfstype=ext4 rootwait modules=virtio,virtio_mmio,virtio_blk,ext4 init=/sbin/init' \
  -drive "if=none,id=rootdisk,file=$VM_DIR/rootfs.ext4,format=raw,cache=writeback" \
  -device virtio-blk-device,drive=rootdisk \
  -netdev "user,id=guestnet,hostfwd=tcp:127.0.0.1:$SSH_PORT-:22" \
  -device virtio-net-device,netdev=guestnet

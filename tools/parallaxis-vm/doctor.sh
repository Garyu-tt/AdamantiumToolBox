#!/data/data/com.termux/files/usr/bin/bash
set -u
VM_DIR="$HOME/vms/alpine"
printf 'PX_VM_DIR=%s\n' "$VM_DIR"
for item in bash qemu-system-aarch64 qemu-img mke2fs curl tar sha256sum; do
  if command -v "$item" >/dev/null 2>&1; then printf 'OK %s\n' "$item"; else printf 'MISSING %s\n' "$item"; fi
done
for file in vmlinuz-virt initramfs-virt root.qcow2 rootfs.ext4; do
  if [[ -s "$VM_DIR/$file" ]]; then printf 'PRESENT %s\n' "$file"; else printf 'ABSENT %s\n' "$file"; fi
done
printf 'No state was changed.\n'

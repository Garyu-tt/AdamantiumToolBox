# ParallaXis Alpine VM bootstrap v0.3.0

Independent rootless Termux/QEMU installer. Not a Proxmox hypervisor
nor an Android system replacement. It preserves the stock firmware,
HTC XR runtime, installed APKs and legacy root.qcow2.

### Evidence and status
On HTC VIVE XR Series, ADB and Termux work, QEMU 11.1.3 runs and the
original Alpine netboot initramfs booted to a shell. That was not an
installed persistent guest. No successful ext4 guest boot is yet verified.

### Usage (inside Termux)
    pkg install -y e2fsprogs curl tar
    bash doctor.sh
    bash prepare.sh
    bash start.sh

Pre-existing VM kernel and initramfs at `~/vms/alpine` are required.
The installer pins Alpine minirootfs ARM64 3.24.1 and verifies its
official SHA-256, creating a new 2 GB raw ext4 rootfs image only if
`rootfs.ext4` is absent.

If the boot lands in initramfs, diagnose virtio and root mount before
claiming success. This is early provisioning, not production hardened.

### Guest networking and USB-only access
After the serial root shell is confirmed on the guest:

    ip link set eth0 up
    udhcpc -i eth0
    printf 'nameserver 10.0.2.3\n' > /etc/resolv.conf
    apk update

Configure an SSH public key and install openssh inside the guest, then
start sshd. QEMU listens only on Android 127.0.0.1:2222.

From the USB-connected notebook:
    adb forward tcp:8022 tcp:2222
    ssh -p 8022 root@127.0.0.1

Use `adb forward --remove tcp:8022` to remove the tunnel. VM graphics
and OpenXR display composition are out of scope until a guest and video
bridge are proven. Termux must remain active; reboot persistence is not
yet verified.

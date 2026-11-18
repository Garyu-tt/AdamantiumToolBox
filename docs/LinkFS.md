# Adamantium Toolbox LinkFS v1

Source of navigation: the actual directory tree under installation/interface.
A folder name is the displayed folder name. Rename it to rename the menu folder.
Create an empty folder to create a new section, even without app references.
Folders may be nested (up to 8 levels); directories and references are rescanned live.

App references are UTF-8 JSON files named <visible label>.appref.json:
{"schema":"mas-appref-1","app":"editor","view":"editor.view"}

One app can have references in any number of folders. The package is not copied.
Real package code and its MAS manifest stay in apps/<package-id>.
The reference resolves only when the target MAS capability is live and authorized.
Removing or renaming a reference changes navigation, not the installed app.
No arbitrary paths, executable commands, or user-supplied URLs are accepted.
Symlinks/junctions inside interface are NOT traversed.

Backend graph links: each MAS manifest may declare connections, for example:
{"from":"editor.view","to":"studio.view","type":"related"}
Such edges are materialized only when both endpoints actually exist and are
authorized; declaring a link does not create API capabilities or bypass ACL.
Frontend graph and explicit bridge links are separate schemas.

An Android .apk is not a Windows executable or a link descriptor.
Future Android APK support requires a separately authorized adapter; copying
an APK into interface does not execute or install it.

Web/NeuroCMS consumers should receive a scoped, filtered LinkFS view
and must not get arbitrary filesystem traversal or native shortcut execution.

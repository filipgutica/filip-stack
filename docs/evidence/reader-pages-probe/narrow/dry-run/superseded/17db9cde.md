# sackview

See what’s inside a ZIP archive before you unpack it.

List entry names, compressed sizes, and unpacked sizes. Check the total unpacked size against your available disk space before extracting elsewhere.

## Install

```sh
pipx install sackview
```

## Inspect an archive

List the archive’s entries:

```sh
sackview inspect photos.zip
```

Show the ten entries with the largest unpacked sizes, largest first:

```sh
sackview inspect photos.zip --largest 10
```

Show only entries whose names match a pattern:

```sh
sackview inspect photos.zip --find '*.csv'
```

## Keep your archive unchanged

sackview never extracts entries or changes the archive. Inspection works offline and sends no archive contents to a service.

## Supported formats

sackview supports ZIP archives only. Other archive formats produce an unsupported-format message.

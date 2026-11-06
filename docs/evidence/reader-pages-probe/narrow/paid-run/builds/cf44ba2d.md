# sackview

See what is inside a ZIP archive before you unpack it. Check entry names, compressed and unpacked sizes, and the total unpacked size.

## Install

```sh
pipx install sackview
```

## Inspect an archive

List the entries in a ZIP archive:

```sh
sackview inspect photos.zip
```

Each entry shows its name, compressed size, and unpacked size. The total unpacked size helps you check available disk space before extracting elsewhere.

## Find the largest entries

Show the ten entries with the largest unpacked sizes, largest first:

```sh
sackview inspect photos.zip --largest 10
```

## Filter by name

Show only entries whose names match a pattern:

```sh
sackview inspect photos.zip --find '*.csv'
```

## Inspect without extracting

sackview never extracts entries or changes the archive. Inspection works offline and sends no archive contents to a service.

## Supported format

sackview supports ZIP archives only. Other archive formats produce an unsupported-format message.

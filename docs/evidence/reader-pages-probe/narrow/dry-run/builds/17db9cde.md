# See what is inside a ZIP before you unpack it

sackview shows what is inside a ZIP archive before you unpack it. It displays the total unpacked size so you can check available disk space before extracting elsewhere.

```sh
pipx install sackview
```

Each entry shows its name, compressed size, and unpacked size.

## Inspect an archive

```sh
sackview inspect photos.zip
```

This command lists the archive’s entries.

## Commands

### Find the largest entries

```sh
sackview inspect photos.zip --largest 10
```

This command shows the ten entries with the largest unpacked sizes, largest first.

### Filter entries by name

```sh
sackview inspect photos.zip --find '*.csv'
```

This command shows only entries whose names match the pattern.

## Good to know

### Archive safety

sackview never extracts entries or changes the archive.

### Privacy

Inspection works offline and sends no archive contents to a service.

### Supported formats

sackview supports ZIP archives only. Other archive formats produce an unsupported-format message and return exit code 24.

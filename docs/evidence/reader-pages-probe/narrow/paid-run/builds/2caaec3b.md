# See inside a ZIP before you unpack it

sackview shows what is inside a ZIP archive before you unpack it. It displays the total unpacked size so you can check available disk space before extracting elsewhere.

Install sackview:

```sh
pipx install sackview
```

Each entry shows its name, compressed size, and unpacked size.

## Inspect an archive

List the entries in `photos.zip`:

```sh
sackview inspect photos.zip
```

## Commands

Show the ten entries with the largest unpacked sizes, largest first:

```sh
sackview inspect photos.zip --largest 10
```

Show only entries whose names match `*.csv`:

```sh
sackview inspect photos.zip --find '*.csv'
```

## Good to know

### Archive safety

sackview never extracts entries or changes the archive.

### Privacy

Inspection works offline and sends no archive contents to a service.

### Supported formats

sackview supports ZIP archives only. Other archive formats produce an unsupported-format message and return exit code 24.

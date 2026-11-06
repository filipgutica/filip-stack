# See inside a ZIP archive before you unpack it

sackview lists the entries in a ZIP archive, with their compressed and unpacked sizes.

```sh
pipx install sackview
```

ZIP archives only · Offline inspection · No extraction

## Inspect an archive

```sh
sackview inspect photos.zip
```

Lists the archive’s entries.

## Commands

Show the ten entries with the largest unpacked sizes, largest first:

```sh
sackview inspect photos.zip --largest 10
```

Show only entries whose names match `*.csv`:

```sh
sackview inspect photos.zip --find '*.csv'
```

## Keys

Each entry shows three fields:

| Field | Meaning |
| --- | --- |
| Name | The entry’s name |
| Compressed size | The entry’s size inside the ZIP archive |
| Unpacked size | The entry’s size when unpacked |

## Check disk space

sackview displays the total unpacked size so you can check available disk space before extracting elsewhere.

## Good to know

**Archive contents**  
sackview never extracts entries or changes the archive.

**Privacy**  
Inspection sends no archive contents to a service.

**Unsupported formats**  
Formats other than ZIP produce an unsupported-format message and exit code `24`.

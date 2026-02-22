# Image Metadata Stripper

An Obsidian plugin that automatically strips privacy-sensitive metadata from images and PDFs when they are added to your vault.

## Features

- Automatically strips metadata from files as they enter the vault
- Manual stripping via right-click context menu
- Bulk strip all existing vault files at once
- Per-format toggles for fine-grained control
- Option to preserve ICC color profiles

## What gets removed

| Format | Metadata removed |
|--------|-----------------|
| JPEG | EXIF, IPTC, XMP, comment data |
| PNG | Text chunks, EXIF data |
| WebP | EXIF, XMP data |
| PDF | Info dictionary, XMP metadata packets |

## Installation

### Community plugins (recommended)

1. Open **Settings > Community plugins**
2. Click **Browse** and search for "Image Metadata Stripper"
3. Click **Install**, then **Enable**

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` (if present) from the latest release
2. Create a folder `image-metadata-stripper` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Enable the plugin in **Settings > Community plugins**

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable metadata stripping | On | Automatically strip metadata from supported files added to the vault |
| Strip JPEG metadata | On | Remove EXIF, IPTC, XMP, and comment data from JPEG images |
| Strip PNG metadata | On | Remove text chunks and EXIF data from PNG images |
| Strip WebP metadata | On | Remove EXIF and XMP data from WebP images |
| Strip PDF metadata | On | Remove Info dictionary and XMP metadata from PDF files |
| Keep color profiles | On | Preserve ICC color profile data to maintain color accuracy |
| Show notifications | On | Display a notice when metadata is stripped |

## Privacy

This plugin processes all files locally within your vault. No data is sent to any external service. Metadata is permanently removed from the file — this cannot be undone.

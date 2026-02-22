import { App, PluginSettingTab, Setting } from "obsidian";
import type ImageMetadataStripperPlugin from "./main";

export class ImageMetadataStripperSettingTab extends PluginSettingTab {
	plugin: ImageMetadataStripperPlugin;

	constructor(app: App, plugin: ImageMetadataStripperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable metadata stripping")
			.setDesc("Automatically strip metadata from supported files added to the vault.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip JPEG metadata")
			.setDesc("Remove EXIF, IPTC, XMP, and comment data from JPEG images.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripJpeg)
					.onChange(async (value) => {
						this.plugin.settings.stripJpeg = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip PNG metadata")
			.setDesc("Remove text chunks and EXIF data from PNG images.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripPng)
					.onChange(async (value) => {
						this.plugin.settings.stripPng = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip WebP metadata")
			.setDesc("Remove EXIF and XMP data from WebP images.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripWebp)
					.onChange(async (value) => {
						this.plugin.settings.stripWebp = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip PDF metadata")
			.setDesc("Remove Info dictionary and XMP metadata from PDF files.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripPdf)
					.onChange(async (value) => {
						this.plugin.settings.stripPdf = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Keep color profiles")
			.setDesc(
				"Preserve ICC color profile data. Disabling may slightly alter color rendering."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.keepColorProfiles)
					.onChange(async (value) => {
						this.plugin.settings.keepColorProfiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show notifications")
			.setDesc("Display a notice when metadata is stripped from an image.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showNotifications)
					.onChange(async (value) => {
						this.plugin.settings.showNotifications = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip all vault files")
			.setDesc(
				"Strip metadata from all existing images and PDFs in the vault. This cannot be undone."
			)
			.addButton((button) =>
				button
					.setButtonText("Strip all")
					.setWarning()
					.onClick(() => this.plugin.stripAllVaultFiles())
			);
	}
}

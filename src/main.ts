import { Menu, MenuItem, Notice, Plugin, TFile } from "obsidian";
import {
	ImageMetadataStripperSettings,
	DEFAULT_SETTINGS,
	StripResult,
} from "./types";
import { ImageMetadataStripperSettingTab } from "./settings";
import { stripJpegMetadata } from "./strippers/jpeg";
import { stripPngMetadata } from "./strippers/png";
import { stripWebpMetadata } from "./strippers/webp";
import { stripPdfMetadata } from "./strippers/pdf";

const SUPPORTED_EXTENSIONS: Record<
	string,
	{
		settingKey: keyof ImageMetadataStripperSettings;
		strip: (buf: ArrayBuffer, keepIcc: boolean) => StripResult;
	}
> = {
	jpg: { settingKey: "stripJpeg", strip: stripJpegMetadata },
	jpeg: { settingKey: "stripJpeg", strip: stripJpegMetadata },
	png: { settingKey: "stripPng", strip: stripPngMetadata },
	webp: { settingKey: "stripWebp", strip: stripWebpMetadata },
	pdf: { settingKey: "stripPdf", strip: stripPdfMetadata },
};

export default class ImageMetadataStripperPlugin extends Plugin {
	settings: ImageMetadataStripperSettings = DEFAULT_SETTINGS;
	private processing: Set<string> = new Set();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ImageMetadataStripperSettingTab(this.app, this));

		// Register event inside onLayoutReady to avoid processing all existing vault files on startup
		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.vault.on("create", (file) => {
					if (file instanceof TFile) {
						this.handleFile(file);
					}
				})
			);
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (
					file instanceof TFile &&
					SUPPORTED_EXTENSIONS[file.extension.toLowerCase()]
				) {
					menu.addItem((item: MenuItem) =>
						item
							.setTitle("Strip metadata")
							.setIcon("file-minus")
							.onClick(() => this.stripFile(file))
					);
				}
			})
		);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async handleFile(file: TFile): Promise<void> {
		if (!this.settings.enabled) return;

		const ext = file.extension.toLowerCase();
		const handler = SUPPORTED_EXTENSIONS[ext];
		if (!handler) return;

		if (!this.settings[handler.settingKey]) return;

		await this.stripFile(file, this.settings.showNotifications);
	}

	private async stripFile(
		file: TFile,
		notify = true
	): Promise<boolean> {
		try {
			const ext = file.extension.toLowerCase();
			const handler = SUPPORTED_EXTENSIONS[ext];
			if (!handler) return false;

			// Re-entrancy guard: modifyBinary triggers another create event
			if (this.processing.has(file.path)) return false;

			this.processing.add(file.path);

			try {
				const buffer = await this.app.vault.readBinary(file);
				const result = handler.strip(
					buffer,
					this.settings.keepColorProfiles
				);

				if (!result.stripped) {
					if (notify) {
						new Notice(
							`No metadata found in ${file.name}`
						);
					}
					return false;
				}

				await this.app.vault.modifyBinary(file, result.data);

				if (notify) {
					new Notice(
						`Stripped ${result.segmentsRemoved} metadata segment${result.segmentsRemoved !== 1 ? "s" : ""} from ${file.name}`
					);
				}

				return true;
			} finally {
				// Clear guard after a delay to handle any queued events
				setTimeout(() => {
					this.processing.delete(file.path);
				}, 2000);
			}
		} catch (err) {
			console.error(
				`Image Metadata Stripper: error processing ${file.path}:`,
				err
			);
			return false;
		}
	}

	async stripAllVaultFiles(): Promise<void> {
		const files = this.app.vault
			.getFiles()
			.filter((f) => SUPPORTED_EXTENSIONS[f.extension.toLowerCase()]);

		let stripped = 0;
		for (const file of files) {
			if (await this.stripFile(file)) {
				stripped++;
			}
		}

		new Notice(
			`Stripped metadata from ${stripped} of ${files.length} file${files.length !== 1 ? "s" : ""}`
		);
	}
}

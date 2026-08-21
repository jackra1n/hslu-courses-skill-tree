import catalogJson from './catalog.generated.json';
import type { CatalogData } from './catalog-types';

const bundledCatalog = catalogJson as CatalogData;

export function loadBundledCatalog(): CatalogData {
	if (bundledCatalog.schemaVersion !== 1) {
		throw new Error(
			`Unsupported catalog schema version: ${bundledCatalog.schemaVersion}`,
		);
	}
	return bundledCatalog;
}

import catalogAssetUrl from './catalog.generated.json?url';
import { createCatalogClient } from './catalog-client';
import type { CatalogData } from './catalog-types';

export { catalogAssetUrl };

const client = createCatalogClient(catalogAssetUrl, fetch);

export function loadCatalog(): Promise<CatalogData> {
	return client.load();
}

export function getCatalog(): CatalogData {
	return client.get();
}

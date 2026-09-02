// Prospecting owns these signatures (prospecting/api.py). The suite glob-links
// this file to frontend/src/api/prospecting.js so Vue can import `@/api/prospecting`.
export const prospectingApi = {
  // search & import
  searchPlaces: 'prospecting.api.search_places',
  importProspects: 'prospecting.api.import_prospects',

  // prospect lifecycle
  deleteProspects: 'prospecting.api.delete_prospects',
  dismissProspects: 'prospecting.api.dismiss_prospects',
  restoreProspects: 'prospecting.api.restore_prospects',
  pushToCrm: 'prospecting.api.push_to_crm',

  // lists
  moveToList: 'prospecting.api.move_to_list',
  removeFromList: 'prospecting.api.remove_from_list',
  deleteList: 'prospecting.api.delete_list',
  getListsWithCounts: 'prospecting.api.get_lists_with_counts',

  // enrichment
  enrichEmail: 'prospecting.api.enrich_email',
  findOwnerNames: 'prospecting.api.find_owner_names',

  // categories
  getAllCategories: 'prospecting.api.get_all_categories',
  getPlaceCategories: 'prospecting.api.get_place_categories',
  saveCategories: 'prospecting.api.save_categories',

  // settings
  getApiSettings: 'prospecting.api.get_api_settings',
  saveApiSettings: 'prospecting.api.save_api_settings',
  getMapsApiKey: 'prospecting.api.get_maps_api_key',
}

/**
 * Phase 2 — canonical location catalog (Division → Village).
 * Legacy routes import via `@/lib/locations/location-master-service` re-export.
 */
export {
  type LocationMasterRow,
  type LocationMasterSearchHit,
  type LocationSearchLevel,
  type LocationTreeChildDistrict,
  type LocationTreeChildUnion,
  type LocationTreeChildUpazila,
  type LocationTreeNode,
  getLocationTree,
  listDistrictsMaster,
  listDivisionsMaster,
  listUnionsMaster,
  listUpazilasMaster,
  listVillagesMaster,
  searchLocationsMaster,
} from '../../legacy/web/lib/locations/location-master-service.js';

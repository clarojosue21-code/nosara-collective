// Single source of truth for which "bundle" properties are made of which
// individual properties (by slug). Used to keep blocked_dates consistent
// both ways:
//  - booking a bundle must also block its components' own calendars
//  - checking availability of a component must also consider any bundle
//    that contains it, and checking a bundle must union its components
const BUNDLE_COMPONENTS = {
  'arcilla-bundle': ['arcilla1', 'arcilla2'],
  'arcilla-ojos-bundle': ['arcilla1', 'arcilla2', 'ojosazules'],
  'sol-mar-bundle': ['sol', 'mar'],
};

// Reverse index: slug -> list of bundle slugs that contain it
const CONTAINING_BUNDLES = {};
Object.entries(BUNDLE_COMPONENTS).forEach(([bundleSlug, components]) => {
  components.forEach((c) => {
    if (!CONTAINING_BUNDLES[c]) CONTAINING_BUNDLES[c] = [];
    CONTAINING_BUNDLES[c].push(bundleSlug);
  });
});

module.exports = { BUNDLE_COMPONENTS, CONTAINING_BUNDLES };

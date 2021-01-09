const { legacyFakeTimers, modernFakeTimers } = global;

require('zone.js');
require('zone.js/dist/zone-testing');

if (Zone && Zone.patchJestObject) {
    Zone.patchJestObject(legacyFakeTimers);
    Zone.patchJestObject(modernFakeTimers);
}

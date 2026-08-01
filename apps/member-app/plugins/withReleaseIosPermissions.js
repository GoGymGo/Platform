const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withFinalizedMod } = require('expo/config-plugins');

const releaseOnlyInfoPlistKeys = [
  'NSBonjourServices',
  'NSLocalNetworkUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSMotionUsageDescription'
];

module.exports = function withReleaseIosPermissions(config) {
  return withFinalizedMod(config, ['ios', async (updatedConfig) => {
    const infoPlistPath = path.join(
      updatedConfig.modRequest.platformProjectRoot,
      updatedConfig.modRequest.projectName,
      'Info.plist'
    );
    const infoPlist = plist.parse(await readFile(infoPlistPath, 'utf8'));
    for (const key of releaseOnlyInfoPlistKeys) {
      delete infoPlist[key];
    }
    await writeFile(infoPlistPath, plist.build(infoPlist));
    return updatedConfig;
  }]);
};

import { instead } from "spitroast"; // Assuming you have this from entry.ts setup

// Find the module with scoreCommand (use your mod's finder utils, like findByCode if you have one)
const searchModule = /* Your finder here, e.g., findByCode("toLocaleLowerCase", "scoreCommand") or similar */;

if (searchModule) {
  instead(searchModule.scoreCommand, (args, orig) => {
    // Add null check before the lowercase call
    const [command, query] = args; // Assuming args structure based on typical Discord code
    if (query === undefined || query === null) {
      return 0; // Or some safe default score to skip
    }
    // Or target the exact line: wrap the string op
    // e.g., if the buggy line is something like str.toLocaleLowerCase(), replace with str?.toLocaleLowerCase() ?? ""
    return orig(...args);
  });
  logger.log("Patched scoreCommand to handle undefined values!");
} else {
  logger.warn("Couldn't find scoreCommand module to patch.");
}

import packageJson from "../package.json" with { type: "json" };

const releaseTag = process.env.RELEASE_TAG;
const expectedTag = `v${packageJson.version}`;

if (releaseTag !== expectedTag) {
    throw new Error(`release tag ${releaseTag ?? "<missing>"} does not match ${expectedTag}`);
}

import { FrictionFailure } from "../domain/failures.js";

const managedAssetDigests: Readonly<Record<string, readonly string[]>> = {
  "claude-rule": ["3ca9a1ac9010677216867f37c5f8d2297cfb7a1ee2ee378137c9f715ba2b5595"],
  "friction-review/SKILL.md": ["d6f9edeefa5db22a3bfe684bddc922ff1e84cba9acafa14e1f4acbe1e1203910"],
  "friction-review/references/report-format.md": ["5171764e4f1b5843bd2b60e05bfc025a5f892c45601c67ba4157a383b351bd4d"],
  "friction-review/references/review-policy.md": ["6abf3cb11f82321c7b8a9a602da17f1047ff40a705824aac84ab95aa8870fdfd"],
  "friction-fix/SKILL.md": ["955d5764fe67626923ca20909fcc8236971d37955e2f0517049cdc2743dfdb41"],
  "friction-fix/references/fix-policy.md": ["9ec7857e9917d5f5c868606839215b5dccc0f8c23ab32db2eb2aaf1d2d8ace4b"],
  "friction-fix/references/verification-policy.md": ["ff7c6549c639a66ad3c88a3543356b6f27ef922018aa6a9dcf53962d01c4ea89"],
};

export function knownManagedDigests(assetId: string): readonly string[] {
  const digests = managedAssetDigests[assetId];

  if (digests === undefined) {
    throw new FrictionFailure("internal_error");
  }

  return digests;
}

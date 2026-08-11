import { FrictionFailure } from "../domain/failures.js";

const managedAssetDigests: Readonly<Record<string, readonly string[]>> = {
  "claude-rule": [
    "632a3ae057c6f2b2c2e0e99b5449b9330b6620f96aeaed02c4ffd1898564f819",
    "923bb1c3e036a86990b7315a85d900e037a306017e1d43a842207a28001ba121",
    "3ca9a1ac9010677216867f37c5f8d2297cfb7a1ee2ee378137c9f715ba2b5595",
    "da7b11204a2a5c75fe3342e982a00b3d41e2e3305ac9df80c23a0b5f7ba4043c",
  ],
  "friction-review/SKILL.md": ["d6f9edeefa5db22a3bfe684bddc922ff1e84cba9acafa14e1f4acbe1e1203910"],
  "friction-review/references/report-format.md": ["5171764e4f1b5843bd2b60e05bfc025a5f892c45601c67ba4157a383b351bd4d"],
  "friction-review/references/review-policy.md": [
    "6abf3cb11f82321c7b8a9a602da17f1047ff40a705824aac84ab95aa8870fdfd",
    "8ff505cf1a7e1164aad123f501ec4f249a7a97699982525224c9b6ece221722c",
  ],
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

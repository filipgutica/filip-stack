# [6.36.0](https://github.com/filipgutica/filip-stack/compare/v6.35.0...v6.36.0) (2026-11-28)


### Features

* **devchat:** add work commands with pending replies ([#307](https://github.com/filipgutica/filip-stack/issues/307)) ([cbba1e7](https://github.com/filipgutica/filip-stack/commit/cbba1e7a607bf87a8faf634a121a23b04d48f21d))

# [6.35.0](https://github.com/filipgutica/filip-stack/compare/v6.34.0...v6.35.0) (2026-11-27)


### Features

* **devchat:** queue board writes in an outbox and sync them with the board ([#305](https://github.com/filipgutica/filip-stack/issues/305)) ([d996929](https://github.com/filipgutica/filip-stack/commit/d9969295f89440bfafee90da47719e34de173c75))

# [6.34.0](https://github.com/filipgutica/filip-stack/compare/v6.33.0...v6.34.0) (2026-11-27)


### Features

* **devchat:** add the devchat plugin with router, session hook, guard, and local todos ([#304](https://github.com/filipgutica/filip-stack/issues/304)) ([2ae54c9](https://github.com/filipgutica/filip-stack/commit/2ae54c9aa79138e80461a5fbeaed37fd06bed60f))

# [6.33.0](https://github.com/filipgutica/filip-stack/compare/v6.32.0...v6.33.0) (2026-11-26)


### Features

* **site:** add on-page section navigation ([#301](https://github.com/filipgutica/filip-stack/issues/301)) ([9e24a95](https://github.com/filipgutica/filip-stack/commit/9e24a95029a0952031f9058ce4a7880ea4e22e42))

# [6.32.0](https://github.com/filipgutica/filip-stack/compare/v6.31.1...v6.32.0) (2026-11-25)


### Features

* **agent-ready-environments:** show gate owners and timing, and aim audits at earned autonomy ([#298](https://github.com/filipgutica/filip-stack/issues/298)) ([d369718](https://github.com/filipgutica/filip-stack/commit/d3697184a4b23de09a344c91476e9d6787c8b5b2))

## [6.31.1](https://github.com/filipgutica/filip-stack/compare/v6.31.0...v6.31.1) (2026-11-23)


### Bug Fixes

* **host-config:** use thought_level for Neon and fail stalled unattended children ([#295](https://github.com/filipgutica/filip-stack/issues/295)) ([d009869](https://github.com/filipgutica/filip-stack/commit/d00986971778ca669768072d1bb088d1898641b4))

# [6.31.0](https://github.com/filipgutica/filip-stack/compare/v6.30.0...v6.31.0) (2026-11-23)


### Bug Fixes

* **evals:** retry provider 5xx answers with backoff in the eval runner ([#294](https://github.com/filipgutica/filip-stack/issues/294)) ([fd0fea4](https://github.com/filipgutica/filip-stack/commit/fd0fea413803f696ed7de1bc71582b850a6f732b))


### Features

* **skills:** give home-repo a per-task home folder and workspace checkouts ([#293](https://github.com/filipgutica/filip-stack/issues/293)) ([fb3f442](https://github.com/filipgutica/filip-stack/commit/fb3f442f215bf681156acb80b3acc911207392d2))

# [6.30.0](https://github.com/filipgutica/filip-stack/compare/v6.29.0...v6.30.0) (2026-11-23)


### Features

* **workflow:** explain a simple bug fix plainly in PR descriptions ([#291](https://github.com/filipgutica/filip-stack/issues/291)) ([15a85d5](https://github.com/filipgutica/filip-stack/commit/15a85d5fc49eb8f2052f054cd1a4cc34921d3a59))

# [6.29.0](https://github.com/filipgutica/filip-stack/compare/v6.28.0...v6.29.0) (2026-11-23)


### Bug Fixes

* **host-config:** require marked UI screenshots and point evidence rules to their owners ([3249b77](https://github.com/filipgutica/filip-stack/commit/3249b7755ea7c6971c420b3e397ae9c26aca7c02))
* **host-config:** scope text-only evidence to agent-only loops and redact all shared evidence ([0faad8a](https://github.com/filipgutica/filip-stack/commit/0faad8abb8817f0f196385ac6140515861ac305f))


### Features

* **host-config:** require reproducible claims and audience-fit evidence ([c3e8de8](https://github.com/filipgutica/filip-stack/commit/c3e8de8abb501eb017854aa10ffce2c992da42e9))

# [6.28.0](https://github.com/filipgutica/filip-stack/compare/v6.27.0...v6.28.0) (2026-11-23)


### Bug Fixes

* **skills:** verify member skill links after checkout; test the missing-link case ([8a40147](https://github.com/filipgutica/filip-stack/commit/8a40147af8bc673ef143b4d22872ce3b2fd49586))


### Features

* **skills:** make home-repo link member skills for every host ([69303ea](https://github.com/filipgutica/filip-stack/commit/69303ea49c7a20deed85627fca0ba03a233492fd))

# [6.27.0](https://github.com/filipgutica/filip-stack/compare/v6.26.1...v6.27.0) (2026-11-23)


### Bug Fixes

* **sync:** leave hand-installed skills out of unselected ([0673643](https://github.com/filipgutica/filip-stack/commit/06736431358c941ee9a71cf70295b004abc66aa1))
* **sync:** omit unselected when the skill lookup fails ([c6e0105](https://github.com/filipgutica/filip-stack/commit/c6e0105fa03a1dcbbdfb38cca48860cc5418e0c1))
* **sync:** read unselected skills from the committed tree ([faa2eb6](https://github.com/filipgutica/filip-stack/commit/faa2eb6a39cecdac47656e0c6904d42aef32b12a))


### Features

* **sync:** report published skills outside the baseline as unselected ([f6d476d](https://github.com/filipgutica/filip-stack/commit/f6d476d121f791eac4807b0575ed4e3e53a42d21))

## [6.26.1](https://github.com/filipgutica/filip-stack/compare/v6.26.0...v6.26.1) (2026-11-23)


### Bug Fixes

* **hooks:** lint the commit message by absolute path ([ab90baa](https://github.com/filipgutica/filip-stack/commit/ab90baa163d652338461d6b9130c1439d8873a6f))
* **hooks:** lint the message file git passes, by absolute path ([b372bb7](https://github.com/filipgutica/filip-stack/commit/b372bb7fe6d9fa9b65b9de4c59ed57081c2c7657))

# [6.26.0](https://github.com/filipgutica/filip-stack/compare/v6.25.0...v6.26.0) (2026-11-21)


### Features

* promote bug-ticket, PR-description, and merge-offer rules into guidance ([624f2cd](https://github.com/filipgutica/filip-stack/commit/624f2cdf8b00b9765058682ab6e69bdd0178320e))

# [6.25.0](https://github.com/filipgutica/filip-stack/compare/v6.24.0...v6.25.0) (2026-11-20)


### Bug Fixes

* **skills:** keep home-repo audits out of the plan approval step and test the retirement gate ([c6ee40a](https://github.com/filipgutica/filip-stack/commit/c6ee40a8b6ad60805cd4697f26da7f1f35e731c0))
* **skills:** publish before retiring old copies and add a read-only audit route to home-repo ([ff495dc](https://github.com/filipgutica/filip-stack/commit/ff495dcf124aa32a5ca8a6f658cc9f98e8aba311))
* **skills:** route home-repo audits before setup decisions and gate retirement on access ([0240e6f](https://github.com/filipgutica/filip-stack/commit/0240e6fcdae9ae3abc84c1a91024c59b2cf73273))


### Features

* **skills:** add home-repo skill ([8e1d8e8](https://github.com/filipgutica/filip-stack/commit/8e1d8e8265fc740e003b38a7c9c10134f55a829e))

# [6.24.0](https://github.com/filipgutica/filip-stack/compare/v6.23.0...v6.24.0) (2026-11-19)


### Bug Fixes

* **host-config:** let output styles set list markup; sharpen layout scenarios ([8bc3d4e](https://github.com/filipgutica/filip-stack/commit/8bc3d4e152235e422a4eb77f9f59e8ef433cdadc))
* **host-config:** require a visible break between ideas ([6ffcea4](https://github.com/filipgutica/filip-stack/commit/6ffcea4a65a39178190596126e844ae80ebef89b))


### Features

* **host-config:** default to ELI5 replies with one idea per line ([c00921d](https://github.com/filipgutica/filip-stack/commit/c00921d3a0bf626351e00e2fce28913a0129b79c))

# [6.23.0](https://github.com/filipgutica/filip-stack/compare/v6.22.0...v6.23.0) (2026-11-19)


### Features

* **council:** drop the unrubricked 0-10 member score ([adff7e4](https://github.com/filipgutica/filip-stack/commit/adff7e448d54a8ab85fdd622f3e7dd25f03dc809))

# [6.22.0](https://github.com/filipgutica/filip-stack/compare/v6.21.0...v6.22.0) (2026-11-19)


### Bug Fixes

* **council:** count a calling skill's default lineup as named ([5e003e6](https://github.com/filipgutica/filip-stack/commit/5e003e6e4b5ee171a9cda9adea345ef4b7bcd12e))
* **council:** keep arbiter briefs to eligible findings and review-only reports ([cf69a20](https://github.com/filipgutica/filip-stack/commit/cf69a2060bab549f4ee889a02745b4783ea32d6f))
* **council:** scope arbiter rulings and settle gate order ([baac4eb](https://github.com/filipgutica/filip-stack/commit/baac4eb1ba52863b80618e088f66277a28915a9d))
* **todos:** check privacy before every operation and quote issue text ([0108509](https://github.com/filipgutica/filip-stack/commit/0108509e117a4d3846877670312a8650ec36145c))
* **todos:** say when this gh login sees no todos repository ([3b75ff0](https://github.com/filipgutica/filip-stack/commit/3b75ff002334aaf512d658f72df9927cd62dc08e))


### Features

* **council:** default to Sol, Opus, and Neon, with Fable as arbiter ([0309fc1](https://github.com/filipgutica/filip-stack/commit/0309fc1bed5af4784636a6a6c2bb1b52cd444963))
* **todos:** keep todos as issues in a private GitHub repository ([2af6eb1](https://github.com/filipgutica/filip-stack/commit/2af6eb19e2fd6842b58f067bf62e0c3e0fd42a9e))

# [6.21.0](https://github.com/filipgutica/filip-stack/compare/v6.20.0...v6.21.0) (2026-11-19)


### Bug Fixes

* **sol-loop:** keep the ledger local until a PR update is authorized ([07d31cc](https://github.com/filipgutica/filip-stack/commit/07d31cc3472f0500dc3a51a844ce777ba478674e))
* **sol-loop:** publish the ledger when the loop stops ([2342049](https://github.com/filipgutica/filip-stack/commit/2342049468217c7b68954411cbd0b8ec634dd914))


### Features

* **guidance:** note each PR's review in the footer and keep sol-loop rounds in the PR description ([deb765e](https://github.com/filipgutica/filip-stack/commit/deb765e23569e9ed039dff1badfd9727c2bec5b4))

# [6.20.0](https://github.com/filipgutica/filip-stack/compare/v6.19.0...v6.20.0) (2026-11-19)


### Bug Fixes

* **field-guide:** expand only the shared guidance import when dreaming ([ef2d842](https://github.com/filipgutica/filip-stack/commit/ef2d8423cb0dc4702242ed1cc9cfb111e17c4843))
* **field-guide:** read the guidance that CLAUDE.md imports when dreaming ([ea69249](https://github.com/filipgutica/filip-stack/commit/ea692492e4365a515769e7553a89e02d921eb45d))
* **host-config:** keep the guidance template out of a file named AGENTS.md ([94f22c5](https://github.com/filipgutica/filip-stack/commit/94f22c54e5d556e0985dcbb3eda4564c4b5eeddd))


### Features

* **council:** add Gemini 4 Neon to every preset ([8b2f4f9](https://github.com/filipgutica/filip-stack/commit/8b2f4f9a0ff71037f767b8e1974387bfbebe12cb))
* **host-config:** one shared guidance file and a Copy writer role ([c43876e](https://github.com/filipgutica/filip-stack/commit/c43876ee96875513a0428fca94d50530a92a49da))
* **plugins:** install the plugins in Antigravity ([060db93](https://github.com/filipgutica/filip-stack/commit/060db93d807925b0614a86dd8a68fca0fbe38890))

# [6.19.0](https://github.com/filipgutica/filip-stack/compare/v6.18.0...v6.19.0) (2026-11-19)


### Bug Fixes

* **todos:** ask which item a number means when no list was shown ([1f24e76](https://github.com/filipgutica/filip-stack/commit/1f24e76dd068a6e00c1bc9f010d637a461b0d4be))
* **todos:** use one fixed path and cover numeric clears and appends ([8c1e33a](https://github.com/filipgutica/filip-stack/commit/8c1e33aad670b62d68ade450ba25476cdf4a03b6))


### Features

* add the todos skill for items deferred for later ([cd7c9c0](https://github.com/filipgutica/filip-stack/commit/cd7c9c00711d882025a92894f15e261a74e5da16))

# [6.18.0](https://github.com/filipgutica/filip-stack/compare/v6.17.0...v6.18.0) (2026-11-19)


### Bug Fixes

* **field-guide:** close round 1 review findings on dream apply ([b6e66c1](https://github.com/filipgutica/filip-stack/commit/b6e66c11c752421c3743066f5a63909961e2fd2e))
* **field-guide:** close round 2 review findings on dream apply ([4c4b14c](https://github.com/filipgutica/filip-stack/commit/4c4b14cd4a72cb98192b5453110ada3a488624db))
* **field-guide:** keep a lost annotations.json visible to nightly apply ([4adb1f9](https://github.com/filipgutica/filip-stack/commit/4adb1f9125cc2c45cdb8974479a89db88685304d))
* **field-guide:** let a merge copy its targets' repository identity ([bd48332](https://github.com/filipgutica/filip-stack/commit/bd4833222a9a7d7c399b5eaefeb050eed053521f))
* **field-guide:** let no reconcile hide a lost annotations.json ([13f1e5c](https://github.com/filipgutica/filip-stack/commit/13f1e5c5ccd373a9d03ba8b8b286daf7dbfb68fc))
* **field-guide:** never let nightly apply retire guidance the user once confirmed ([4169ef5](https://github.com/filipgutica/filip-stack/commit/4169ef527344e574002b64464dc3690fc5feeb0e))
* **field-guide:** refuse dream apply while a plugin copy cannot read run entries ([6501bc1](https://github.com/filipgutica/filip-stack/commit/6501bc1d14a76a363baa9d034a723d37e52ba16a))
* **field-guide:** refuse lost history and write nothing before every check passes ([1089caf](https://github.com/filipgutica/filip-stack/commit/1089caf33c64ad3d060b6767e1fb8e026d2d39a2))
* **field-guide:** retire nothing at night beside confirmed guidance ([448b3d7](https://github.com/filipgutica/filip-stack/commit/448b3d7e35d5d748ae41677a9c1806bad0980ec3))


### Features

* **field-guide:** apply nightly maintenance with dream apply ([81ccb8b](https://github.com/filipgutica/filip-stack/commit/81ccb8b2ae8f827cf108b395292d465c2f9b42dd))
* **field-guide:** merge main and hold dream apply to its guards ([7aa035a](https://github.com/filipgutica/filip-stack/commit/7aa035ab1464246d3b6c2d94d97f4e6f4d38e1e4)), closes [#263](https://github.com/filipgutica/filip-stack/issues/263)

# [6.17.0](https://github.com/filipgutica/filip-stack/compare/v6.16.0...v6.17.0) (2026-11-18)


### Features

* read the CLIProxyAPI key from ~/.config/secrets and add a secrets exposure check ([#269](https://github.com/filipgutica/filip-stack/issues/269)) ([ef963c4](https://github.com/filipgutica/filip-stack/commit/ef963c4c16050c8ef76af50d54e3dc160e7efa0e))

# [6.16.0](https://github.com/filipgutica/filip-stack/compare/v6.15.0...v6.16.0) (2026-11-18)


### Bug Fixes

* **host-config:** qualify the Critic row and name the browser role in its scenario ([64b66ad](https://github.com/filipgutica/filip-stack/commit/64b66ad39cd546e8888e4b0e3fcb60c3ca569c09))


### Features

* **host-config:** run the Critic on the other provider's workhorse model ([e7bf6c7](https://github.com/filipgutica/filip-stack/commit/e7bf6c78ef17a0618608cbb47eb2f2d27cbb95bd))

# [6.15.0](https://github.com/filipgutica/filip-stack/compare/v6.14.1...v6.15.0) (2026-11-18)


### Bug Fixes

* **field-guide:** close round 10 review findings on guards, recovery, and the plan ([1370fe9](https://github.com/filipgutica/filip-stack/commit/1370fe9bac66c1a927780a0cda4a9b2b29b041b1))
* **field-guide:** close round 9 review findings on consolidation and the nightly plan ([6d5ae05](https://github.com/filipgutica/filip-stack/commit/6d5ae0541f45981c60cb7769a1aa7949d01dd829))


### Features

* **field-guide:** reversible project consolidation and a read-only nightly plan ([ff343af](https://github.com/filipgutica/filip-stack/commit/ff343af6dcca5cdf520049b2e88bace4fa53ffe9))

## [6.14.1](https://github.com/filipgutica/filip-stack/compare/v6.14.0...v6.14.1) (2026-11-18)


### Bug Fixes

* **field-guide:** document and test the quiet near miss on both hosts ([53285d9](https://github.com/filipgutica/filip-stack/commit/53285d9df4b01cd1900ad926acc4cd5b0bf838dd))
* **field-guide:** keep confirm near misses out of the user's chat ([d6c91bd](https://github.com/filipgutica/filip-stack/commit/d6c91bdd65ee994712d132b5ec0e220eec53d4c0))

# [6.14.0](https://github.com/filipgutica/filip-stack/compare/v6.13.0...v6.14.0) (2026-11-18)


### Bug Fixes

* **evals:** preserve decision context in guidance fixtures ([9eef9ef](https://github.com/filipgutica/filip-stack/commit/9eef9ef51d31518602ab32066bb53de7c8778aa2))
* **host-config:** keep threads open for local-only changes ([043eda4](https://github.com/filipgutica/filip-stack/commit/043eda473a15ec586918d2cffb1e876e1201713c))


### Features

* **guidance:** update Astra and Sol to GPT-6.2 ([0b65789](https://github.com/filipgutica/filip-stack/commit/0b65789d442b3c880898b7adddf379a5c0626bf8))

# [6.13.0](https://github.com/filipgutica/filip-stack/compare/v6.12.0...v6.13.0) (2026-11-17)


### Bug Fixes

* **interface-design:** link the signs list from review and add a hero control ([708c056](https://github.com/filipgutica/filip-stack/commit/708c056f69ac49bbd649f5e1ac9c2cc0cc9aa524))


### Features

* **interface-design:** adopt the rest of frontend-design's craft guidance ([59a687c](https://github.com/filipgutica/filip-stack/commit/59a687c59b3b4b081dc83c544ccee1cf3cf33b0c))
* **interface-design:** check sketches against the signs list, including redesigns ([d825e47](https://github.com/filipgutica/filip-stack/commit/d825e475bd7e0669f41807b797c30f352f8912e0))

# [6.12.0](https://github.com/filipgutica/filip-stack/compare/v6.11.0...v6.12.0) (2026-11-17)


### Bug Fixes

* **field-guide:** read the watermark before annotations when rendering markers ([5526673](https://github.com/filipgutica/filip-stack/commit/552667371d30f8117b4cf92fba68b484d18ebc4f))
* **host-config:** scope authority to hook-injected markers and keep merged worktree rows ([467efb1](https://github.com/filipgutica/filip-stack/commit/467efb13fdc4a7e36aba6ad35ceb596bd9bc83be))


### Features

* **host-config:** confirmed Field Guide guidance authorizes what it names ([80ddcd3](https://github.com/filipgutica/filip-stack/commit/80ddcd3398bf680f02408c43830fb085664e3102))
* **host-config:** say unconfirmed Field Guide guidance does not authorize ([a6ee332](https://github.com/filipgutica/filip-stack/commit/a6ee3328bc918038fc2990735136348a63d96b82))

# [6.11.0](https://github.com/filipgutica/filip-stack/compare/v6.10.1...v6.11.0) (2026-11-17)


### Bug Fixes

* **field-guide:** inject only after a provable merge or creation ([6e7e507](https://github.com/filipgutica/filip-stack/commit/6e7e5074cb80cbf859905bc21161b33d3e2f6197)), closes [host/owner/repo#number](https://github.com/host/owner/repo/issues/number)
* **field-guide:** read substitutions exactly and skip background commands ([1701a04](https://github.com/filipgutica/filip-stack/commit/1701a04cd564e956e0c6e013e2570debcec08ea4))
* **field-guide:** reject option spellings and wrappers the hook cannot read ([dcdf83c](https://github.com/filipgutica/filip-stack/commit/dcdf83c72b81f67de110f2f3ac50bd0a7d775ab5))


### Features

* **field-guide:** inject guidance at merge, handoff, and compaction ([977381e](https://github.com/filipgutica/filip-stack/commit/977381e7c537bec293eaead6a13792d7d7e8b2a8))

## [6.10.1](https://github.com/filipgutica/filip-stack/compare/v6.10.0...v6.10.1) (2026-11-17)


### Bug Fixes

* **field-guide:** keep [#258](https://github.com/filipgutica/filip-stack/issues/258) sidecars valid and revoke in-transit confirmations ([fd5c1ca](https://github.com/filipgutica/filip-stack/commit/fd5c1cac5b3aae4128851cc442b38f050d199a1d)), closes [#261](https://github.com/filipgutica/filip-stack/issues/261)
* **field-guide:** revoke deleted records through watermark fingerprints ([704f939](https://github.com/filipgutica/filip-stack/commit/704f93911a265ff47fba7df0e8b1031318e1e137))
* **field-guide:** revoke records an older plugin deleted when import brings them back ([8e2e2b9](https://github.com/filipgutica/filip-stack/commit/8e2e2b99bd6c64234726fb020525d8fbd8300b95)), closes [#261](https://github.com/filipgutica/filip-stack/issues/261)
* **field-guide:** void confirmations after an older plugin writes the store ([e0f2340](https://github.com/filipgutica/filip-stack/commit/e0f234059ab7740e6d34f440dd1e0b85d9730a60))

# [6.10.0](https://github.com/filipgutica/filip-stack/compare/v6.9.0...v6.10.0) (2026-11-17)


### Features

* **interface-design:** count visible words, boxes, and controls in ui-check ([#260](https://github.com/filipgutica/filip-stack/issues/260)) ([9ebc8e6](https://github.com/filipgutica/filip-stack/commit/9ebc8e62109620f3adda6f72bd512ef516fbef3b))

# [6.9.0](https://github.com/filipgutica/filip-stack/compare/v6.8.0...v6.9.0) (2026-11-17)


### Bug Fixes

* **field-guide:** count memory retirement IDs as revocations ([7956e0a](https://github.com/filipgutica/filip-stack/commit/7956e0a0afc29e746fc7d6a2f7f451f87ab49053)), closes [#258](https://github.com/filipgutica/filip-stack/issues/258)
* **field-guide:** make confirmation revocation causal ([118fca0](https://github.com/filipgutica/filip-stack/commit/118fca073d0d6a6e84d2117114397d52334cd73a)), closes [#258](https://github.com/filipgutica/filip-stack/issues/258)
* **field-guide:** make confirmation revocation durable across sync ([c9b6d2d](https://github.com/filipgutica/filip-stack/commit/c9b6d2d8b0779d47c4e3a583d8d9dd184a77c062)), closes [#258](https://github.com/filipgutica/filip-stack/issues/258)


### Features

* **field-guide:** hook-proven confirmation and event triggers ([def60bc](https://github.com/filipgutica/filip-stack/commit/def60bc8533a7a3a157b71ae7e6132f53e8b725d))

# [6.8.0](https://github.com/filipgutica/filip-stack/compare/v6.7.0...v6.8.0) (2026-11-17)


### Features

* **council:** size the council and its rounds to the question ([9057083](https://github.com/filipgutica/filip-stack/commit/90570831e73feb555af8ca9623bf81f1cbf4f13a))

# [6.7.0](https://github.com/filipgutica/filip-stack/compare/v6.6.0...v6.7.0) (2026-11-16)


### Bug Fixes

* **full-send:** close council gate review findings ([f1b8bd2](https://github.com/filipgutica/filip-stack/commit/f1b8bd25d8060e2d77f07be15b1df8449df166fe))
* **full-send:** let a backed declined finding get its fix before the no-progress stop ([80f93c0](https://github.com/filipgutica/filip-stack/commit/80f93c07ada5cae8cfa71365aa339cbb1f0fd114))
* **full-send:** settle council gate stop rules after a pass ([dce8d05](https://github.com/filipgutica/filip-stack/commit/dce8d05a9d697bc1c52177857caf95e73fc0b131))


### Features

* **full-send:** gate full send and full stop on a council score ([43094e7](https://github.com/filipgutica/filip-stack/commit/43094e73249f75dae734357d5438c2c9118ebea2))

# [6.6.0](https://github.com/filipgutica/filip-stack/compare/v6.5.1...v6.6.0) (2026-11-16)


### Features

* **grill-me:** word questions so yes accepts the recommendation ([eda9e11](https://github.com/filipgutica/filip-stack/commit/eda9e115a795e067f1352eedb7e5d4254bacdad4))

## [6.5.1](https://github.com/filipgutica/filip-stack/compare/v6.5.0...v6.5.1) (2026-11-16)


### Bug Fixes

* **site:** update @filipgutica/ui to 2.2.1 ([#247](https://github.com/filipgutica/filip-stack/issues/247)) ([00f810f](https://github.com/filipgutica/filip-stack/commit/00f810f296fc239869ebcefa56b7baa63a23d289))

# [6.5.0](https://github.com/filipgutica/filip-stack/compare/v6.4.1...v6.5.0) (2026-11-15)


### Features

* **guidance:** follow the design-system plugin skill for visual work ([a1c63d8](https://github.com/filipgutica/filip-stack/commit/a1c63d811ae9cc83475d0e6565bf4aad53fb2820))
* **host-config:** stop installing the design system and retire old installs ([93eaed5](https://github.com/filipgutica/filip-stack/commit/93eaed5f8a873d0121b3b65c6153971d48377e5c))

## [6.4.1](https://github.com/filipgutica/filip-stack/compare/v6.4.0...v6.4.1) (2026-11-15)


### Bug Fixes

* **site:** address council findings (F-1, F-2, F-3, F-4, F-6, F-8, F-9) ([5c431ef](https://github.com/filipgutica/filip-stack/commit/5c431efba853377bcf68508cea9dc4525b1cc47b))

# [6.4.0](https://github.com/filipgutica/filip-stack/compare/v6.3.1...v6.4.0) (2026-11-15)


### Features

* **sync:** install and verify the design-system plugin from its own marketplace ([bd94df1](https://github.com/filipgutica/filip-stack/commit/bd94df11137fe8836844ec85f9ea96fffdba606d))

## [6.3.1](https://github.com/filipgutica/filip-stack/compare/v6.3.0...v6.3.1) (2026-11-15)


### Bug Fixes

* correct code panel radius and cover lesson regressions (G-1, G-2) ([d9d4596](https://github.com/filipgutica/filip-stack/commit/d9d4596e349003d1128dd198a3964da2f49926f4))
* document install dependencies and theme source (F-3, F-5) ([3734888](https://github.com/filipgutica/filip-stack/commit/3734888acc64cd2d830471dc568e740db452ec11))
* **site:** repair Figure 2, install commands, and docs errors ([9e9dd37](https://github.com/filipgutica/filip-stack/commit/9e9dd37b162b124d24aa956582d0a2d70afd9d69))

# [6.3.0](https://github.com/filipgutica/filip-stack/compare/v6.2.0...v6.3.0) (2026-11-15)


### Features

* **host-config:** validate input once at the boundary ([#237](https://github.com/filipgutica/filip-stack/issues/237)) ([8e523af](https://github.com/filipgutica/filip-stack/commit/8e523af45cc4dcfb582bef87252c15461c16cbc3)), closes [kong-konnect/kanalytics#1642](https://github.com/kong-konnect/kanalytics/issues/1642)

# [6.2.0](https://github.com/filipgutica/filip-stack/compare/v6.1.1...v6.2.0) (2026-11-15)


### Features

* **host-config:** keep primary checkouts on the default branch ([2e63276](https://github.com/filipgutica/filip-stack/commit/2e632761a644d9ab8becfa8e3ce9301ab5a266c7))

## [6.1.1](https://github.com/filipgutica/filip-stack/compare/v6.1.0...v6.1.1) (2026-11-15)


### Bug Fixes

* **fleet-sync:** merge shared preferences in the v2 format ([13150c2](https://github.com/filipgutica/filip-stack/commit/13150c2ff7ca71da8745336d2f20c98ff95cc247))

# [6.1.0](https://github.com/filipgutica/filip-stack/compare/v6.0.0...v6.1.0) (2026-11-15)


### Features

* **host-config:** add a frontier Planner, model escalation, and council presets ([06a8671](https://github.com/filipgutica/filip-stack/commit/06a8671ba116f7de06b77cb730072e24b11b287f))
* **host-config:** switch model family between main thread, Planner, and plan Critic ([b1c7a64](https://github.com/filipgutica/filip-stack/commit/b1c7a64acb6c0a9d74c9308c53100ea5a4464b3d))

# [6.0.0](https://github.com/filipgutica/filip-stack/compare/v5.14.0...v6.0.0) (2026-11-15)


### Bug Fixes

* **field-guide:** carry an undo to every machine through shared sync ([26c2cca](https://github.com/filipgutica/filip-stack/commit/26c2cca57cbbfd66448ccdb417bdb61823e5e3b4))
* **field-guide:** let an undo acknowledge only its own supersession ([99ddab6](https://github.com/filipgutica/filip-stack/commit/99ddab62c1a56a732088c7899a779d502c4f61db))


### BREAKING CHANGES

* **field-guide:** older Field Guide plugins cannot read stores or dotfiles
written by this version. Refresh the plugin and restart the host on every
machine, then run host-config update.

# [5.14.0](https://github.com/filipgutica/filip-stack/compare/v5.13.2...v5.14.0) (2026-11-15)


### Features

* **host-config:** route routine reviews to the workhorse tier ([2f08cc7](https://github.com/filipgutica/filip-stack/commit/2f08cc7322b363cf82cf2fb7c6f89dd98172dbd7))

## [5.13.2](https://github.com/filipgutica/filip-stack/compare/v5.13.1...v5.13.2) (2026-11-15)


### Bug Fixes

* **field-guide:** require a withdrawn replacement before restoring superseded guidance ([5036c31](https://github.com/filipgutica/filip-stack/commit/5036c314f2c279f1e9da4ac0d34c2a70157a227f))
* **field-guide:** restore superseded guidance when its replacement is undone ([58f3cb4](https://github.com/filipgutica/filip-stack/commit/58f3cb457c3935c318a77a807d3a05879b92c29c))
* **field-guide:** skip learnings that guidance or skills already encode ([c031dd2](https://github.com/filipgutica/filip-stack/commit/c031dd2ef535b31c88f1916c731893371dd86fea))

## [5.13.1](https://github.com/filipgutica/filip-stack/compare/v5.13.0...v5.13.1) (2026-11-14)


### Bug Fixes

* **host-config:** label Decided for you items by who decided ([17bd89f](https://github.com/filipgutica/filip-stack/commit/17bd89f9454aa731c8cff05dbbe3c6b45355776b))

# [5.13.0](https://github.com/filipgutica/filip-stack/compare/v5.12.0...v5.13.0) (2026-11-13)


### Bug Fixes

* **host-config:** keep a backup's permissions ([f34706a](https://github.com/filipgutica/filip-stack/commit/f34706a8e7b9e99c10ea4b5de873b0302933ad90))
* **host-config:** keep design-system files behind symlinks and earlier backups ([c9eb86c](https://github.com/filipgutica/filip-stack/commit/c9eb86c458534acba74ed195f25289b3b1521835))


### Features

* **host-config:** install the design system to ~/design-system ([77c8774](https://github.com/filipgutica/filip-stack/commit/77c87740765ddb4e7f551c89a2f26bb5b42ae2c6))

# [5.12.0](https://github.com/filipgutica/filip-stack/compare/v5.11.2...v5.12.0) (2026-11-13)


### Features

* help users pick threads back up ([380415f](https://github.com/filipgutica/filip-stack/commit/380415fb080ab6ed5eb9ef7d99337cf5a984bea6))
* **host-config:** rename a thread whose title does not describe its purpose ([8cb7be4](https://github.com/filipgutica/filip-stack/commit/8cb7be420cfac3f44e101e6043e0bea5584e9ded))

## [5.11.2](https://github.com/filipgutica/filip-stack/compare/v5.11.1...v5.11.2) (2026-11-12)


### Bug Fixes

* **workflow:** tie each engineering task loop to the change steps ([c40b48b](https://github.com/filipgutica/filip-stack/commit/c40b48b21836f668813e823ffbcb6ab814744247))

## [5.11.1](https://github.com/filipgutica/filip-stack/compare/v5.11.0...v5.11.1) (2026-11-12)


### Bug Fixes

* **site:** ignore hidden folders when listing skill directories ([9d3d0e0](https://github.com/filipgutica/filip-stack/commit/9d3d0e0d1f228c08f5d606bd45fb3c1dc0cf1237))

# [5.11.0](https://github.com/filipgutica/filip-stack/compare/v5.10.0...v5.11.0) (2026-11-12)


### Features

* **planning:** keep the ticket review checklist and route ERD requests ([a687d84](https://github.com/filipgutica/filip-stack/commit/a687d84625bdd821d17062bc7a11350deabf2894))
* **planning:** lighten ticket and spec formats and add PRD and ADR ([65e0870](https://github.com/filipgutica/filip-stack/commit/65e0870cc627ea0e6a33af13121f93a7e6087e57))
* **planning:** request a separate review when a specification changes a public contract ([b880be5](https://github.com/filipgutica/filip-stack/commit/b880be59cdb80fb1e183bb1dd7478db331675b0a))

# [5.10.0](https://github.com/filipgutica/filip-stack/compare/v5.9.0...v5.10.0) (2026-11-12)


### Features

* **workflow:** run planning and engineering work as review loops ([db011ec](https://github.com/filipgutica/filip-stack/commit/db011ec83c7dbdc0be21f3a18814acf110505cc2))

# [5.9.0](https://github.com/filipgutica/filip-stack/compare/v5.8.0...v5.9.0) (2026-11-12)


### Bug Fixes

* **site:** drop the workflow prefix for standalone manual skills on the overview ([d5d0af6](https://github.com/filipgutica/filip-stack/commit/d5d0af649fa50c5191ffab21fb2a7c394e777463))


### Features

* **skills:** move manual Workflow skills to standalone skills ([1562d66](https://github.com/filipgutica/filip-stack/commit/1562d66714cb47c4a115d84f7ec789e838372e4a))

# [5.8.0](https://github.com/filipgutica/filip-stack/compare/v5.7.1...v5.8.0) (2026-11-12)


### Bug Fixes

* **sync:** never overwrite a saved policy backup and qualify the refresh check ([b1a30ca](https://github.com/filipgutica/filip-stack/commit/b1a30ca153c797fa1243919e3342d0d5d5e91c2f))


### Features

* **sync:** save the shared fleet policy on each machine during a refresh ([7ef9e29](https://github.com/filipgutica/filip-stack/commit/7ef9e29534c7b7dba1a65cf79ce4a1415725b09d))

## [5.7.1](https://github.com/filipgutica/filip-stack/compare/v5.7.0...v5.7.1) (2026-11-12)


### Bug Fixes

* **sync:** block a missing skill lock hash and normalize folder-hash paths ([e18f41b](https://github.com/filipgutica/filip-stack/commit/e18f41b972a4339bed77609a40593d08bff27950))
* **sync:** verify skills whose lock records a SHA-256 folder hash ([1b9634d](https://github.com/filipgutica/filip-stack/commit/1b9634d351effaf9531de55b1d6f3f4045710606))

# [5.7.0](https://github.com/filipgutica/filip-stack/compare/v5.6.0...v5.7.0) (2026-11-12)


### Bug Fixes

* **evals:** address review of the standalone skill tests ([8ca476e](https://github.com/filipgutica/filip-stack/commit/8ca476e27894e661f62b95e9632c7b54756709f5))
* **evals:** score rule replies by the longest option key ([34b639e](https://github.com/filipgutica/filip-stack/commit/34b639ee3c4ecec20e0255de267c66234336ab13))


### Features

* **evals:** test standalone skills and check guidance on a new model ([de73df2](https://github.com/filipgutica/filip-stack/commit/de73df2cb256416b9c6d900fae24f59600b2979e))

# [5.6.0](https://github.com/filipgutica/filip-stack/compare/v5.5.0...v5.6.0) (2026-11-12)


### Bug Fixes

* **evals:** render host guidance for the retrieval eval ([19f14e2](https://github.com/filipgutica/filip-stack/commit/19f14e218cdca4ab24c8a40175e35f5f88e9c8de))
* **field-guide:** scope the compaction reread and state that a rephrase narrows ([2104067](https://github.com/filipgutica/filip-stack/commit/2104067a40a297b109392ff4cdcdc5304fc23d5e))


### Features

* **field-guide:** rephrase empty retrievals and reread sources after compaction ([fcb9190](https://github.com/filipgutica/filip-stack/commit/fcb91903ead377f7288670bba70808dd6103fa28))

# [5.5.0](https://github.com/filipgutica/filip-stack/compare/v5.4.0...v5.5.0) (2026-11-12)


### Features

* **hill-climb:** check scores, lock grading files, and hold out guidance tasks ([643b656](https://github.com/filipgutica/filip-stack/commit/643b6560cfb56bd809cb510f3244310ac1f7af52))

# [5.4.0](https://github.com/filipgutica/filip-stack/compare/v5.3.1...v5.4.0) (2026-11-11)


### Bug Fixes

* **workflow:** fit the adopted rules within the Workflow word budget ([441c528](https://github.com/filipgutica/filip-stack/commit/441c5284a95cbbf79ec74613aac20c13958445b8))
* **workflow:** keep the rule against assuming another project's commands ([0f34f03](https://github.com/filipgutica/filip-stack/commit/0f34f0368fec39b7677680d9c315649596418598))


### Features

* **workflow:** adopt upstream delegation and validation guidance ([29630cd](https://github.com/filipgutica/filip-stack/commit/29630cd3d985c85c1dce5677d68ffe057b7bb57d))

## [5.3.1](https://github.com/filipgutica/filip-stack/compare/v5.3.0...v5.3.1) (2026-11-11)


### Bug Fixes

* **council:** name report folders by UTC timestamp so same-day runs do not collide ([b01483f](https://github.com/filipgutica/filip-stack/commit/b01483f8b9995061006870b441e5321375c72d72))
* **council:** write reports to a temporary folder by default ([8f9baef](https://github.com/filipgutica/filip-stack/commit/8f9baef85e35f5f95512fa8d4a6b5035bcbcd216))

# [5.3.0](https://github.com/filipgutica/filip-stack/compare/v5.2.0...v5.3.0) (2026-11-11)


### Bug Fixes

* **evals:** order result tables by model and drop the temporary export ([4116706](https://github.com/filipgutica/filip-stack/commit/411670658ca4c2731bc2f9866a12420e1fb276b2))


### Features

* **evals:** run guidance tests on promptfoo ([705a0ac](https://github.com/filipgutica/filip-stack/commit/705a0ac44c34f33539cdc928a334ca477e3b6f4e))

# [5.2.0](https://github.com/filipgutica/filip-stack/compare/v5.1.0...v5.2.0) (2026-11-11)


### Bug Fixes

* **host-config:** keep council choices out of the advisor tier and record the autonomy eval ([5e3ab62](https://github.com/filipgutica/filip-stack/commit/5e3ab62d56f1792825c6457b689de85bb6ed6c75))


### Features

* **council:** let an independent designer build custom councils and write a report per run ([ee3e883](https://github.com/filipgutica/filip-stack/commit/ee3e8836049f7002733ede8642546d81999622be))
* **host-config:** settle open decisions in tiers before asking the user ([caab1f4](https://github.com/filipgutica/filip-stack/commit/caab1f4afb95ca29602810ab1208c5a2834ef709))

# [5.1.0](https://github.com/filipgutica/filip-stack/compare/v5.0.0...v5.1.0) (2026-11-10)


### Bug Fixes

* **host-config:** harden usage reader and routing rules after review ([8f3c059](https://github.com/filipgutica/filip-stack/commit/8f3c0594bdfd1756e1c65184af3fa90c8624dd93))
* **host-config:** read per-model windows such as Fable from codexbar ([0070c78](https://github.com/filipgutica/filip-stack/commit/0070c78d73f107f5da8441d25bef98f3c243b687))


### Features

* **host-config:** route delegation by model tier and live usage ([2d8f367](https://github.com/filipgutica/filip-stack/commit/2d8f36745d38528823fa431335060d627990b124))

# [5.0.0](https://github.com/filipgutica/filip-stack/compare/v4.7.0...v5.0.0) (2026-11-10)


* feat(skills)!: add Fable 5.2 to council and roles, rebuild merge-council on council ([372ecbd](https://github.com/filipgutica/filip-stack/commit/372ecbdc6628b8fcecf9743a10572440f08d8b6d))


### Bug Fixes

* **skills:** close merge-council gaps found in critic review ([1f54809](https://github.com/filipgutica/filip-stack/commit/1f54809cb7c56ba408e810771597d4907f1f48a7))
* **skills:** keep merge-council run state across fix pushes ([cf45cab](https://github.com/filipgutica/filip-stack/commit/cf45cabbb8c8dbaffeb7d2ac69b49464dc61936b))


### BREAKING CHANGES

* merge-council drops its chair agent, roster file, and setup
argument; it requires the council skill.

# [4.7.0](https://github.com/filipgutica/filip-stack/compare/v4.6.0...v4.7.0) (2026-11-09)


### Bug Fixes

* **host-config:** cache a downloaded design system only after it extracts ([c5a27bf](https://github.com/filipgutica/filip-stack/commit/c5a27bfffafba4501fb7f5076ce070443f6e1eae))
* **site:** keep the old catalogue tokens.css URL working ([24dfba1](https://github.com/filipgutica/filip-stack/commit/24dfba1ec677c25bd811b98af3e097706fd26034))


### Features

* **host-config:** install the design language from the pinned design-system package ([987148b](https://github.com/filipgutica/filip-stack/commit/987148bd6f9375a5770f9d157a1dbb403c4da750))
* **site:** send design-language catalogue links to the design system site ([2fbeb82](https://github.com/filipgutica/filip-stack/commit/2fbeb8255cb9d7dbcc46d4fb40ee38be11cd8d2f))

# [4.6.0](https://github.com/filipgutica/filip-stack/compare/v4.5.8...v4.6.0) (2026-11-09)


### Bug Fixes

* **design-language:** carry invalid and disabled field states to the search field ([08311df](https://github.com/filipgutica/filip-stack/commit/08311dfac7f1788f7dad80d7a537c82c0981c977))


### Features

* **design-language:** give controls an accent focus ring and fields an accent edge ([e1f6bf3](https://github.com/filipgutica/filip-stack/commit/e1f6bf3d299815ac05b2ffe5cae289e20cee600e))

## [4.5.8](https://github.com/filipgutica/filip-stack/compare/v4.5.7...v4.5.8) (2026-11-09)


### Bug Fixes

* **design-language:** emit the standalone picker field recipe after the report styles ([6ba4f87](https://github.com/filipgutica/filip-stack/commit/6ba4f87ef542289fc45e3cc1089c4b493555a8fa))
* **design-language:** fix application example keyboard, anchors, and phone layout ([80d4e71](https://github.com/filipgutica/filip-stack/commit/80d4e7150341b68f9a8cb21d8171094ae57eb8eb))
* **design-language:** give docs section spacing one owner ([6cbcfc0](https://github.com/filipgutica/filip-stack/commit/6cbcfc0c0a9816a4ac7a63cef5a3ac2a9755df08))

## [4.5.7](https://github.com/filipgutica/filip-stack/compare/v4.5.6...v4.5.7) (2026-11-09)


### Bug Fixes

* **design-language:** close the drawer when its exit slide is cancelled ([930aee6](https://github.com/filipgutica/filip-stack/commit/930aee65e3917bcb22336241a095b277780da1c9))
* **design-language:** fix catalogue control sizes, tab fades, drawer exit, and phone overflow ([5138e30](https://github.com/filipgutica/filip-stack/commit/5138e30da146b51fa873cb594e0d2aa78a226229))
* **design-language:** guard copied state rules and rem padding, gaps, and line heights ([890560f](https://github.com/filipgutica/filip-stack/commit/890560f3a0ddda15a76f27815713b52cc0a27585))
* **design-language:** let search inputs fill their field and keep the clear cross in forced colors ([e9d0667](https://github.com/filipgutica/filip-stack/commit/e9d0667e3a7d06b5a62f5bdd13591379e916a5f6))
* **design-language:** remove stray .build cache files ([74354f8](https://github.com/filipgutica/filip-stack/commit/74354f8f4b707aed49504de68f8aca9c36d76d20))
* **design-language:** select list rows with the navigation current recipe and a stronger tint ([4543053](https://github.com/filipgutica/filip-stack/commit/45430534359f10dcd665f850b66925f66c12bb16))
* **design-language:** show the application title role in sans, as the app renders it ([55a2f9f](https://github.com/filipgutica/filip-stack/commit/55a2f9f462e2c854e6ab495f13ff0edfe51aa47f))
* **design-language:** show the catalogue search field with its leading magnifier ([4534633](https://github.com/filipgutica/filip-stack/commit/453463382b62399d7b4247877f56012a8355aac4))
* **design-language:** state that application titles are sans and other page titles mono ([460222e](https://github.com/filipgutica/filip-stack/commit/460222ed251b7d96c9de93b429ecdfd1fd9218d1))
* **design-language:** tint the capture's selected tab at 20%, as every dark selected fill is ([ee672d2](https://github.com/filipgutica/filip-stack/commit/ee672d26a42c5ad31eb9a09b718b0b92359860bd))

## [4.5.6](https://github.com/filipgutica/filip-stack/compare/v4.5.5...v4.5.6) (2026-11-09)


### Bug Fixes

* **design-language:** cap application section headings at --text-xl and align type roles ([7ab43a7](https://github.com/filipgutica/filip-stack/commit/7ab43a7856301c52a3f94ab5f3b33b8675e838e3))
* **design-language:** keep the ## section mark for docs, article, and product sections ([78dd7ee](https://github.com/filipgutica/filip-stack/commit/78dd7ee29404a83bc7ee5825ce191a79e889e3da))

## [4.5.5](https://github.com/filipgutica/filip-stack/compare/v4.5.4...v4.5.5) (2026-11-09)


### Bug Fixes

* **design-language:** let page colours override earlier host body resets ([eb2e9bd](https://github.com/filipgutica/filip-stack/commit/eb2e9bdfafbc8a5139a7cd36b3e2e6818525aebf))

## [4.5.4](https://github.com/filipgutica/filip-stack/compare/v4.5.3...v4.5.4) (2026-11-09)


### Bug Fixes

* **design-language:** ring the full-size capture screen in the plate colour ([9da73f8](https://github.com/filipgutica/filip-stack/commit/9da73f8b7e3ef162ec5c75e3638a4843d0ee697e))

## [4.5.3](https://github.com/filipgutica/filip-stack/compare/v4.5.2...v4.5.3) (2026-11-09)


### Bug Fixes

* **design-language:** centre icon-only quiet actions ([805a1be](https://github.com/filipgutica/filip-stack/commit/805a1be9e8c8ad76aeb13299ef8c133a227583eb))

## [4.5.2](https://github.com/filipgutica/filip-stack/compare/v4.5.1...v4.5.2) (2026-11-07)


### Bug Fixes

* **design-language:** disable quiet actions and check each copied control selector ([8291b1e](https://github.com/filipgutica/filip-stack/commit/8291b1e09ef2c79edd406be87f31c856082f31cb))
* **design-language:** keep quiet-action hover and press at their base specificity ([a4fbb2e](https://github.com/filipgutica/filip-stack/commit/a4fbb2e828f0ec6015cb87076709387ae557a6e2))

## [4.5.1](https://github.com/filipgutica/filip-stack/compare/v4.5.0...v4.5.1) (2026-11-07)


### Bug Fixes

* **site:** use shared Workflow controls ([2032fc6](https://github.com/filipgutica/filip-stack/commit/2032fc666bf3b30078f081a439f799d1e0cb2b7c))

# [4.5.0](https://github.com/filipgutica/filip-stack/compare/v4.4.3...v4.5.0) (2026-11-07)


### Bug Fixes

* **site:** check credit text in its fact ([9c513c3](https://github.com/filipgutica/filip-stack/commit/9c513c3a66a675c465b3d47aa8a5a2e90384ed11))


### Features

* **site:** credit upstream skills on adapted skill pages ([469addf](https://github.com/filipgutica/filip-stack/commit/469addfd41123defcbd64f2bc948c04bdbf7c077))

## [4.4.3](https://github.com/filipgutica/filip-stack/compare/v4.4.2...v4.4.3) (2026-11-07)


### Bug Fixes

* **design-language:** tint selected rows and square the toggle card ([eb87327](https://github.com/filipgutica/filip-stack/commit/eb873276e3ceb3f5fc3227721e27558fbe9c8349))

## [4.4.2](https://github.com/filipgutica/filip-stack/compare/v4.4.1...v4.4.2) (2026-11-07)


### Bug Fixes

* **design-language:** address catalogue review findings ([7f5a07b](https://github.com/filipgutica/filip-stack/commit/7f5a07b3e6cb8a89363cef0bc30a64ac2112bd07))
* **design-language:** address second catalogue review ([5205ec8](https://github.com/filipgutica/filip-stack/commit/5205ec82839eb73c729ac4fb4d462a6d3f3bff0c))
* **design-language:** sync field focus and tab rules with final ui [#47](https://github.com/filipgutica/filip-stack/issues/47) and [#48](https://github.com/filipgutica/filip-stack/issues/48) ([03a74f6](https://github.com/filipgutica/filip-stack/commit/03a74f6524043ce096eabd60bf63275e955b4fe8))
* **design-language:** thin control focus ring, lifting fields, lifted selected tabs ([f0de2f3](https://github.com/filipgutica/filip-stack/commit/f0de2f3eed54173d455dcbdbc141c124be50b472))

## [4.4.1](https://github.com/filipgutica/filip-stack/compare/v4.4.0...v4.4.1) (2026-11-07)


### Bug Fixes

* preserve Claude runtime markers during sync ([ba0fcb9](https://github.com/filipgutica/filip-stack/commit/ba0fcb97dbcb001160647009bbc67b82f8cb6541))

# [4.4.0](https://github.com/filipgutica/filip-stack/compare/v4.3.4...v4.4.0) (2026-11-07)


### Features

* add reusable local and fleet sync ([6bf5f39](https://github.com/filipgutica/filip-stack/commit/6bf5f395cc9db90cc55e7390cb84a005ff1c3288))
* apply shared fleet baseline with machine exceptions ([7265bdd](https://github.com/filipgutica/filip-stack/commit/7265bddb7b0d2fc1c28547b0e7c44ed31c9a17f7))

## [4.3.4](https://github.com/filipgutica/filip-stack/compare/v4.3.3...v4.3.4) (2026-11-07)


### Bug Fixes

* **site:** keep color swatches at inline corners ([904309b](https://github.com/filipgutica/filip-stack/commit/904309b38cef83e9e13735ab39e1c92ef6eae6dc))
* **site:** keep multiline content on panel radii ([3c0e8ab](https://github.com/filipgutica/filip-stack/commit/3c0e8ab6216e1339f86d6f2f48a5448ab3be5d4d))

## [4.3.3](https://github.com/filipgutica/filip-stack/compare/v4.3.2...v4.3.3) (2026-11-07)


### Bug Fixes

* **field-guide:** give the lifecycle reminder a rule for capture, ask, and skip ([823b803](https://github.com/filipgutica/filip-stack/commit/823b803c8807a85fa1b0afaef4f64e8338d14c5f))
* **field-guide:** stop function words from matching first-prompt guidance ([acc158f](https://github.com/filipgutica/filip-stack/commit/acc158f947fae1b3d3925674a6b3eadb729cc40b))

## [4.3.2](https://github.com/filipgutica/filip-stack/compare/v4.3.1...v4.3.2) (2026-11-07)


### Bug Fixes

* **site:** keep wide code on the grill-me page scrolling inside its block ([a58a588](https://github.com/filipgutica/filip-stack/commit/a58a58813776fcdb59c02514e3b6b89f10483ff3))
* **site:** let keyboard readers scroll wide code blocks ([a150365](https://github.com/filipgutica/filip-stack/commit/a1503650daeaca1986d8428b2c760429f26f409f))

## [4.3.1](https://github.com/filipgutica/filip-stack/compare/v4.3.0...v4.3.1) (2026-11-07)


### Bug Fixes

* **design-language:** keep catalogue notes to DESIGN.md and let typing / reach inputs ([8d93bc7](https://github.com/filipgutica/filip-stack/commit/8d93bc7d4e8516cf0d1870b81039a4fcc0cac58d))

# [4.3.0](https://github.com/filipgutica/filip-stack/compare/v4.2.0...v4.3.0) (2026-11-07)


### Features

* **cli:** add Homebrew launcher and independent release pipeline ([9ebb163](https://github.com/filipgutica/filip-stack/commit/9ebb163f24861f8d1b5ef34a528ed588e3bb33dc))

# [4.2.0](https://github.com/filipgutica/filip-stack/compare/v4.1.1...v4.2.0) (2026-11-06)


### Features

* **site:** adopt the ui 1.13 terminal folio theme ([235d60c](https://github.com/filipgutica/filip-stack/commit/235d60cf70941eabc268005bd792e1cb0255e527))

## [4.1.1](https://github.com/filipgutica/filip-stack/compare/v4.1.0...v4.1.1) (2026-11-06)


### Bug Fixes

* **evaluation:** accept any visible list markup in the UX probe key-list check ([ff02633](https://github.com/filipgutica/filip-stack/commit/ff02633cd340c7f6c5e9296bcf1fea24e05523ba))
* **evaluation:** find the key list from seeded keys in the UX probe ([22267b9](https://github.com/filipgutica/filip-stack/commit/22267b936a74138a94b64e52a03c9146d1567b6b))
* **evaluation:** harden UX probe scoring and gates ([f61efd6](https://github.com/filipgutica/filip-stack/commit/f61efd67a1de558782f2a2b104764bd5602842be))
* **evaluation:** require a list entry in the UX probe key-list check ([5a4551d](https://github.com/filipgutica/filip-stack/commit/5a4551d502901c3de4f46491de2670e98c6d4797))
* **evaluation:** use the full secret in the UX probe key-list check ([21d7979](https://github.com/filipgutica/filip-stack/commit/21d7979dda0290b04fc85de4e4f82b0ab0ed7d70))

# [4.1.0](https://github.com/filipgutica/filip-stack/compare/v4.0.0...v4.1.0) (2026-11-06)


### Bug Fixes

* **interface-design:** close false passes in the browser checks ([09151b2](https://github.com/filipgutica/filip-stack/commit/09151b20e8ac476632f81fbab2b0090e768bb740))
* **interface-design:** confirm each mode holds before it counts ([986b7a1](https://github.com/filipgutica/filip-stack/commit/986b7a11b663a484d1d7823947c785ff208a89dd))
* **interface-design:** keep modes over page load handlers ([0fc2edb](https://github.com/filipgutica/filip-stack/commit/0fc2edb337945d1438f9f9b76c53b394cc5d0865))


### Features

* **interface-design:** add browser checks for accessibility and modes ([5515a19](https://github.com/filipgutica/filip-stack/commit/5515a197983e6411c55835b92e05814cea4cf145))

# [4.0.0](https://github.com/filipgutica/filip-stack/compare/v3.25.0...v4.0.0) (2026-11-06)


* feat(skills)!: replace ux-laws with interface-design ([d0fdc5d](https://github.com/filipgutica/filip-stack/commit/d0fdc5dde86c768dbdf1c8751ac616e0d86a7ad5))


### Bug Fixes

* **interface-design:** defer target-size exceptions to WCAG 2.5.8 ([9b082e1](https://github.com/filipgutica/filip-stack/commit/9b082e1c8b7f04658bb4028831e7e60f55e3fca9))
* **interface-design:** match WCAG and source limits in review questions ([034aa14](https://github.com/filipgutica/filip-stack/commit/034aa14081047360cea943fd251f163956653ce0))


### BREAKING CHANGES

* the ux-laws skill is removed. Install interface-design
instead: npx skills add filipgutica/filip-stack -g -a claude-code codex -s interface-design -y

# [3.25.0](https://github.com/filipgutica/filip-stack/compare/v3.24.0...v3.25.0) (2026-11-06)


### Bug Fixes

* **hill-climb:** address review of open-ended climbs ([d334e4e](https://github.com/filipgutica/filip-stack/commit/d334e4e1115429ad02375720a5ed57a6ac6f7fba))
* **hill-climb:** isolate and fully specify guidance climbs ([28fd7aa](https://github.com/filipgutica/filip-stack/commit/28fd7aadd992fd2f9827fa463ea8f51921291320))
* **hill-climb:** keep pruning guidance in the score's direction ([0c9606e](https://github.com/filipgutica/filip-stack/commit/0c9606e4a03de33af27127ac6186abab829fe080))
* **hill-climb:** keep scorecard-only final checks in the record ([28f574d](https://github.com/filipgutica/filip-stack/commit/28f574d552fc28490b016793897a01bd97a39189))
* **hill-climb:** record the no-guidance comparison in its own field ([3e0b1b1](https://github.com/filipgutica/filip-stack/commit/3e0b1b1ed65e43925c14b605664d063e660aa51c))
* **hill-climb:** require both final checks for a both-rule verdict ([a59803d](https://github.com/filipgutica/filip-stack/commit/a59803d7140ef6e780de29ca6705786a52044fa3))
* **hill-climb:** score every UI and guidance climb and render malformed scorecards ([dba122c](https://github.com/filipgutica/filip-stack/commit/dba122c4c321daf021cbf36e9cec1969d811013b))
* **hill-climb:** show the no-guidance comparison on the runs page ([6137902](https://github.com/filipgutica/filip-stack/commit/6137902e3684906dad40f0469dc110f02ba664ce))
* **site:** let keyboard readers scroll wide tables ([587aa36](https://github.com/filipgutica/filip-stack/commit/587aa36cb77b4a7e26ced7629328d3ab94a74e91))
* **site:** style Markdown tables on skill pages ([6874751](https://github.com/filipgutica/filip-stack/commit/68747511fd13ea1f091693ad031af1d81a6b7c06))


### Features

* **hill-climb:** climb guidance by the work agents produce under it ([985c847](https://github.com/filipgutica/filip-stack/commit/985c847540b8a28659b337630072dd359225e12f))
* **hill-climb:** climb open-ended goals with intake, score rule, and limits ([d9bf33b](https://github.com/filipgutica/filip-stack/commit/d9bf33b83ff86703c930db0245cf57a71f3f975a))
* **hill-climb:** prune guidance that does not change the work ([d99b836](https://github.com/filipgutica/filip-stack/commit/d99b836701fe49a2e387706d54014ae71c1c2f9b))
* **hill-climb:** score each screen or task in the final check ([7993d84](https://github.com/filipgutica/filip-stack/commit/7993d840543d8c238175d2f899bc0cb5ed4fb3c2))

# [3.24.0](https://github.com/filipgutica/filip-stack/compare/v3.23.0...v3.24.0) (2026-11-06)


### Bug Fixes

* **hill-climb:** address review of the claim-repair rule and test ([ac8e52b](https://github.com/filipgutica/filip-stack/commit/ac8e52b2fe1f040067df4618c12a2538a5575535))
* **hill-climb:** keep gate-failed rounds and baselines from wasting calls ([06c7294](https://github.com/filipgutica/filip-stack/commit/06c7294ef1ad6d012b14883144e7d4e0a57b59c6))


### Features

* **hill-climb:** let the caller set the climb's size limit ([896fff7](https://github.com/filipgutica/filip-stack/commit/896fff71d5e6437efe29375fec21a37109111dc8))

# [3.23.0](https://github.com/filipgutica/filip-stack/compare/v3.22.0...v3.23.0) (2026-11-05)


### Bug Fixes

* **design-language:** drop reference gutters at the phone breakpoint ([85b71b4](https://github.com/filipgutica/filip-stack/commit/85b71b45187b27098a03c047857ff9e51c7f29af))
* **design-language:** keep tablet content padding-block in the reference ([aaae930](https://github.com/filipgutica/filip-stack/commit/aaae93074c701a0f73917ed761f47a5c5c964c64))


### Features

* **design-language:** add forms, data views and breakpoint guidance ([c68ccd0](https://github.com/filipgutica/filip-stack/commit/c68ccd055af55d7557b57b0b8145a1708ae209af))
* **design-language:** narrow to the two named breakpoints ([9b950a8](https://github.com/filipgutica/filip-stack/commit/9b950a8a027efed89946d77b4a593f17a64f806d))

# [3.22.0](https://github.com/filipgutica/filip-stack/compare/v3.21.0...v3.22.0) (2026-11-05)


### Bug Fixes

* **host-config:** make count reports domain-neutral and parse embedded data ([7f8718e](https://github.com/filipgutica/filip-stack/commit/7f8718e818066d3fb07c28ccc392117c219b726b))


### Features

* **host-config:** add portable data visualization reports ([d4f593e](https://github.com/filipgutica/filip-stack/commit/d4f593e509089d8634940d8de31f53eb5264c1f3))

# [3.21.0](https://github.com/filipgutica/filip-stack/compare/v3.20.1...v3.21.0) (2026-11-05)


### Bug Fixes

* **hill-climb:** name the text files in the bundle and judge brief ([9a1a8b2](https://github.com/filipgutica/filip-stack/commit/9a1a8b24a12033147f0d5579a8d1cdb49a0d04f9))


### Features

* **hill-climb:** make the runs page readable and check claims before judging ([3c4173f](https://github.com/filipgutica/filip-stack/commit/3c4173fba266edb5476e2adb0aafe646595cfc61))

## [3.20.1](https://github.com/filipgutica/filip-stack/compare/v3.20.0...v3.20.1) (2026-11-05)


### Bug Fixes

* **site:** derive standalone skill count from catalog ([a1988eb](https://github.com/filipgutica/filip-stack/commit/a1988ebba6a974baee762034a08180f803bc7b65))

# [3.20.0](https://github.com/filipgutica/filip-stack/compare/v3.19.0...v3.20.0) (2026-11-05)


### Features

* **design-language:** lighten the Graphite Indigo light background ([310d314](https://github.com/filipgutica/filip-stack/commit/310d3148d4c5ac2dd6ad336cab83c6688e4e6d5e)), closes [#f4f5f8](https://github.com/filipgutica/filip-stack/issues/f4f5f8) [#f8f9fb](https://github.com/filipgutica/filip-stack/issues/f8f9fb)

# [3.19.0](https://github.com/filipgutica/filip-stack/compare/v3.18.0...v3.19.0) (2026-11-04)


### Bug Fixes

* **host-config:** hold the docs section marker only until the reader scrolls ([6e68f61](https://github.com/filipgutica/filip-stack/commit/6e68f6114107f17680a178fa26bb543fc5dcb466))
* **host-config:** make the design-language example pages follow DESIGN.md ([1af0a94](https://github.com/filipgutica/filip-stack/commit/1af0a948ee765a220f3dc3152365588f17049274))


### Features

* **hill-climb:** judge the whole climb and simplify the runs page ([82e8c42](https://github.com/filipgutica/filip-stack/commit/82e8c42a55947e61130f1afd688745081cb45e76))
* **host-config:** recopy design-language tokens from @filipgutica/ui 1.9.0 ([16cdfb4](https://github.com/filipgutica/filip-stack/commit/16cdfb4df72b7187dc5e5db468f7d1253babecdf))
* **host-config:** state token names, focus, and surface roles in the design language ([7976c1f](https://github.com/filipgutica/filip-stack/commit/7976c1f67b65ac3dd8eb52bac02f4c42e5e9d73f))

# [3.18.0](https://github.com/filipgutica/filip-stack/compare/v3.17.1...v3.18.0) (2026-11-04)


### Bug Fixes

* **hill-climb:** apply lessons from the first five climbs ([0c23b80](https://github.com/filipgutica/filip-stack/commit/0c23b80ec0704e379c1668715394e48468774fe7))


### Features

* **hill-climb:** save run records and tighten restore and size checks ([0470c66](https://github.com/filipgutica/filip-stack/commit/0470c669ba257eaffaf5eab6a25d12ead37694a6))
* **skills:** add hill-climb skill ([003bab2](https://github.com/filipgutica/filip-stack/commit/003bab26426c88ab8f94334ac1c50d1bd161fbcf))

## [3.17.1](https://github.com/filipgutica/filip-stack/compare/v3.17.0...v3.17.1) (2026-11-04)


### Bug Fixes

* **host-config:** use the standard service tier for Codex delegates ([f79669f](https://github.com/filipgutica/filip-stack/commit/f79669f0f89d97fb675c4ab6361f4fcf52eefc8b))

# [3.17.0](https://github.com/filipgutica/filip-stack/compare/v3.16.2...v3.17.0) (2026-11-04)


### Bug Fixes

* **site:** fail the build when a lesson reference is renamed ([ce0ba73](https://github.com/filipgutica/filip-stack/commit/ce0ba73bfe1fd3000c592b8796023eec6822999a))
* **site:** match the lesson's score levels to the skill ([7c7faec](https://github.com/filipgutica/filip-stack/commit/7c7faec90b7418aac6627096ee334cc33f24308a))
* **site:** sync the lesson with the skill's audit and authorization rules ([100693c](https://github.com/filipgutica/filip-stack/commit/100693cc730c4b311bdfa2bba70479a8ff31148e))


### Features

* **site:** move lesson figures and toggles to @filipgutica/ui ([f1157ad](https://github.com/filipgutica/filip-stack/commit/f1157ad7132f9f5f17de29b494ff52495a001cf4))
* **site:** number the fix order's steps in Figure 5 ([4eb44a4](https://github.com/filipgutica/filip-stack/commit/4eb44a46f86b69e69efaae8a18490b55467d87b7))
* **site:** replace lesson citation keys with inline links ([65ccdf9](https://github.com/filipgutica/filip-stack/commit/65ccdf92e863fb24577f2f83cd556731368d461a))
* **site:** rewrite agent-ready environments as a lesson for people ([5c6ccbb](https://github.com/filipgutica/filip-stack/commit/5c6ccbb178a8bb41148d46dcd16c55d1a256bc38))
* **site:** tag pillars in Figure 3 instead of numbering them ([70f78ca](https://github.com/filipgutica/filip-stack/commit/70f78ca6434e6adbe9787116cf031aaeb9b5743d))

## [3.16.2](https://github.com/filipgutica/filip-stack/compare/v3.16.1...v3.16.2) (2026-11-04)


### Bug Fixes

* **skills:** accept reported active configuration as pillar 7 enforcement evidence ([6b4a9e1](https://github.com/filipgutica/filip-stack/commit/6b4a9e10fa7a741ac9fa36c6d4d3ea20437aa815))
* **skills:** align score levels 1 and 2 with the evidence rules ([77c62c2](https://github.com/filipgutica/filip-stack/commit/77c62c21a9e5470f1a64f2bb4d26e6cdd164b12b))
* **skills:** clarify agent readiness scoring and authorization ([4a8d5ca](https://github.com/filipgutica/filip-stack/commit/4a8d5ca2d79086514b8c989c40563f7f989eb28c))
* **skills:** match the pillar table to the scoped sign-off wording ([3daa8d5](https://github.com/filipgutica/filip-stack/commit/3daa8d5bf94a5fa7145f56d83e27da8642db85b7))
* **skills:** score pillar 8 results before the policy fallback ([c06d5d4](https://github.com/filipgutica/filip-stack/commit/c06d5d40a867ea269883431b7b61e1613243b9f8))

## [3.16.1](https://github.com/filipgutica/filip-stack/compare/v3.16.0...v3.16.1) (2026-11-04)


### Bug Fixes

* **host-config:** run Codex subagents on the standard service tier ([2b1ffc7](https://github.com/filipgutica/filip-stack/commit/2b1ffc752c22f0bb680d22da05963622905adf0b))

# [3.16.0](https://github.com/filipgutica/filip-stack/compare/v3.15.1...v3.16.0) (2026-11-04)


### Features

* **skills:** add a general-purpose council ([c0a42b8](https://github.com/filipgutica/filip-stack/commit/c0a42b89db3eb59a6149e79e729beb7840e775e1))

## [3.15.1](https://github.com/filipgutica/filip-stack/compare/v3.15.0...v3.15.1) (2026-11-03)


### Bug Fixes

* **guardrails:** stop asking before pull request merges ([6575675](https://github.com/filipgutica/filip-stack/commit/6575675d2f4a26c4bfc2a463624dc741b1068b48))

# [3.15.0](https://github.com/filipgutica/filip-stack/compare/v3.14.0...v3.15.0) (2026-11-02)


### Bug Fixes

* **guardrails:** read heredoc delimiters whole and tighten message sources ([bd63953](https://github.com/filipgutica/filip-stack/commit/bd63953a9f8291898a4fc6131fa67b7be2af6494))
* **guardrails:** scope attribution checks and close the Codex approval gap ([cdec91b](https://github.com/filipgutica/filip-stack/commit/cdec91bd7561863b65063cd88ed7173c490c8360))


### Features

* **guardrails:** add plugin that enforces attribution, merge, and 1Password rules ([38bc9cd](https://github.com/filipgutica/filip-stack/commit/38bc9cd98352de5136ca6d056f81ac3a0460c56c))

# [3.14.0](https://github.com/filipgutica/filip-stack/compare/v3.13.0...v3.14.0) (2026-11-02)


### Bug Fixes

* **ci:** match duplication baseline on stable fingerprints ([5e90429](https://github.com/filipgutica/filip-stack/commit/5e90429ba40eabe0d32866ce40ea7e54a79e547b))


### Features

* **site:** add agent-ready environments guide ([a6fa170](https://github.com/filipgutica/filip-stack/commit/a6fa17021036289f17b49b831ca5925b65220704))

# [3.13.0](https://github.com/filipgutica/filip-stack/compare/v3.12.1...v3.13.0) (2026-11-02)


### Features

* **skills:** add agent-ready-environments skill ([60d79e2](https://github.com/filipgutica/filip-stack/commit/60d79e2ef8e94126ab5b0845496976ceacaa0a73))

## [3.12.1](https://github.com/filipgutica/filip-stack/compare/v3.12.0...v3.12.1) (2026-10-30)


### Bug Fixes

* **workflow:** keep risk reviews of an exact diff in Review ([22a7d4b](https://github.com/filipgutica/filip-stack/commit/22a7d4b83fc5ee8267d8db7b6544899c92c8745a))
* **workflow:** narrow review skill activation ([94ca344](https://github.com/filipgutica/filip-stack/commit/94ca34448e89e134b69ee26e5669860556fe356a))
* **workflow:** route review feedback and quick plan questions correctly ([d2c1a22](https://github.com/filipgutica/filip-stack/commit/d2c1a22bba58e479c32ce609f51abdbac6cdd1cc))

# [3.12.0](https://github.com/filipgutica/filip-stack/compare/v3.11.0...v3.12.0) (2026-10-28)


### Features

* **skills:** add full-stop adapted from tstack ([93357c1](https://github.com/filipgutica/filip-stack/commit/93357c115c5e8c23bac09ebfaeec423efe48ae8f))

# [3.11.0](https://github.com/filipgutica/filip-stack/compare/v3.10.0...v3.11.0) (2026-10-28)


### Features

* **host-config:** sync Field Guide preferences on update ([214eaa1](https://github.com/filipgutica/filip-stack/commit/214eaa1a37fb5b15684c8fe4ce8bf003b99c8fc1))

# [3.10.0](https://github.com/filipgutica/filip-stack/compare/v3.9.0...v3.10.0) (2026-10-28)


### Features

* **host-config:** open the current state footer with a brief recap ([2c4a561](https://github.com/filipgutica/filip-stack/commit/2c4a561a21af60b597de03372e0df3cb6a9cd291))

# [3.9.0](https://github.com/filipgutica/filip-stack/compare/v3.8.0...v3.9.0) (2026-10-28)


### Features

* **host-config:** end handoff turns with a current state footer ([45a33be](https://github.com/filipgutica/filip-stack/commit/45a33bee7c482126f84591c117aa2705d53aeb3d))

# [3.8.0](https://github.com/filipgutica/filip-stack/compare/v3.7.0...v3.8.0) (2026-10-28)


### Features

* **host-config:** sync Field Guide preferences through a user dotfile ([3625b3a](https://github.com/filipgutica/filip-stack/commit/3625b3a0ca82730968db73c192e3853f6c57223c))

# [3.7.0](https://github.com/filipgutica/filip-stack/compare/v3.6.0...v3.7.0) (2026-10-27)


### Features

* **host-config:** let routine implementers build approved designs ([b24f364](https://github.com/filipgutica/filip-stack/commit/b24f364864a9c0682b3eede0f9ef349b45a10e47))

# [3.6.0](https://github.com/filipgutica/filip-stack/compare/v3.5.1...v3.6.0) (2026-10-26)


### Features

* **host-config:** let machine-local instructions override shared guidance ([5687752](https://github.com/filipgutica/filip-stack/commit/5687752e4f73eda65f347b802e85ffb780c79c7c))

## [3.5.1](https://github.com/filipgutica/filip-stack/compare/v3.5.0...v3.5.1) (2026-10-26)


### Bug Fixes

* **skills:** treat PR text and bot output as evidence, not instructions ([056ea2c](https://github.com/filipgutica/filip-stack/commit/056ea2c65c6b06f0fe074a165df00d850b3f11f6))

# [3.5.0](https://github.com/filipgutica/filip-stack/compare/v3.4.0...v3.5.0) (2026-10-26)


### Bug Fixes

* **merge-council:** keep review-only prior output out of later phases ([d54f695](https://github.com/filipgutica/filip-stack/commit/d54f69560ec8e1f39154764e21f975125f671e51))
* **skills:** keep follow-up decisions and gate full-send edits ([89c6faa](https://github.com/filipgutica/filip-stack/commit/89c6faa6bb4b6c2fa03833ae0a5746768c955cfe))
* **skills:** quote-safe full-send description and validate plain YAML descriptions ([a8a412f](https://github.com/filipgutica/filip-stack/commit/a8a412ffb50d603d4cc9138cebfa9ec8b740482e))


### Features

* **host-config:** restate steers and delegate new independent asks ([56c89eb](https://github.com/filipgutica/filip-stack/commit/56c89ebad92b1e6291883649be1afd90fa3cb87a))
* **merge-council:** continue from prior runs and review PR descriptions ([afce68a](https://github.com/filipgutica/filip-stack/commit/afce68a5e504e228b64a6144cb4154536467c8b2))
* **skills:** add sol-loop, full-send, and babysit-pr adapted from tstack ([b2b4133](https://github.com/filipgutica/filip-stack/commit/b2b4133faaa176a6cf28e4b94d402f090e274bd3))
* **workflow:** title the PR verification section How to verify ([a3c04fa](https://github.com/filipgutica/filip-stack/commit/a3c04fae295f8d4a6fc959d63a62a68c399dd0fd))

# [3.4.0](https://github.com/filipgutica/filip-stack/compare/v3.3.1...v3.4.0) (2026-10-26)


### Bug Fixes

* **field-guide:** keep hook session state in the user's guide ([1716cf1](https://github.com/filipgutica/filip-stack/commit/1716cf11e273f09b7adcb7feb1ecb0353860f4d3))
* **field-guide:** keep parent session state when a subagent starts ([721df02](https://github.com/filipgutica/filip-stack/commit/721df024b025815c1a9d7f7a9e5a3f58c76eb743))
* **field-guide:** refuse a symlinked sessions directory and prune only state files ([ea88453](https://github.com/filipgutica/filip-stack/commit/ea884538445689b36541eea1a35d32265f4bd3d9))
* **field-guide:** restore retrieval safeguards (S-1, S-2) ([17e7406](https://github.com/filipgutica/filip-stack/commit/17e7406fc4014f3521d5bfc19bd2366fb5839654))
* persist lifecycle state after retrieval failures (S-1, S-2) ([c19eaaa](https://github.com/filipgutica/filip-stack/commit/c19eaaaf1f65fc891ee20127b80113e0767cdc11))


### Features

* **field-guide:** inject relevant guidance at session start and first prompt ([949627a](https://github.com/filipgutica/filip-stack/commit/949627a5104a951f11c2ab4df3d1913f2733851f))

## [3.3.1](https://github.com/filipgutica/filip-stack/compare/v3.3.0...v3.3.1) (2026-10-26)


### Bug Fixes

* **host-config:** run update only on main ([889b6bc](https://github.com/filipgutica/filip-stack/commit/889b6bc0bcd289b02e01666f2cc26825eba2d42e))

# [3.3.0](https://github.com/filipgutica/filip-stack/compare/v3.2.0...v3.3.0) (2026-10-26)


### Bug Fixes

* **field-guide:** skip import of records the same export retires ([a60c25b](https://github.com/filipgutica/filip-stack/commit/a60c25b799883344bf88780bc47d64bab8c29928))
* **host-config:** match whole delimiter lines and record each write ([16c185c](https://github.com/filipgutica/filip-stack/commit/16c185cafe0da0d74b2cb3a89bc935da68e11c70))


### Features

* **field-guide:** add shared guidance export and import ([e1e4282](https://github.com/filipgutica/filip-stack/commit/e1e428266455d807f79c6c1503cca3cf566c9eaf))
* **host-config:** add shared Field Guide preferences ([ec47126](https://github.com/filipgutica/filip-stack/commit/ec47126fe3432c4f9025f49e894c40383710584b))
* **host-config:** add update command and manage ~/design-language ([5ca0ea1](https://github.com/filipgutica/filip-stack/commit/5ca0ea1811838cca2a44e7df810fe8da342c9490))
* **host-config:** apply global agent guidance from filip-stack ([7fc48c6](https://github.com/filipgutica/filip-stack/commit/7fc48c6378343128f159c42b16c1518b9c1b4ffe))

# [3.2.0](https://github.com/filipgutica/filip-stack/compare/v3.1.0...v3.2.0) (2026-10-24)


### Features

* **skills:** add performance to merge council review ([7765c45](https://github.com/filipgutica/filip-stack/commit/7765c45f4ef503816ccc9e38e8796a843a34bc5e))

# [3.1.0](https://github.com/filipgutica/filip-stack/compare/v3.0.0...v3.1.0) (2026-10-23)


### Bug Fixes

* **skills:** harden merge council after first live run ([d4d5760](https://github.com/filipgutica/filip-stack/commit/d4d576015350ba0827a17e0ed5311b4f893757c9))


### Features

* **skills:** add merge-council review skill ([a3cf4a5](https://github.com/filipgutica/filip-stack/commit/a3cf4a532bf7e1306320a0aca86d3ce0a92dc809))
* **skills:** run merge council through an independent chair agent ([c8ead78](https://github.com/filipgutica/filip-stack/commit/c8ead786889acb6528d36b12d443d7df0f133c03))

# [3.0.0](https://github.com/filipgutica/filip-stack/compare/v2.11.0...v3.0.0) (2026-10-22)


* feat(skills)!: publish portable Vue and PR review guidance ([adf4abf](https://github.com/filipgutica/filip-stack/commit/adf4abf7369e5b8e4d11648150b20049b08e509d))


### BREAKING CHANGES

* The codex-troubleshooting and shared-policy-editor
standalone skills are no longer distributed.

# [2.11.0](https://github.com/filipgutica/filip-stack/compare/v2.10.0...v2.11.0) (2026-10-22)


### Features

* **skills:** distribute standalone skills with the skills CLI ([988814c](https://github.com/filipgutica/filip-stack/commit/988814c3e2a008f3cc017ade2981c8049839d654))

# [2.10.0](https://github.com/filipgutica/filip-stack/compare/v2.9.0...v2.10.0) (2026-10-21)


### Features

* **workflow:** consolidate guidance after the instruction audit ([0c93e0f](https://github.com/filipgutica/filip-stack/commit/0c93e0f6e7a4dbc5ac42bd8f54144348c863e817))
* **workflow:** own default document formats in Planning and Technical-writing ([b9655f5](https://github.com/filipgutica/filip-stack/commit/b9655f5f73e3ff2c877945b71a2c2a119c8689a5))

# [2.9.0](https://github.com/filipgutica/filip-stack/compare/v2.8.0...v2.9.0) (2026-10-19)


### Features

* **workflow:** name coverage evidence in the test-audit handoff ([05ccee2](https://github.com/filipgutica/filip-stack/commit/05ccee200180134c0080b873fe352f5aebad031e))
* **workflow:** re-gate added tests against final test-audit range ([72942da](https://github.com/filipgutica/filip-stack/commit/72942daae48e65ff6388feb7efbdb060dc523cee))

# [2.8.0](https://github.com/filipgutica/filip-stack/compare/v2.7.0...v2.8.0) (2026-10-19)


### Bug Fixes

* ignore hidden skill directories in validators ([ec67aea](https://github.com/filipgutica/filip-stack/commit/ec67aea93846ff3844175c69561bd7c50acc4354))
* restore risk-scaled review gate and add Planning critic pass ([8932f1d](https://github.com/filipgutica/filip-stack/commit/8932f1db6394981ea51b42ec72127d95a351c297)), closes [hi#risk](https://github.com/hi/issues/risk)


### Features

* add a manual Simplify workflow skill ([a13e250](https://github.com/filipgutica/filip-stack/commit/a13e2507771f7acd3e9a34140b68a72e99827154))
* tighten Engineering and adversarial review guidance ([39dde91](https://github.com/filipgutica/filip-stack/commit/39dde914a12670f11aedc50358a07845996bcf92))

# [2.7.0](https://github.com/filipgutica/filip-stack/compare/v2.6.0...v2.7.0) (2026-10-06)


### Features

* **workflow:** scale test audits and review to risk ([4b25dc0](https://github.com/filipgutica/filip-stack/commit/4b25dc05a136dac11d729a22cb928b1541eeee2c))

# [2.6.0](https://github.com/filipgutica/filip-stack/compare/v2.5.0...v2.6.0) (2026-10-02)


### Features

* **workflow:** add first-reader review for written deliverables ([aedefeb](https://github.com/filipgutica/filip-stack/commit/aedefebdb9fb0bc03001e3b5613628290464ee2c))

# [2.5.0](https://github.com/filipgutica/filip-stack/compare/v2.4.0...v2.5.0) (2026-09-30)


### Features

* **workflow:** simplify writing artifacts and add manual checkpoints ([495c0d9](https://github.com/filipgutica/filip-stack/commit/495c0d90f48148b06547f40d9dace4c75343ab79))

# [2.4.0](https://github.com/filipgutica/filip-stack/compare/v2.3.0...v2.4.0) (2026-09-27)


### Features

* **workflow:** add test audit authoring and PR gates ([2272b7d](https://github.com/filipgutica/filip-stack/commit/2272b7d892716039d5bc5681da1f07d3c100c7c9))

# [2.3.0](https://github.com/filipgutica/filip-stack/compare/v2.2.1...v2.3.0) (2026-09-24)


### Features

* **field-guide:** add opt-in effectiveness analytics ([1c1ec73](https://github.com/filipgutica/filip-stack/commit/1c1ec7325bc7b7f840b577d41ba43763a274e40d))

## [2.2.1](https://github.com/filipgutica/filip-stack/compare/v2.2.0...v2.2.1) (2026-09-22)


### Bug Fixes

* **workflow:** omit CI results from PR descriptions ([#43](https://github.com/filipgutica/filip-stack/issues/43)) ([51b238f](https://github.com/filipgutica/filip-stack/commit/51b238f4c592f3724cb79b89e63df09d26dd3213))

# [2.2.0](https://github.com/filipgutica/filip-stack/compare/v2.1.2...v2.2.0) (2026-09-17)


### Features

* **workflow:** teach practical lessons in walkthrough slices ([6581109](https://github.com/filipgutica/filip-stack/commit/6581109f27676d4b56466820e2774f8235a945fd))

## [2.1.2](https://github.com/filipgutica/filip-stack/compare/v2.1.1...v2.1.2) (2026-09-16)


### Bug Fixes

* **workflow:** make PR testing guidance optional ([b794b45](https://github.com/filipgutica/filip-stack/commit/b794b45c95003884998695519d76d7b2031c7d5d))

## [2.1.1](https://github.com/filipgutica/filip-stack/compare/v2.1.0...v2.1.1) (2026-09-08)


### Bug Fixes

* **workflow:** clarify agent reuse and escalation ([87d6349](https://github.com/filipgutica/filip-stack/commit/87d6349fd751b0e9dd9005067837b9ab8ecb632c))

# [2.1.0](https://github.com/filipgutica/filip-stack/compare/v2.0.2...v2.1.0) (2026-09-05)


### Features

* **workflow:** add read-only review and preserve task results during learning ([0ad18ac](https://github.com/filipgutica/filip-stack/commit/0ad18aceb0e4764506c864aebea73b7b333e5ede))

## [2.0.2](https://github.com/filipgutica/filip-stack/compare/v2.0.1...v2.0.2) (2026-09-05)


### Bug Fixes

* **workflow:** clarify technical prose guidance and add release skill ([623aae6](https://github.com/filipgutica/filip-stack/commit/623aae6297baf5f4d3c5d08ed15bff7910362f92))

## [2.0.1](https://github.com/filipgutica/filip-stack/compare/v2.0.0...v2.0.1) (2026-09-04)


### Bug Fixes

* **workflow:** reconcile focused testing guidance ([5b57a46](https://github.com/filipgutica/filip-stack/commit/5b57a46f4fd531e7838428540c845e4c57444b3c))

# [2.0.0](https://github.com/filipgutica/filip-stack/compare/v1.16.0...v2.0.0) (2026-09-03)


* feat(workflow)!: simplify engineering workflow ([74ead1a](https://github.com/filipgutica/filip-stack/commit/74ead1a52a07d384389dc9b50d3b663cb4fada9a))


### BREAKING CHANGES

* v1 Workflow skill entrypoints and hooks have no compatibility aliases.

Field Guide now installs as a separate plugin.

# [1.16.0](https://github.com/filipgutica/filip-stack/compare/v1.15.0...v1.16.0) (2026-08-31)


### Bug Fixes

* **workflow:** bind walkthrough state to branch history ([efb8873](https://github.com/filipgutica/filip-stack/commit/efb88737fae1fdf6624995308a41747a98aa1f64))


### Features

* **workflow:** add automated agent walkthrough ([e85e76a](https://github.com/filipgutica/filip-stack/commit/e85e76ae9a854bb4b329b8762de4b374c92c3cce))
* **workflow:** tighten durable learning and agent routing ([df580d9](https://github.com/filipgutica/filip-stack/commit/df580d90ac5eb4d3f4897681938d4a290ba05470))
* **workflow:** tighten field guide and runtime payload ([c9a3131](https://github.com/filipgutica/filip-stack/commit/c9a313198de23a5361b274b18294702044e2bcdf))

# [1.15.0](https://github.com/filipgutica/filip-stack/compare/v1.14.1...v1.15.0) (2026-08-29)


### Bug Fixes

* **workflow:** target existing repository docs ([a94d1d1](https://github.com/filipgutica/filip-stack/commit/a94d1d19c197aeaf40a2931bbfb3a8df87cb9bbb))


### Features

* **workflow:** add domain-aware design grilling ([ff9c5c6](https://github.com/filipgutica/filip-stack/commit/ff9c5c6cfd8440ff3ac1f6ecc87f01bbb4c06ff7))

## [1.14.1](https://github.com/filipgutica/filip-stack/compare/v1.14.0...v1.14.1) (2026-08-24)


### Bug Fixes

* **workflow:** override Codex hook discovery ([e8d0153](https://github.com/filipgutica/filip-stack/commit/e8d015371210e838989d027b67e8bc741d6ee138))

# [1.14.0](https://github.com/filipgutica/filip-stack/compare/v1.13.1...v1.14.0) (2026-08-24)


### Bug Fixes

* **workflow:** disable visible Codex hooks ([41d9964](https://github.com/filipgutica/filip-stack/commit/41d99648ade4a3a2574105fbf6eac5df2b2919b4))
* **workflow:** preserve grill log decisions ([be46854](https://github.com/filipgutica/filip-stack/commit/be46854804416f37bb59fa36de431c5b2b966d59))


### Features

* **workflow:** enforce active slice discipline ([e4f0e35](https://github.com/filipgutica/filip-stack/commit/e4f0e35c846b9575bfddcea10d054217bf23c54d))

## [1.13.1](https://github.com/filipgutica/filip-stack/compare/v1.13.0...v1.13.1) (2026-08-23)


### Bug Fixes

* **workflow:** keep field-guide hooks quiet ([6eac314](https://github.com/filipgutica/filip-stack/commit/6eac3144f344d7a8d0752f7988b3b20694bc1b77))

# [1.13.0](https://github.com/filipgutica/filip-stack/compare/v1.12.0...v1.13.0) (2026-08-22)


### Bug Fixes

* **workflow:** align rebased validation ([905defa](https://github.com/filipgutica/filip-stack/commit/905defad6ef18a7fc605ab452cb8dbf7027d3337))
* **workflow:** hide field-guide skip notices ([69d076e](https://github.com/filipgutica/filip-stack/commit/69d076e671000cc6e62a727f2d3c758c48605704))
* **workflow:** make field-guide hooks runtime-safe ([78986eb](https://github.com/filipgutica/filip-stack/commit/78986eba8908c7456e57024458bc7f3936772876))
* **workflow:** preserve task output on skip ([2781c0e](https://github.com/filipgutica/filip-stack/commit/2781c0ed8b8f7029cf1ea76840fe32d12946c72a))
* **workflow:** track walkthrough slice progress ([c8a0d1c](https://github.com/filipgutica/filip-stack/commit/c8a0d1cc6d8ab51e66e76c630c131f114d10ecd4))


### Features

* **workflow:** automate field-guide learning ([c7ac912](https://github.com/filipgutica/filip-stack/commit/c7ac91292232098d6cf80ea85cc65852b24dbf09))
* **workflow:** persist walkthrough logs ([0de3422](https://github.com/filipgutica/filip-stack/commit/0de342264ac1a32c671dcd4b1413976c8d82fa58))

# [1.12.0](https://github.com/filipgutica/filip-stack/compare/v1.11.0...v1.12.0) (2026-08-21)


### Features

* **workflow:** add topic-first artifact traceability ([c087862](https://github.com/filipgutica/filip-stack/commit/c0878625ab33fdc29c3928655ee4da37dd74545d))

# [1.11.0](https://github.com/filipgutica/filip-stack/compare/v1.10.0...v1.11.0) (2026-08-19)


### Bug Fixes

* **field-guide:** close maintenance contracts ([e3b6f7d](https://github.com/filipgutica/filip-stack/commit/e3b6f7d92552c9695ae63dccd5db20895ae4c0e7))
* **workflow:** separate fallback worktrees ([bc76acf](https://github.com/filipgutica/filip-stack/commit/bc76acf9fab87f40daafc53473e73a88c203ad76))


### Features

* **field-guide:** add versioned memory migration ([20982c6](https://github.com/filipgutica/filip-stack/commit/20982c6f3495c358d14e808bfe6bbd3cd14ea2bf))
* **field-guide:** audit and maintain memory ([26d44de](https://github.com/filipgutica/filip-stack/commit/26d44de0626eecf1c2c32ecaaf4de93e61d0ea38))
* **field-guide:** bound guidance retrieval ([4da7e50](https://github.com/filipgutica/filip-stack/commit/4da7e50a1c5543d7f667801078f95357c04ac6fa))
* **field-guide:** capture durable observations ([a125f6d](https://github.com/filipgutica/filip-stack/commit/a125f6d4899ebaa8d41c5388e5a9bc04759bd48e))
* **field-guide:** manage guidance lifecycle ([d0d0d9f](https://github.com/filipgutica/filip-stack/commit/d0d0d9fd1dada0498166e89bf086e6868899d53b))
* **field-guide:** route durable learning ([931edaf](https://github.com/filipgutica/filip-stack/commit/931edafdf943f9aa197a735eda661227aad504d4))

# [1.10.0](https://github.com/filipgutica/filip-stack/compare/v1.9.0...v1.10.0) (2026-08-18)


### Bug Fixes

* **workflow:** allow authorized walkthrough corrections ([d713805](https://github.com/filipgutica/filip-stack/commit/d7138051850dc87bbe4bbd9d019799d20d65ce7b))


### Features

* **workflow:** add interactive walkthrough skill ([b664156](https://github.com/filipgutica/filip-stack/commit/b664156c96d710e1a0f9e6fbf27dea5e58f65683))
* **workflow:** define topics and ticket backends ([aa206c0](https://github.com/filipgutica/filip-stack/commit/aa206c0b649f1b353ff99274ce7fefaacebf698f))

# [1.9.0](https://github.com/filipgutica/filip-stack/compare/v1.8.0...v1.9.0) (2026-08-10)


### Bug Fixes

* **workflow:** harden ledger migration safety ([55defcc](https://github.com/filipgutica/filip-stack/commit/55defccdb20852bf51ccb0b9127b4d23e40d6958))


### Features

* **workflow:** add branch task planner skill ([a4efbce](https://github.com/filipgutica/filip-stack/commit/a4efbcea0b3b4c9f4e83bfb631dc8c5799abcb3d))
* **workflow:** add curated engineering adaptations ([0fa05b8](https://github.com/filipgutica/filip-stack/commit/0fa05b8ac055667f8052cd61172cc4a9722bbc65))
* **workflow:** add external artifact storage ([2340c68](https://github.com/filipgutica/filip-stack/commit/2340c684dc0bc2918dfb62934a44f3dc7a7feaf7))
* **workflow:** add implementation and review guidance ([a7f352d](https://github.com/filipgutica/filip-stack/commit/a7f352db0a6869fcf68151110f7fda40f4da435c))
* **workflow:** add implementation constraints ([de57952](https://github.com/filipgutica/filip-stack/commit/de579520129a681e5092bf9398d5b10a1c5f9f32))
* **workflow:** add planning and writing skills ([0ec8d8f](https://github.com/filipgutica/filip-stack/commit/0ec8d8f9867903c9affb27722dcdfd836bd7de3c))
* **workflow:** add PR description guidance ([1f3d6a2](https://github.com/filipgutica/filip-stack/commit/1f3d6a249b15db290ebdda3f796747255c129dd8))
* **workflow:** add ticket hierarchy guidance ([1c784a6](https://github.com/filipgutica/filip-stack/commit/1c784a6e2dbf99bd8a73b02bed3d79e7ca1234af))
* **workflow:** adopt ERD specification format ([d1cf969](https://github.com/filipgutica/filip-stack/commit/d1cf9696777186c7063f97c2b5976f754c87afad))
* **workflow:** integrate engineering lifecycle routes ([b10a737](https://github.com/filipgutica/filip-stack/commit/b10a737ebeb848f43cb44fa297f579aefbed41ca))
* **workflow:** package engineering workflow suite ([1e41cc4](https://github.com/filipgutica/filip-stack/commit/1e41cc4fb1c17e2c7bd780339251c93fecb1f92d))

# [1.8.0](https://github.com/filipgutica/filip-stack/compare/v1.7.0...v1.8.0) (2026-07-31)


### Features

* **workflow:** redesign skill instructions ([22290f2](https://github.com/filipgutica/filip-stack/commit/22290f22d736d2fb8f84d3e56747e0752afb2074))

# [1.7.0](https://github.com/filipgutica/filip-stack/compare/v1.6.0...v1.7.0) (2026-07-28)


### Features

* **workflow:** add field guide and split coordinator flows ([435c9c4](https://github.com/filipgutica/filip-stack/commit/435c9c43c4a5dff73650042bc71e3adc8b574cdc))
* **workflow:** make review cycle invoke missing review ([c7c61dd](https://github.com/filipgutica/filip-stack/commit/c7c61dd4201678ae080590741b2659815be81706))

# [1.6.0](https://github.com/filipgutica/filip-stack/compare/v1.5.0...v1.6.0) (2026-07-27)


### Features

* consolidate coordinator execution policy ([c73e92c](https://github.com/filipgutica/filip-stack/commit/c73e92cd18558440113bd8e68e992127baa17f81))
* strengthen causal fix review guidance ([67feb8c](https://github.com/filipgutica/filip-stack/commit/67feb8c6a8af60dd909ab3daa16d08b2e4208a4a))

# [1.5.0](https://github.com/filipgutica/filip-stack/compare/v1.4.0...v1.5.0) (2026-07-22)


### Features

* strengthen workflow simplification checks ([da1415a](https://github.com/filipgutica/filip-stack/commit/da1415ad35bbd17055a1d9b5c06544eb1e53f184))

# [1.4.0](https://github.com/filipgutica/filip-stack/compare/v1.3.0...v1.4.0) (2026-06-30)


### Features

* sharpen review critic objection pass ([1beacef](https://github.com/filipgutica/filip-stack/commit/1beacefc2c790f2e71493379c6ee36dec00eea58))

# [1.3.0](https://github.com/filipgutica/filip-stack/compare/v1.2.0...v1.3.0) (2026-06-26)


### Features

* add separate critic review workflow ([16ae712](https://github.com/filipgutica/filip-stack/commit/16ae712b61d1a095d2eb20bdfbe250baa9880afa))

# [1.2.0](https://github.com/filipgutica/filip-stack/compare/v1.1.0...v1.2.0) (2026-06-24)


### Features

* add minimal code workflow skill ([198f83a](https://github.com/filipgutica/filip-stack/commit/198f83a232d2b68413c85411457694d52c8a8d70))

# [1.1.0](https://github.com/filipgutica/filip-stack/compare/v1.0.1...v1.1.0) (2026-06-03)


### Features

* streamline workflow coordinator ([24b7495](https://github.com/filipgutica/filip-stack/commit/24b7495b5246c9d14dc5228a57e2d5ed320e25a5))

## [1.0.1](https://github.com/filipgutica/filip-stack/compare/v1.0.0...v1.0.1) (2026-06-02)


### Bug Fixes

* make coordinator delegation workflow durable ([09761c9](https://github.com/filipgutica/filip-stack/commit/09761c94d9050657f82e995c294b7cb4030ac588))

# [1.0.0](https://github.com/filipgutica/filip-stack/compare/v0.11.0...v1.0.0) (2026-05-25)


* feat!: remove project notes plugin ([1bd6668](https://github.com/filipgutica/filip-stack/commit/1bd666876021b7de697c78cf8c4563705a1aed64))


### BREAKING CHANGES

* project-notes plugin and tracker skill are removed.

Notes hooks and the Codex hook installer are removed too.

# [0.11.0](https://github.com/filipgutica/filip-stack/compare/v0.10.1...v0.11.0) (2026-05-14)


### Features

* move claude plugin to dedicated repo ([47db29c](https://github.com/filipgutica/filip-stack/commit/47db29c67bd60200591b7fa75ec944d63171b45d))

## [0.10.1](https://github.com/filipgutica/filip-stack/compare/v0.10.0...v0.10.1) (2026-05-14)


### Bug Fixes

* use claude-p for claude adviser ([60d1854](https://github.com/filipgutica/filip-stack/commit/60d1854c643b48d3b23f3e1cb1b10a96351fc8a3))

# [0.10.0](https://github.com/filipgutica/filip-stack/compare/v0.9.0...v0.10.0) (2026-05-06)


### Features

* add simplification complexity recipes ([b2768f8](https://github.com/filipgutica/filip-stack/commit/b2768f846d4a2f5dc1a1662e616bf83bf140ba11))

# [0.9.0](https://github.com/filipgutica/filip-stack/compare/v0.8.0...v0.9.0) (2026-05-06)


### Features

* add claude plugin helpers ([7c85b74](https://github.com/filipgutica/filip-stack/commit/7c85b7471ee281b7e2c9cbb1afbddb6d5009dcc0))

# [0.8.0](https://github.com/filipgutica/filip-stack/compare/v0.7.0...v0.8.0) (2026-05-06)


### Features

* add claude plugin helpers ([b60456a](https://github.com/filipgutica/filip-stack/commit/b60456af3a0222c14c59a840663694962a51022a))

# [0.7.0](https://github.com/filipgutica/filip-stack/compare/v0.6.0...v0.7.0) (2026-05-05)


### Features

* split filip-stack marketplace plugins ([3b1d387](https://github.com/filipgutica/filip-stack/commit/3b1d3879975f19f065670356dab5751b9a0ef8bf))

# [0.6.0](https://github.com/filipgutica/filip-stack/compare/v0.5.1...v0.6.0) (2026-04-30)


### Features

* upgrade simplification review reporting ([bee811a](https://github.com/filipgutica/filip-stack/commit/bee811a0869ae2ff8636af3c1366d6f34c487028))

## [0.5.1](https://github.com/filipgutica/filip-stack/compare/v0.5.0...v0.5.1) (2026-04-29)


### Bug Fixes

* broaden coordinator routing ([8c81949](https://github.com/filipgutica/filip-stack/commit/8c81949581efd24b167b539751f6533dfd11aebd))

# [0.5.0](https://github.com/filipgutica/filip-stack/compare/v0.4.1...v0.5.0) (2026-04-29)


### Features

* add fallow-backed simplification guidance ([38392ed](https://github.com/filipgutica/filip-stack/commit/38392edeb53af2bc241e30423cbcb37a805d088a))

## [0.4.1](https://github.com/filipgutica/filip-stack/compare/v0.4.0...v0.4.1) (2026-04-29)


### Bug Fixes

* remove globals sync cli ([6eb8a0c](https://github.com/filipgutica/filip-stack/commit/6eb8a0c47837323f313c72deb81ab72093579672))

# [0.4.0](https://github.com/filipgutica/filip-stack/compare/v0.3.2...v0.4.0) (2026-04-24)


### Features

* add simplification review skill ([29db9c4](https://github.com/filipgutica/filip-stack/commit/29db9c4145ee7d52cd985b00e18a72a4d0ee263a))

## [0.3.2](https://github.com/filipgutica/filip-stack/compare/v0.3.1...v0.3.2) (2026-04-23)


### Bug Fixes

* rename claude marketplace to filip-stack ([e700df2](https://github.com/filipgutica/filip-stack/commit/e700df263ffdd5cccc78fcec052df7cf67be9bda))

## [0.3.1](https://github.com/filipgutica/filip-stack/compare/v0.3.0...v0.3.1) (2026-04-23)


### Bug Fixes

* clarify coordinator proportionality in readme ([2c56dba](https://github.com/filipgutica/filip-stack/commit/2c56dba9e6492399de8307e87ab8cc559eab9dbe))
* explain claude and codex plugin naming ([90267c3](https://github.com/filipgutica/filip-stack/commit/90267c30c80a1babc4e74678e69afadeabe6294e))

# [0.3.0](https://github.com/filipgutica/filip-stack/compare/v0.2.1...v0.3.0) (2026-04-23)


### Bug Fixes

* clarify coordinator proportionality in readme ([2c56dba](https://github.com/filipgutica/filip-stack/commit/2c56dba9e6492399de8307e87ab8cc559eab9dbe))
* quiet codex user prompt hook output ([9871260](https://github.com/filipgutica/filip-stack/commit/987126065da35c70d501845934c84a602a6afdfa))
* simplify coordinator ([a4de31a](https://github.com/filipgutica/filip-stack/commit/a4de31a528befb89f868c729db99df839acae64c))
* tighten notes hook reminders and stop backstop ([9bc885b](https://github.com/filipgutica/filip-stack/commit/9bc885b20768f0eeb19c069615b86aafac4b0091))


### Features

* add codex hooks sync command ([1c4cf64](https://github.com/filipgutica/filip-stack/commit/1c4cf64618b222fab62eab369e4598cb4ab502e8))
* multi-session support for project-notes-tracker ([e6bf4db](https://github.com/filipgutica/filip-stack/commit/e6bf4db9496468a7b4afe6294e9a98a3f9297a1d))
* update codex to be a proper repo plugin ([ff8e684](https://github.com/filipgutica/filip-stack/commit/ff8e684ffdb3939f0774cc3d8c6a80202267570c))

# [0.3.0](https://github.com/filipgutica/filip-stack/compare/v0.2.1...v0.3.0) (2026-04-23)


### Bug Fixes

* quiet codex user prompt hook output ([9871260](https://github.com/filipgutica/filip-stack/commit/987126065da35c70d501845934c84a602a6afdfa))
* simplify coordinator ([a4de31a](https://github.com/filipgutica/filip-stack/commit/a4de31a528befb89f868c729db99df839acae64c))
* tighten notes hook reminders and stop backstop ([9bc885b](https://github.com/filipgutica/filip-stack/commit/9bc885b20768f0eeb19c069615b86aafac4b0091))


### Features

* add codex hooks sync command ([1c4cf64](https://github.com/filipgutica/filip-stack/commit/1c4cf64618b222fab62eab369e4598cb4ab502e8))
* multi-session support for project-notes-tracker ([e6bf4db](https://github.com/filipgutica/filip-stack/commit/e6bf4db9496468a7b4afe6294e9a98a3f9297a1d))
* update codex to be a proper repo plugin ([ff8e684](https://github.com/filipgutica/filip-stack/commit/ff8e684ffdb3939f0774cc3d8c6a80202267570c))

# [0.3.0](https://github.com/filipgutica/filip-stack/compare/v0.2.1...v0.3.0) (2026-04-22)


### Bug Fixes

* quiet codex user prompt hook output ([9871260](https://github.com/filipgutica/filip-stack/commit/987126065da35c70d501845934c84a602a6afdfa))
* simplify coordinator ([a4de31a](https://github.com/filipgutica/filip-stack/commit/a4de31a528befb89f868c729db99df839acae64c))
* tighten notes hook reminders and stop backstop ([9bc885b](https://github.com/filipgutica/filip-stack/commit/9bc885b20768f0eeb19c069615b86aafac4b0091))


### Features

* add codex hooks sync command ([1c4cf64](https://github.com/filipgutica/filip-stack/commit/1c4cf64618b222fab62eab369e4598cb4ab502e8))
* multi-session support for project-notes-tracker ([e6bf4db](https://github.com/filipgutica/filip-stack/commit/e6bf4db9496468a7b4afe6294e9a98a3f9297a1d))
* update codex to be a proper repo plugin ([ff8e684](https://github.com/filipgutica/filip-stack/commit/ff8e684ffdb3939f0774cc3d8c6a80202267570c))

# [0.3.0](https://github.com/filipgutica/filip-stack/compare/v0.2.1...v0.3.0) (2026-04-22)


### Bug Fixes

* simplify coordinator ([a4de31a](https://github.com/filipgutica/filip-stack/commit/a4de31a528befb89f868c729db99df839acae64c))
* tighten notes hook reminders and stop backstop ([9bc885b](https://github.com/filipgutica/filip-stack/commit/9bc885b20768f0eeb19c069615b86aafac4b0091))


### Features

* multi-session support for project-notes-tracker ([e6bf4db](https://github.com/filipgutica/filip-stack/commit/e6bf4db9496468a7b4afe6294e9a98a3f9297a1d))
* update codex to be a proper repo plugin ([ff8e684](https://github.com/filipgutica/filip-stack/commit/ff8e684ffdb3939f0774cc3d8c6a80202267570c))

## [0.2.2](https://github.com/filipgutica/filip-stack/compare/v0.2.1...v0.2.2) (2026-04-17)


### Bug Fixes

* simplify coordinator ([a4de31a](https://github.com/filipgutica/filip-stack/commit/a4de31a528befb89f868c729db99df839acae64c))
* tighten notes hook reminders and stop backstop ([9bc885b](https://github.com/filipgutica/filip-stack/commit/9bc885b20768f0eeb19c069615b86aafac4b0091))

## [0.2.1](https://github.com/filipgutica/filip-stack/compare/v0.2.0...v0.2.1) (2026-04-15)


### Bug Fixes

* update notes skill ([32fc805](https://github.com/filipgutica/filip-stack/commit/32fc805031edbd0e7d35b693c8375f0b76ccb3aa))

# [0.2.0](https://github.com/filipgutica/filip-stack/compare/v0.1.1...v0.2.0) (2026-04-14)


### Bug Fixes

* remove stale claude pages workflow ([9c1a2d3](https://github.com/filipgutica/filip-stack/commit/9c1a2d3798d7036dff9088552bb299dd290ec276))
* simplify semantic-release commit message ([158b3c8](https://github.com/filipgutica/filip-stack/commit/158b3c8458408fd0164b5ade56435ea3dde6dcc1))
* update skill definitions ([e4c939a](https://github.com/filipgutica/filip-stack/commit/e4c939a917ea52571e6cfb403ce8988e3a026c3a))


### Features

* add conventional commits and automated semantic-release versioning ([08957fa](https://github.com/filipgutica/filip-stack/commit/08957fa644a681c5013fdf1e60bd9c56ae6eaa11))

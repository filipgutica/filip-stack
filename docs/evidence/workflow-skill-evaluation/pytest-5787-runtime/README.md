# Pytest 5787 native agent runtime

This image lets the PluginBench agent run focused tests for `pytest-dev__pytest-5787` on an arm64 host.
The official SWE-bench verifier still uses its pinned amd64 task image.

The build copies Codex, Promptfoo, and Node from the normal PluginBench runtime.
It adds the Python version and dependencies from the pinned task environment.

Build the image from the repository root:

```sh
docker build \
  --tag pluginbench-pytest-5787-native:0.1.1 \
  docs/evidence/workflow-skill-evaluation/pytest-5787-runtime
```

The Dockerfile pins both base-image digests.
The recorded run used final image ID
`sha256:a2ac9c1f0e1076698ebff9249f28d886c6c3c885545bbd02e35ad10db86ef65d`.

Use a PluginBench config copy that sets this value:

```yaml
tooling:
  container_image: pluginbench-pytest-5787-native:0.1.1
```

Do not replace the shared `pluginbench-runtime:0.2.0` tag for a normal run.

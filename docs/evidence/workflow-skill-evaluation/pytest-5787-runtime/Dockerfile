ARG PLUGINBENCH_RUNTIME=pluginbench-runtime:0.2.0@sha256:46f9b2d6cd61403c82d00b26cb280a7e5a598bb4ab5a8688378160bfe0f0a6bf
FROM ${PLUGINBENCH_RUNTIME} AS pluginbench

FROM python:3.9-slim-bookworm@sha256:a02e9c5406c416c504d6c9a1a306ff4080c3173f1008d192f953bd20382a2d5c

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        git \
        libatomic1 \
        ripgrep \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pluginbench /usr/local/bin/node /usr/local/bin/node
COPY --from=pluginbench /app /app

RUN python -m pip install --no-cache-dir \
    atomicwrites==1.4.1 \
    attrs==23.1.0 \
    more-itertools==10.1.0 \
    packaging==23.1 \
    pluggy==0.13.1 \
    py==1.11.0 \
    wcwidth==0.2.6

RUN mkdir -p /opt/pluginbench-task
COPY _version.py /opt/pluginbench-task/_version.py
COPY sitecustomize.py /usr/local/lib/python3.9/site-packages/sitecustomize.py

ENV PYTHONPATH=src
WORKDIR /app
ENTRYPOINT ["node", "/app/node_modules/promptfoo/dist/src/entrypoint.js"]

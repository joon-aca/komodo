# syntax=docker/dockerfile:1

## All in one, multi stage compile + runtime Docker build for your architecture.

# Build Core
FROM rust:1.98.0-trixie AS core-builder
ENV CARGO_HOME=/var/cache/cargo
RUN --mount=type=cache,target=/var/cache/cargo \
    cargo install --locked --no-default-features --features set-version \
      --root /usr/local/cargo cargo-edit

WORKDIR /builder
COPY Cargo.toml Cargo.lock ./
COPY ./lib ./lib
COPY ./client/core/rs ./client/core/rs
COPY ./client/periphery ./client/periphery
COPY ./bin/core ./bin/core
COPY ./bin/cli ./bin/cli
COPY ./xtask ./xtask

ARG VERSION="0.0.0"
ARG IMAGE_TAG=""

# The opt-in dev profile skips the EC2 SDK and release optimizations.
ARG BUILD_PROFILE=release
ARG TARGETPLATFORM

RUN --mount=type=cache,target=/var/cache/cargo \
    --mount=type=cache,id=komodo-core-target-${TARGETPLATFORM},target=/builder/target,sharing=locked \
    <<EOF
set -eux
cargo set-version -p komodo_core "${VERSION}${IMAGE_TAG:+-${IMAGE_TAG}}"
# Cargo checks local source timestamps against its cached build artifacts.
find bin client lib xtask -type f -exec touch {} +
mkdir -p /out
if [ "$BUILD_PROFILE" = "release" ]; then
  cargo build --release -p komodo_core -p komodo_cli
  cp target/release/core target/release/km /out/
  strip /out/core /out/km
elif [ "$BUILD_PROFILE" = "dev" ]; then
  cargo build -p komodo_core -p komodo_cli --no-default-features
  cp target/debug/core target/debug/km /out/
else
  echo "BUILD_PROFILE must be release or dev, got $BUILD_PROFILE" >&2
  exit 1
fi
EOF

# Build UI
FROM node:22.12-alpine AS ui-builder
WORKDIR /builder
COPY ./ui ./ui
COPY ./client/core/ts ./client
RUN cd client && yarn && yarn build && yarn link
RUN cd ui && yarn link komodo_client && yarn && yarn build

# Final Image
FROM debian:trixie-slim

COPY ./bin/core/starship.toml /starship.toml
COPY ./bin/core/debian-deps.sh .
RUN sh ./debian-deps.sh && rm ./debian-deps.sh

# Setup an application directory
WORKDIR /app

# Copy
COPY ./config/core.config.toml /config/.default.config.toml
COPY --from=ui-builder /builder/ui/dist /app/ui
COPY --from=core-builder /out/core /usr/local/bin/core
COPY --from=core-builder /out/km /usr/local/bin/km
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Set $DENO_DIR and preload external Deno deps
ENV DENO_DIR=/action-cache/deno
RUN mkdir /action-cache && \
  cd /action-cache && \
  deno install jsr:@std/yaml jsr:@std/toml

COPY ./bin/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Hint at the port
EXPOSE 9120

ENV KOMODO_CLI_CONFIG_PATHS="/config"
# This ensures any `komodo.cli.*` takes precedence over the Core `/config/*config.*`
ENV KOMODO_CLI_CONFIG_KEYWORDS="*config.*,*komodo.cli*.*"

ENTRYPOINT [ "entrypoint.sh" ]
CMD [ "core" ]

# Label to prevent Komodo from stopping with StopAllContainers
LABEL komodo.skip="true"
# Label for Ghcr
LABEL org.opencontainers.image.source="https://github.com/moghtech/komodo"
LABEL org.opencontainers.image.description="Komodo Core"
LABEL org.opencontainers.image.licenses="GPL-3.0"

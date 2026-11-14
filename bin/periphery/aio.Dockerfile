# syntax=docker/dockerfile:1

## All in one, multi stage compile + runtime Docker build for your architecture.

FROM rust:1.98.0-trixie AS builder
ENV CARGO_HOME=/var/cache/cargo
RUN --mount=type=cache,target=/var/cache/cargo \
    cargo install --locked --no-default-features --features set-version \
      --root /usr/local/cargo cargo-edit

WORKDIR /builder
COPY Cargo.toml Cargo.lock ./
COPY ./lib ./lib
COPY ./client/core/rs ./client/core/rs
COPY ./client/periphery ./client/periphery
COPY ./bin/periphery ./bin/periphery
COPY ./xtask ./xtask

ARG VERSION="0.0.0"
ARG IMAGE_TAG=""

ARG BUILD_PROFILE=release
ARG TARGETPLATFORM

RUN --mount=type=cache,target=/var/cache/cargo \
    --mount=type=cache,id=komodo-periphery-target-${TARGETPLATFORM},target=/builder/target,sharing=locked \
    <<EOF
set -eux
cargo set-version -p komodo_periphery "${VERSION}${IMAGE_TAG:+-${IMAGE_TAG}}"
# Cargo checks local source timestamps against its cached build artifacts.
find bin client lib xtask -type f -exec touch {} +
mkdir -p /out
if [ "$BUILD_PROFILE" = "release" ]; then
  cargo build --release -p komodo_periphery
  cp target/release/periphery /out/
  strip /out/periphery
elif [ "$BUILD_PROFILE" = "dev" ]; then
  cargo build -p komodo_periphery
  cp target/debug/periphery /out/
else
  echo "BUILD_PROFILE must be release or dev, got $BUILD_PROFILE" >&2
  exit 1
fi
EOF

# Final Image
FROM debian:trixie-slim

COPY ./bin/periphery/starship.toml /starship.toml
COPY ./bin/periphery/debian-deps.sh .
RUN sh ./debian-deps.sh && rm ./debian-deps.sh

COPY --from=builder /out/periphery /usr/local/bin/periphery

COPY ./bin/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8120

# Can mount config file to /config/*config*.toml and it will be picked up.
ENV PERIPHERY_CONFIG_PATHS="/config"
# Change the default in container to /config/keys to match Core
ENV PERIPHERY_PRIVATE_KEY="file:/config/keys/periphery.key"

ENTRYPOINT [ "entrypoint.sh" ]
CMD [ "periphery" ]

# Label to prevent Komodo from stopping with StopAllContainers
LABEL komodo.skip="true"
# Label for ghcr
LABEL org.opencontainers.image.source="https://github.com/moghtech/komodo"
LABEL org.opencontainers.image.description="Komodo Periphery"
LABEL org.opencontainers.image.licenses="GPL-3.0"

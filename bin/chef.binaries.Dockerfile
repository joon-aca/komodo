## Builds the Komodo Core, Periphery, and Util binaries
## for a specific architecture. Requires OpenSSL 3 or later.

## Uses chef for dependency caching to help speed up back-to-back builds.

FROM lukemathwalker/cargo-chef:latest-rust-1.98.0-bookworm AS chef
WORKDIR /builder

# Plan just the RECIPE to see if things have changed
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
RUN cargo install --locked --no-default-features --features set-version cargo-edit

# Build JUST dependencies - cached layer
COPY --from=planner /builder/recipe.json recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json \
    -p komodo_core -p komodo_periphery -p komodo_cli

# NOW copy again (this time into builder), set version, and build app
COPY . .

# Set Version
ARG VERSION="0.0.0"
ARG IMAGE_TAG=""
RUN cargo set-version -p komodo_core ${VERSION}${IMAGE_TAG:+-${IMAGE_TAG}}

RUN find bin client lib xtask -type f -exec touch {} + && \
  cargo build --release -p komodo_core -p komodo_periphery -p komodo_cli && \
  strip target/release/core target/release/periphery target/release/km

# Copy just the binaries to scratch image
FROM scratch

COPY --from=builder /builder/target/release/core /core
COPY --from=builder /builder/target/release/periphery /periphery
COPY --from=builder /builder/target/release/km /km

LABEL org.opencontainers.image.source="https://github.com/moghtech/komodo"
LABEL org.opencontainers.image.description="Komodo Binaries"
LABEL org.opencontainers.image.licenses="GPL-3.0"

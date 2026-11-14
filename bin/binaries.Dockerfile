## Builds the Komodo Core, Periphery, and Util binaries
## for a specific architecture. Requires OpenSSL 3 or later.

FROM rust:1.98.0-bookworm AS builder
RUN cargo install --locked --no-default-features --features set-version cargo-edit

WORKDIR /builder
COPY Cargo.toml Cargo.lock ./
COPY ./lib ./lib
COPY ./client/core/rs ./client/core/rs
COPY ./client/periphery ./client/periphery
COPY ./bin/core ./bin/core
COPY ./bin/periphery ./bin/periphery
COPY ./bin/cli ./bin/cli
COPY ./xtask ./xtask

# Set Version
ARG VERSION="0.0.0"
ARG IMAGE_TAG=""
RUN cargo set-version -p komodo_core ${VERSION}${IMAGE_TAG:+-${IMAGE_TAG}}

# Compile bin
RUN cargo build --release -p komodo_core -p komodo_periphery -p komodo_cli && \
  strip target/release/core target/release/periphery target/release/km

# Copy just the binaries to scratch image
FROM scratch

COPY --from=builder /builder/target/release/core /core
COPY --from=builder /builder/target/release/periphery /periphery
COPY --from=builder /builder/target/release/km /km

LABEL org.opencontainers.image.source="https://github.com/moghtech/komodo"
LABEL org.opencontainers.image.description="Komodo Binaries"
LABEL org.opencontainers.image.licenses="GPL-3.0"

use axum::{Json, http::header};
use komodo_client::entities::config::core::UiTheme;
use serde::Serialize;

use crate::config::core_config;

/// Public presentation settings only. Do not expose CoreConfig here.
#[derive(Serialize)]
pub(super) struct UiConfig {
  theme: UiTheme,
  instance_name: &'static str,
}

pub(super) async fn config() -> impl axum::response::IntoResponse {
  (
    [(header::CACHE_CONTROL, "no-store")],
    Json(UiConfig {
      theme: core_config().ui_theme,
      instance_name: &core_config().ui_instance_name,
    }),
  )
}
